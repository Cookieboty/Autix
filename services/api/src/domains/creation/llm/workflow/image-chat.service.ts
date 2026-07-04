import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { hasChatCapability } from '@autix/domain';
import { ModelType } from '../../../platform/prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../../model-config/model-config.service';
import { createChatModelFromDbConfig } from '../model.factory';
import { CallBillingService } from '../billing/call-billing.service';
import { createTrackedModel } from '../billing/llm-call-tracker';
import type { SourceImageRef } from './image-generation-flow.service';
import { ImageGenerationFlowService } from './image-generation-flow.service';
import type { WorkflowStepEvent } from './workflow.types';
import { SystemPromptService } from '../../../platform/system-settings/system-prompt.service';
import { LlmRepository } from '../llm.repository';
import {
  invokeModelWithImageActionTools,
  messageContentToText,
  parseImageToolActionFromMessage,
  parseImageToolActionFromText,
  type ImageToolAction,
} from './image-tool-actions';

export interface ImageTemplateContext {
  id: string;
  title: string;
  prompt: string;
  variables?: unknown;
  modelHint?: string | null;
}

export interface ImageChatInput {
  userId: string;
  conversationId: string;
  message: string;
  template: ImageTemplateContext;
  /** 图片生成模型。图片模式工具调用执行阶段使用。 */
  imageModelConfigId: string;
  /** 图片模式主 LLM。为空时使用用户默认 general 模型。 */
  chatModelConfigId?: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: {
    size?: string;
    quality?: string;
    [key: string]: unknown;
  };
}

interface ImageAssistantResult {
  content: string;
  action: ImageToolAction | null;
}

@Injectable()
export class ImageChatService {
  private readonly logger = new Logger(ImageChatService.name);

  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly repository: LlmRepository,
    private readonly systemPromptService: SystemPromptService,
    private readonly imageGenerationFlowService: ImageGenerationFlowService,
    private readonly billing: CallBillingService,
  ) {}

  async *chat(input: ImageChatInput): AsyncGenerator<WorkflowStepEvent> {
    const response = await this.invokeAssistant(input);
    const parsed = response.action ?? parseImageToolActionFromText(response.content);

    if (!parsed) {
      yield { type: 'llm_token', stepKey: 'image_chat', content: response.content };
      return;
    }

    yield* this.executeImageAction(input, parsed);
  }

  async invokeAssistant(input: ImageChatInput): Promise<ImageAssistantResult> {
    const config = await this.resolveAssistantChatModel(input);

    const history = await this.repository.findConversationMessages(input.conversationId, 20);
    // 图片模式下"理解需求 / 决定是否生图"这次对话调用也要按对话消息计费（token）。
    const model = createTrackedModel(createChatModelFromDbConfig(config), this.billing, {
      userId: input.userId,
      modelConfigId: config.id,
      modelName: config.model,
      modelProvider: config.provider,
      modelTier: resolveBillingTier(config),
      pointCostWeight: Number(config.pointCostWeight ?? 1),
    });
    const sourceImages = (input.sourceImages ?? [])
      .map((image, index) => `${index + 1}. ${image.url}${image.prompt ? ` | prompt: ${image.prompt}` : ''}`)
      .join('\n');

    const systemPrompt = await this.systemPromptService.render('image.templateChat', {
      templateTitle: input.template.title,
      templatePrompt: input.template.prompt,
      templateVariables: JSON.stringify(input.template.variables ?? []),
      modelHint: input.template.modelHint ? `默认图片模型: ${input.template.modelHint}` : '',
      sourceImages: sourceImages ? `用户已选择这些历史图片作为编辑源:\n${sourceImages}` : '',
    });

    this.logger.log(
      `image chat assistant invoke: conversation=${input.conversationId} chatModel=${config.id}(${config.model}) caps=[${(config.capabilities ?? []).join(',')}]`,
    );

    let result;
    try {
      result = await invokeModelWithImageActionTools(model, [
        new SystemMessage(systemPrompt.content),
        new HumanMessage(
          [
            `最近历史:\n${history.map((m) => `${m.role}: ${m.content}`).join('\n').slice(-6000)}`,
            `用户最新消息: ${input.message}`,
          ].join('\n\n'),
        ),
      ]);
    } catch (err) {
      // 模型返回空响应（无 choices）时 LangChain 会抛
      // "Cannot read properties of undefined (reading 'message')"。
      // 记录真实错误 + 所用模型，并换成可读、可定位的错误，避免整段对话以隐晦栈崩溃。
      this.logger.error(
        `image chat assistant invoke failed: chatModel=${config.id}(${config.model}) caps=[${(config.capabilities ?? []).join(',')}] reason=${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(
        `对话模型 ${config.model} 未返回有效结果，请确认所选文本模型支持标准对话（/chat/completions）。`,
      );
    }

    const content = messageContentToText(asRecord(result.message)?.content);
    return {
      content,
      action: parseImageToolActionFromMessage(result.message),
    };
  }

  /**
   * 解析图片模式下用于"理解需求 / 决定是否调用生图工具 / 生成提示词"的对话模型。
   * 该调用必须使用文本对话模型：若传入的 chatModel 实际是图片模型（无 chat 能力），
   * 会退回默认 general 模型；否则把图片模型当聊天模型调用会得到空响应，
   * LangChain 抛 "Cannot read properties of undefined (reading 'message')"。
   */
  private async resolveAssistantChatModel(input: ImageChatInput) {
    // 1) 用户在图片工具栏显式选择的对话模型（有 chat 能力）优先。
    if (input.chatModelConfigId) {
      const picked = await this.modelConfigService.getConfigForOrchestrator(
        input.chatModelConfigId,
        input.userId,
      );
      if (hasChatCapability(picked.capabilities ?? [])) return picked;
      this.logger.warn(
        `image chat: 指定 chatModel=${picked.id}(${picked.model}) 无 chat 能力，尝试其它对话模型`,
      );
    }

    // 2) 默认 general 模型（需具备 chat 能力）。
    const defaultGeneral = await this.modelConfigService.findDefaultByTypeForUser(
      ModelType.general,
      input.userId,
    );
    if (defaultGeneral) {
      const config = await this.modelConfigService.getConfigForOrchestrator(
        defaultGeneral.id,
        input.userId,
      );
      if (hasChatCapability(config.capabilities ?? [])) return config;
      this.logger.warn(
        `image chat: 默认 general 模型=${config.id}(${config.model}) 无 chat 能力，尝试任一可用对话模型`,
      );
    }

    // 3) 兜底：用户任意一个可用的文本对话模型（避免默认模型被配成图片模型时整段对话不可用）。
    const available = await this.modelConfigService.findAvailableModels(input.userId);
    const anyChatModel = available.find((model) =>
      hasChatCapability(model.capabilities ?? []),
    );
    if (anyChatModel) {
      return this.modelConfigService.getConfigForOrchestrator(anyChatModel.id, input.userId);
    }

    throw new BadRequestException(
      '图片模式需要一个文本对话模型来理解需求，请先在工具栏选择或配置一个文本模型。',
    );
  }

  private async *executeImageAction(
    input: ImageChatInput,
    action: ImageToolAction,
  ): AsyncGenerator<WorkflowStepEvent> {
    const prompt = action.type === 'generate_image' ? action.prompt : action.instruction;
    const imageRefs = this.resolveActionImageRefs(action, input);
    const resolveInput = {
      userId: input.userId,
      conversationId: input.conversationId,
      templateId: input.template.id,
      modelConfigId: input.imageModelConfigId,
      chatModelId: input.chatModelConfigId,
      promptOverride: prompt,
      sourceImages: imageRefs.sourceImages,
      referenceImages: imageRefs.referenceImages,
      settings: {
        ...input.settings,
        skipPromptTuning: true,
      },
    };

    const request = await this.imageGenerationFlowService.resolveImageRequest(resolveInput);
    const taskId = `image-chat:${input.userId}:${Date.now()}`;
    this.logger.log(
      `image chat tool call: type=${action.type} conversation=${input.conversationId} user=${input.userId} imageModel=${input.imageModelConfigId} task=${taskId}`,
    );

    if (request.mode === 'edit') {
      yield {
        type: 'image_editing',
        taskId,
        model: request.modelConfig.model,
        sourceImages: request.sourceImages ?? [],
        count: 1,
      };
    } else {
      yield {
        type: 'image_generating',
        taskId,
        model: request.modelConfig.model,
        count: 1,
      };
    }

    const result = await this.imageGenerationFlowService.generateAndPersistImage(
      resolveInput,
      request,
      1,
    );

    yield {
      type: 'image_generated',
      taskId,
      images: result.images,
      prompt: result.prompt,
      model: result.model,
      sourceImages: request.sourceImages,
      referenceImages: request.referenceImages,
    };
  }

  private resolveActionImageRefs(
    action: ImageToolAction,
    input: ImageChatInput,
  ): { sourceImages?: SourceImageRef[]; referenceImages?: SourceImageRef[] } {
    if (action.type === 'generate_image') {
      return { referenceImages: input.referenceImages };
    }

    if (input.sourceImages?.length) {
      return {
        sourceImages: input.sourceImages,
        referenceImages: input.referenceImages,
      };
    }

    return { sourceImages: input.referenceImages };
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolveBillingTier(config: unknown): string | undefined {
  const metadata = asRecord(config)?.metadata;
  const tier = asRecord(metadata)?.billingTier;
  return typeof tier === 'string' ? tier : undefined;
}
