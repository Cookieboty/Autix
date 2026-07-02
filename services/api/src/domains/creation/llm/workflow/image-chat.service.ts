import { Injectable, Logger } from '@nestjs/common';
import { ModelType } from '../../../platform/prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../../model-config/model-config.service';
import { createChatModelFromDbConfig } from '../model.factory';
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
    const config = input.chatModelConfigId
      ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelConfigId, input.userId)
      : await this.resolveDefaultChatModel(input.userId);

    const history = await this.repository.findConversationMessages(input.conversationId, 20);
    const model = createChatModelFromDbConfig(config);
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

    const result = await invokeModelWithImageActionTools(model, [
      new SystemMessage(systemPrompt.content),
      new HumanMessage(
        [
          `最近历史:\n${history.map((m) => `${m.role}: ${m.content}`).join('\n').slice(-6000)}`,
          `用户最新消息: ${input.message}`,
        ].join('\n\n'),
      ),
    ]);

    const content = messageContentToText(asRecord(result.message)?.content);
    return {
      content,
      action: parseImageToolActionFromMessage(result.message),
    };
  }

  private async resolveDefaultChatModel(userId: string) {
    const config = await this.modelConfigService.findDefaultByTypeForUser(
      ModelType.general,
      userId,
    );
    if (!config) throw new Error('未配置通用模型');
    return this.modelConfigService.getConfigForOrchestrator(config.id, userId);
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
