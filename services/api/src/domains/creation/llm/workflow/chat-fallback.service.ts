import { Injectable } from '@nestjs/common';
import { createChatModelFromDbConfig } from '../model.factory';
import { ModelConfigService } from '../../model-config/model-config.service';
import { CallBillingService } from '../billing/call-billing.service';
import { createTrackedModel } from '../billing/llm-call-tracker';
import { ModelType } from '../../../platform/prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { WorkflowStepEvent } from './workflow.types';
import { SystemPromptService } from '../../../platform/system-settings/system-prompt.service';
import { toRuntimeModelConfig } from './workflow-step-executor';
import { ImageGenerationFlowService, type SourceImageRef } from './image-generation-flow.service';
import type { ImageGenerationSettings } from './image-generation-call-params';
import type { ImageTemplateContext } from './image-chat.service';
import {
  invokeModelWithImageActionTools,
  messageContentToText,
  parseImageToolActionFromMessage,
  parseImageToolActionFromText,
  type ImageToolAction,
} from './image-tool-actions';

export interface ChatFallbackImageToolOptions {
  conversationId: string;
  imageModelConfigId?: string;
  template: ImageTemplateContext;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: ImageGenerationSettings;
}

@Injectable()
export class ChatFallbackService {
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly billing: CallBillingService,
    private readonly systemPromptService: SystemPromptService,
    private readonly imageGenerationFlowService: ImageGenerationFlowService,
  ) {}

  async *chat(
    userId: string,
    message: string,
    modelConfigId?: string,
    images?: string[],
    options?: {
      imageTool?: ChatFallbackImageToolOptions;
    },
  ): AsyncGenerator<WorkflowStepEvent> {
    const resolvedId = modelConfigId ?? (await this.resolveDefaultModelId(userId));
    const dbConfig = toRuntimeModelConfig(
      await this.modelConfigService.getConfigForOrchestrator(resolvedId, userId),
    );
    const model = createChatModelFromDbConfig(dbConfig);

    // 自有模型不再免费：所有对话调用一律计费（tracked model）。
    // taskType 固定字面量 'chat_message_standard'：resolveChatTaskType 被删除前，
    // 这里的调用（modelTier 从未真正被运营配置过）恒定猜出这个值，行为不变。
    const invokeModel = createTrackedModel(model, this.billing, {
      userId,
      modelConfigId: resolvedId,
      modelName: dbConfig.model ?? dbConfig.name,
      modelProvider: dbConfig.provider,
      taskType: 'chat_message_standard',
    });

    const systemPrompt = await this.renderSystemPrompt(options?.imageTool);

    const messages = [
      new SystemMessage(systemPrompt.content),
      this.buildUserMessage(message, images),
    ];
    const result = options?.imageTool?.imageModelConfigId
      ? await invokeModelWithImageActionTools(invokeModel, messages)
      : { message: await invokeModel.invoke(messages), usedNativeTools: false };

    const content = messageContentToText(asRecord(result.message)?.content);
    const imageAction =
      parseImageToolActionFromMessage(result.message) ??
      parseImageToolActionFromText(content);
    if (imageAction && options?.imageTool?.imageModelConfigId) {
      yield* this.executeImageToolAction(userId, options.imageTool, imageAction);
      return;
    }

    yield { type: 'llm_token', stepKey: 'chat', content };
  }

  private async resolveDefaultModelId(userId: string): Promise<string> {
    const m = await this.modelConfigService.findDefaultByTypeForUser(ModelType.general, userId);
    if (!m) throw new Error('未配置默认模型');
    return m.id;
  }

  private buildUserMessage(message: string, images?: string[]): HumanMessage {
    if (!images?.length) return new HumanMessage(message);

    return new HumanMessage({
      content: [
        { type: 'text', text: message },
        ...images.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ],
    });
  }

  private async renderSystemPrompt(imageTool?: ChatFallbackImageToolOptions) {
    if (!imageTool) {
      return this.systemPromptService.render('assistant.general', {
        language: 'zh-CN',
        appName: 'Autix',
      });
    }

    return this.systemPromptService.render('assistant.generalWithImageTool', {
      language: 'zh-CN',
      appName: 'Autix',
      templateTitle: imageTool.template.title,
      templatePrompt: imageTool.template.prompt,
      templateVariables: JSON.stringify(imageTool.template.variables ?? []),
      sourceImages: imageTool.sourceImages?.length
        ? imageTool.sourceImages
          .map((image, index) => `${index + 1}. ${image.url}${image.prompt ? ` | prompt: ${image.prompt}` : ''}`)
          .join('\n')
        : '',
      referenceImages: imageTool.referenceImages?.length
        ? imageTool.referenceImages
          .map((image, index) => `${index + 1}. ${image.url}${image.prompt ? ` | note: ${image.prompt}` : ''}`)
          .join('\n')
        : '',
    });
  }

  private async *executeImageToolAction(
    userId: string,
    tool: ChatFallbackImageToolOptions,
    action: ImageToolAction,
  ): AsyncGenerator<WorkflowStepEvent> {
    const prompt = action.type === 'generate_image' ? action.prompt : action.instruction;
    const imageRefs = this.resolveImageToolRefs(action, tool);
    const resolveInput = {
      userId,
      conversationId: tool.conversationId,
      templateId: tool.template.id,
      modelConfigId: tool.imageModelConfigId!,
      promptOverride: prompt,
      sourceImages: imageRefs.sourceImages,
      referenceImages: imageRefs.referenceImages,
      settings: {
        ...tool.settings,
        skipPromptTuning: true,
      },
    };
    const request = await this.imageGenerationFlowService.resolveImageRequest(resolveInput);
    const taskId = `chat-image-tool:${userId}:${Date.now()}`;

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

  private resolveImageToolRefs(
    action: ImageToolAction,
    tool: ChatFallbackImageToolOptions,
  ): { sourceImages?: SourceImageRef[]; referenceImages?: SourceImageRef[] } {
    if (action.type === 'generate_image') {
      return { referenceImages: tool.referenceImages };
    }

    if (tool.sourceImages?.length) {
      return {
        sourceImages: tool.sourceImages,
        referenceImages: tool.referenceImages,
      };
    }

    return { sourceImages: tool.referenceImages };
  }

}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
