import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  MessageRole,
  ModelType,
  PointHoldStatus,
  type Prisma,
} from '../../../platform/prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../../model-config/model-config.service';
import { ImageTemplatesService } from '../../../marketplace/image-templates/image-templates.service';
import { PointsService } from '../../../billing/points/points.service';
import { InviteService } from '../../../billing/invite/invite.service';
import { CampaignRewardService } from '../../../billing/campaign/campaign-reward.service';
import { createChatModelFromDbConfig } from '../model.factory';
import { SystemPromptService } from '../../../platform/system-settings/system-prompt.service';
import { estimateTextTokens, extractTokenUsage } from '../billing/token-estimation';
import { LlmRepository } from '../llm.repository';
import { resolveImageAdapter } from '@autix/ai-adapters/image';
import {
  buildImageWorkbenchPrompt,
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
} from '@autix/domain/image';
import {
  buildUnsupportedImageParamsException,
  isUpstreamImageParamsError,
  normalizeImageCallParams,
  type AppliedImageSettings,
  type CallImageApiResult,
  type ImageGenerationSettings,
  type ResolvedImageRequest,
  type SourceImageRef,
} from './image-generation-call-params';

export type {
  AppliedImageSettings,
  CallImageApiResult,
  ImageGenerationSettings,
  ResolvedImageRequest,
  SourceImageRef,
} from './image-generation-call-params';

const PROMPT_OPTIMIZE_TASK_TYPE = 'prompt_optimize_generation';

export interface PersistedImageResult {
  generation: unknown;
  images: Array<{
    url: string;
    index: number;
    generationId: string;
    prompt: string;
    sourceImages?: SourceImageRef[];
    referenceImages?: SourceImageRef[];
  }>;
}

export interface GenerateAndPersistImageResult extends PersistedImageResult {
  appliedSettings: AppliedImageSettings;
  prompt: string;
  model: string;
}

export interface ResolveImageRequestInput {
  userId: string;
  conversationId?: string;
  templateId: string;
  modelConfigId: string;
  chatModelId?: string;
  variables?: Record<string, string>;
  promptOverride?: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  editInstruction?: string;
  settings?: ImageGenerationSettings;
}

export interface RefineWorkbenchPromptInput {
  mode: 'generate' | 'edit';
  prompt: string;
  imageModelConfigId: string;
  chatModelId?: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: ImageGenerationSettings;
}

export interface RefineWorkbenchPromptResult {
  originalPrompt: string;
  composedPrompt: string;
  refinedPrompt: string;
  model: string;
  chatModel: string;
  additions: string[];
}

interface ChatModelConfigLike {
  id: string;
  model: string;
  provider?: string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
  metadata?: unknown;
  type: string;
  capabilities?: string[] | null;
}

interface SummaryInput {
  mode: 'generate' | 'edit';
  template: { prompt: string; title?: string | null };
  variables: Record<string, string>;
  conversationSummary: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  editInstruction?: string;
  lastGeneratedPrompt?: string;
  userId: string;
  chatModelId?: string;
}

@Injectable()
export class ImageGenerationFlowService {
  private readonly logger = new Logger(ImageGenerationFlowService.name);

  constructor(
    private readonly repository: LlmRepository,
    private readonly modelConfigService: ModelConfigService,
    private readonly imageTemplatesService: ImageTemplatesService,
    private readonly pointsService: PointsService,
    private readonly inviteService: InviteService,
    private readonly campaignRewardService: CampaignRewardService,
    private readonly systemPromptService: SystemPromptService,
  ) { }

  buildConversationSummary(
    messages: Array<{
      role: MessageRole | 'USER' | 'ASSISTANT';
      content: string;
      metadata?: unknown;
    }>,
  ): string {
    const lines: string[] = [];
    const recentUserMessages = messages
      .filter((m) => String(m.role) === 'USER')
      .slice(-3);

    for (const message of messages) {
      const metadata = this.asRecord(message.metadata);
      const messageType = metadata?.messageType;

      if (String(message.role) === 'USER') {
        if (recentUserMessages.includes(message)) {
          lines.push(`User: ${message.content}`);
        }
        continue;
      }

      if (messageType === 'prompt_suggestion' && typeof metadata?.prompt === 'string') {
        lines.push(`Prompt suggestion: ${metadata.prompt}`);
      }

      if (messageType === 'edit_suggestion' && typeof metadata?.instruction === 'string') {
        lines.push(`Edit suggestion: ${metadata.instruction}`);
      }

      if (messageType === 'image_result') {
        if (typeof metadata?.prompt === 'string') {
          lines.push(`Generated prompt: ${metadata.prompt}`);
        }
        const images = Array.isArray(metadata?.images) ? metadata.images : [];
        for (const image of images) {
          const imageRecord = this.asRecord(image);
          if (typeof imageRecord?.url === 'string') {
            lines.push(
              `Generated image: ${imageRecord.url}${typeof imageRecord.prompt === 'string'
                ? ` | prompt: ${imageRecord.prompt}`
                : ''
              }`,
            );
          }
        }
      }
    }

    return lines.join('\n').slice(0, 12000);
  }

  async resolveImageRequest(
    input: ResolveImageRequestInput,
  ): Promise<ResolvedImageRequest> {
    const template = (await this.imageTemplatesService.findById(
      input.templateId,
    )) as { prompt: string; title?: string | null };
    const variables = input.variables ?? {};
    const mode = input.sourceImages?.length ? 'edit' : 'generate';
    const modelConfig = await this.modelConfigService.getConfigForOrchestrator(
      input.modelConfigId,
    );

    let prompt = input.promptOverride?.trim();
    if (!prompt) {
      if (!input.conversationId) {
        throw new BadRequestException('Missing conversationId for prompt summarization');
      }
      const messages = await this.repository.findAllConversationMessages(
        input.conversationId,
      );
      const conversationSummary = this.buildConversationSummary(messages);
      prompt = await this.summarizePrompt({
        mode,
        template,
        variables,
        conversationSummary,
        sourceImages: input.sourceImages,
        referenceImages: input.referenceImages,
        editInstruction: input.editInstruction,
        lastGeneratedPrompt: this.findLastGeneratedPrompt(messages),
        userId: input.userId,
        chatModelId: input.chatModelId,
      });
    } else if (input.chatModelId && this.shouldTuneWorkbenchPrompt(input.settings)) {
      prompt = await this.tuneWorkbenchPrompt({
        mode,
        template,
        prompt,
        sourceImages: input.sourceImages,
        referenceImages: input.referenceImages,
        settings: input.settings,
        userId: input.userId,
        chatModelId: input.chatModelId,
      });
    }

    return {
      mode,
      prompt,
      modelConfig,
      template: template as Record<string, unknown>,
      variables,
      sourceImages: input.sourceImages,
      referenceImages: input.referenceImages,
      settings: input.settings,
    };
  }

  async refineWorkbenchPrompt(
    userId: string,
    input: RefineWorkbenchPromptInput,
  ): Promise<RefineWorkbenchPromptResult> {
    const imageModel = await this.modelConfigService.getConfigForOrchestrator(
      input.imageModelConfigId,
    );
    const metadata = this.asRecord(imageModel.metadata);
    const kind = detectImageModelKind({
      provider: imageModel.provider ?? undefined,
      model: imageModel.model,
      metadata,
    });
    const capability = IMAGE_MODEL_CAPABILITIES[kind];
    const composed = buildImageWorkbenchPrompt(input.prompt, input.settings, capability, {
      includePromptTuning: true,
    });
    const chatConfig = input.chatModelId
      ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelId)
      : await this.modelConfigService.findDefaultByType(ModelType.general);

    if (!chatConfig) {
      throw new BadRequestException({
        errorCode: 'ERR_DEFAULT_GENERAL_MODEL_MISSING',
        message: 'No default general model configured for prompt refinement',
      });
    }

    const refinedPrompt = await this.tuneWorkbenchPrompt({
      mode: input.mode,
      template: {
        title: '专业图片工作台',
        prompt: '{{prompt}}',
      },
      prompt: composed.prompt,
      sourceImages: input.sourceImages,
      referenceImages: input.referenceImages,
      settings: {
        ...input.settings,
        imageModelKind: kind,
        imageModelName: imageModel.model,
      },
      userId,
      chatModelConfig: chatConfig,
    });

    return {
      originalPrompt: input.prompt,
      composedPrompt: composed.prompt,
      refinedPrompt,
      model: imageModel.model,
      chatModel: chatConfig.model,
      additions: composed.additions,
    };
  }

  async summarizePrompt(input: SummaryInput): Promise<string> {
    const config = input.chatModelId
      ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelId)
      : await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!config) {
      throw new BadRequestException({
        errorCode: 'ERR_DEFAULT_GENERAL_MODEL_MISSING',
        message: 'No default general model configured for prompt summarization',
      });
    }

    const caps: string[] = config.capabilities ?? [];
    const CHAT_CAPS = ['text', 'vision', 'code', 'reasoning'];
    const supportsChat = caps.length === 0 || CHAT_CAPS.some((c) => caps.includes(c));
    if (!supportsChat) {
      throw new BadRequestException({
        errorCode: 'ERR_CHAT_MODEL_INVALID',
        message: `Model ${config.id} does not support chat completion`,
      });
    }

    const model = createChatModelFromDbConfig(config);
    const system = await this.systemPromptService.render('image.promptCompressor');
    const sourceImages = input.sourceImages
      ?.map((img, index) => this.formatPromptImageRef(img, index, 'original prompt'))
      .join('\n');
    const referenceImages = input.referenceImages
      ?.map((img, index) => this.formatPromptImageRef(img, index, 'reference note'))
      .join('\n');
    const imageUrls = this.collectPromptImageUrls(input.sourceImages, input.referenceImages);
    const userText = [
      `Mode: ${input.mode}`,
      `Template title: ${input.template.title ?? ''}`,
      `Template prompt: ${input.template.prompt}`,
      `Variables: ${JSON.stringify(input.variables)}`,
      input.lastGeneratedPrompt
        ? `Last generated prompt: ${input.lastGeneratedPrompt}`
        : '',
      sourceImages ? `Source images:\n${sourceImages}` : '',
      referenceImages ? `Reference images (visual guidance only, not edit targets):\n${referenceImages}` : '',
      input.editInstruction
        ? `Latest edit instruction: ${input.editInstruction}`
        : '',
      `Conversation summary:\n${input.conversationSummary}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await model.invoke([
      new SystemMessage(system.content),
      this.buildWorkbenchHumanMessage(userText, config, imageUrls),
    ]);

    const content =
      typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);
    return content.trim();
  }

  private shouldTuneWorkbenchPrompt(settings?: ImageGenerationSettings): boolean {
    if (!settings) return false;
    if (settings.skipPromptTuning === true) return false;
    const promptTuning = String(settings.promptTuning ?? '');
    return Boolean(promptTuning && promptTuning !== '忠实原文');
  }

  private formatPromptImageRef(
    img: SourceImageRef,
    index: number,
    promptLabel: string,
  ): string {
    const url = this.isImageDataUrl(img.url)
      ? `[uploaded image data: ${img.url.slice(0, 32)}...]`
      : img.url;
    return `${index + 1}. ${url}${img.prompt ? ` | ${promptLabel}: ${img.prompt}` : ''}`;
  }

  private collectPromptImageUrls(
    sourceImages?: SourceImageRef[],
    referenceImages?: SourceImageRef[],
  ): string[] {
    return [
      ...(sourceImages ?? []),
      ...(referenceImages ?? []),
    ].map((img) => img.url);
  }

  private buildWorkbenchHumanMessage(
    text: string,
    config: ChatModelConfigLike,
    imageUrls: string[],
  ): HumanMessage {
    if (imageUrls.length === 0) return new HumanMessage(text);

    const caps: string[] = config.capabilities ?? [];
    const supportsVision = caps.length === 0 || caps.includes('vision');
    if (!supportsVision) {
      throw new BadRequestException({
        errorCode: 'ERR_CHAT_MODEL_VISION_REQUIRED',
        message: '所选 Prompt 微调模型不支持图片理解，请选择支持图片理解的模型或移除参考图。',
      });
    }

    return new HumanMessage({
      content: [
        { type: 'text', text },
        ...imageUrls.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ],
    });
  }

  private async tuneWorkbenchPrompt(input: {
    mode: 'generate' | 'edit';
    template: { prompt: string; title?: string | null };
    prompt: string;
    sourceImages?: SourceImageRef[];
    referenceImages?: SourceImageRef[];
    settings?: ImageGenerationSettings;
    userId: string;
    chatModelId?: string;
    chatModelConfig?: ChatModelConfigLike;
  }): Promise<string> {
    const config = input.chatModelConfig ??
      (input.chatModelId
        ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelId)
        : await this.modelConfigService.findDefaultByType(ModelType.general));

    if (!config) {
      throw new BadRequestException({
        errorCode: 'ERR_DEFAULT_GENERAL_MODEL_MISSING',
        message: 'No default general model configured for prompt refinement',
      });
    }

    const caps: string[] = config.capabilities ?? [];
    const chatCaps = ['text', 'vision', 'code', 'reasoning'];
    const supportsChat = caps.length === 0 || chatCaps.some((c) => caps.includes(c));
    if (!supportsChat) {
      throw new BadRequestException({
        errorCode: 'ERR_CHAT_MODEL_INVALID',
        message: `Model ${config.id} does not support chat completion`,
      });
    }

    const model = createChatModelFromDbConfig(config);
    const sourceImages = input.sourceImages
      ?.map((img, index) => this.formatPromptImageRef(img, index, 'source prompt'))
      .join('\n');
    const referenceImages = input.referenceImages
      ?.map((img, index) => this.formatPromptImageRef(img, index, 'reference note'))
      .join('\n');
    const imageUrls = this.collectPromptImageUrls(input.sourceImages, input.referenceImages);
    const userText = [
      `Mode: ${input.mode}`,
      `Template title: ${input.template.title ?? ''}`,
      `Template prompt: ${input.template.prompt}`,
      `User prompt:\n${input.prompt}`,
      `Prompt tuning: ${input.settings?.promptTuning ?? ''}`,
      `Style preset: ${input.settings?.stylePreset ?? ''}`,
      `Negative prompt: ${input.settings?.negativePrompt ?? ''}`,
      sourceImages ? `Source images:\n${sourceImages}` : '',
      referenceImages ? `Reference images:\n${referenceImages}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const system = await this.systemPromptService.render('image.promptEditor');

    const inputTokens = estimateTextTokens(`${system.content}\n\n${userText}`);
    const estimatedOutputTokens = Math.max(128, estimateTextTokens(input.prompt));
    const hold = await this.createPromptOptimizeHold(input, config, {
      inputTokens,
      outputTokens: estimatedOutputTokens,
    });
    try {
      const result = await model.invoke([
        new SystemMessage(system.content),
        this.buildWorkbenchHumanMessage(userText, config, imageUrls),
      ]);

      const content =
        typeof result.content === 'string'
          ? result.content
          : JSON.stringify(result.content);
      await this.confirmPromptOptimizeHold(hold, config, result, content);
      return content.trim() || input.prompt;
    } catch (err) {
      await this.safeRefundPromptOptimizeHold(hold.holdId, 'Prompt 优化失败');
      throw err;
    }
  }

  private async createPromptOptimizeHold(
    input: {
      userId: string;
      mode: 'generate' | 'edit';
      prompt: string;
      sourceImages?: SourceImageRef[];
      referenceImages?: SourceImageRef[];
    },
    config: ChatModelConfigLike,
    tokens: { inputTokens: number; outputTokens: number },
  ): Promise<{ holdId: string; estimatedCost: number; inputTokens: number; outputTokens: number }> {
    const taskId = `prompt-optimize:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const estimate = await this.pointsService.estimateCost({
      taskType: PROMPT_OPTIMIZE_TASK_TYPE,
      modelProvider: config.provider ?? undefined,
      modelName: config.model,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
    });

    const { hold } = await this.pointsService.createHold(input.userId, {
      taskType: PROMPT_OPTIMIZE_TASK_TYPE,
      taskId,
      amount: estimate.estimatedCost,
      pricingSnapshot: this.toJson(estimate.pricingSnapshot),
      refundPolicySnapshot: estimate.refundPolicy
        ? this.toJson(estimate.refundPolicy)
        : undefined,
      metadata: this.toJson({
        mode: input.mode,
          promptLength: input.prompt.length,
          modelConfigId: config.id,
          modelName: config.model,
          inputTokens: tokens.inputTokens,
          estimatedOutputTokens: tokens.outputTokens,
          referenceImages:
            (input.sourceImages?.length ?? 0) +
            (input.referenceImages?.length ?? 0),
        }),
      remark: `图片工作台 Prompt AI 优化 · ${this.formatBillingModel(config.provider, config.model)}`,
    });
    return {
      holdId: hold.id,
      estimatedCost: estimate.estimatedCost,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
    };
  }

  private async confirmPromptOptimizeHold(
    hold: { holdId: string; estimatedCost: number; inputTokens: number },
    config: ChatModelConfigLike,
    result: unknown,
    content: string,
  ) {
    const usage = extractTokenUsage(result);
    try {
      const actualEstimate = await this.pointsService.estimateCost({
        taskType: PROMPT_OPTIMIZE_TASK_TYPE,
        modelProvider: config.provider ?? undefined,
        modelName: config.model,
        inputTokens: usage.inputTokens ?? hold.inputTokens,
        outputTokens: usage.outputTokens ?? estimateTextTokens(content),
        contextTokens: usage.contextTokens,
      });
      await this.pointsService.confirmHold(
        hold.holdId,
        Math.min(actualEstimate.estimatedCost, hold.estimatedCost),
      );
    } catch {
      await this.pointsService.confirmHold(hold.holdId);
    }
  }

  private formatBillingModel(provider: string | null | undefined, model: string): string {
    return [provider, model].filter(Boolean).join('/') || model;
  }

  private async safeRefundPromptOptimizeHold(holdId: string, reason: string) {
    try {
      await this.pointsService.refundHold(holdId, reason);
    } catch (err) {
      this.logger.error(
        `prompt optimize point hold refund failed: hold=${holdId} reason=${String(
          err instanceof Error ? err.message : err,
        )}`,
      );
    }
  }

  async callImageApi(
    request: ResolvedImageRequest,
    count: number,
  ): Promise<CallImageApiResult> {
    const params = normalizeImageCallParams(request, count);

    if (!params.primaryContext.baseUrl || !params.primaryContext.apiKey) {
      throw new BadRequestException('图片模型缺少 baseUrl 或 apiKey 配置');
    }

    if (params.primaryAppliedSettings.notes.length > 0) {
      this.logger.warn(
        `coerceImageParams adjusted ${request.modelConfig.model} (kind=${params.kind}): ${params.primaryAppliedSettings.notes.join('; ')}`,
      );
    }

    const adapter = resolveImageAdapter(request.modelConfig.provider, params.metadata);
    const dispatch = (ctx: typeof params.primaryContext): Promise<string[]> =>
      request.mode === 'edit' ? adapter.edit(ctx) : adapter.generate(ctx);

    try {
      const images = await dispatch(params.primaryContext);
      return {
        images,
        appliedSettings: params.primaryAppliedSettings,
      };
    } catch (err) {
      if (!isUpstreamImageParamsError(err)) throw err;

      this.logger.warn(
        `upstream 4xx for ${request.modelConfig.model} (kind=${params.kind}); retrying with safe defaults size=${params.safeDefaults.size} quality=${params.safeDefaults.quality ?? '-'} count=${params.safeDefaults.count}. reason=${err instanceof Error ? err.message : String(err)
        }`,
      );

      try {
        const images = await dispatch(params.safeContext);
        return {
          images,
          appliedSettings: params.safeAppliedSettings,
        };
      } catch (retryErr) {
        if (!isUpstreamImageParamsError(retryErr)) throw retryErr;
        throw buildUnsupportedImageParamsException(
          request,
          params.kind,
          err,
          retryErr,
        );
      }
    }
  }

  private static readonly IMAGE_DATA_URL_RE = /^data:image\/(\w+);base64,/i;

  private isImageDataUrl(value: string | undefined | null): value is string {
    return typeof value === 'string' && ImageGenerationFlowService.IMAGE_DATA_URL_RE.test(value);
  }

  async uploadGeneratedImage(image: string): Promise<string> {
    if (!this.isImageDataUrl(image)) return image;
    return this.imageTemplatesService.uploadBase64Image(
      image,
      'amux-studio/image-generations',
    );
  }

  async uploadGeneratedImages(images: string[]): Promise<string[]> {
    if (!Array.isArray(images) || images.length === 0) return [];
    const results = await Promise.allSettled(
      images.map((image) => this.uploadGeneratedImage(image)),
    );
    return results.map((res, idx) => {
      if (res.status === 'fulfilled') return res.value;
      const original = images[idx];
      const preview = typeof original === 'string' ? original.slice(0, 32) : '';
      const sizeHint = typeof original === 'string' ? original.length : 0;
      this.logger.error(
        `uploadGeneratedImage failed at index=${idx} size=${sizeHint} head="${preview}" reason=${String(
          (res as PromiseRejectedResult).reason,
        )}`,
      );
      return original;
    });
  }

  async generateAndPersistImage(
    input: ResolveImageRequestInput,
    request: ResolvedImageRequest,
    count: number,
    options?: { persistedRequest?: ResolvedImageRequest },
  ): Promise<GenerateAndPersistImageResult> {
    const startedAt = Date.now();
    const normalizedCount = Math.max(1, Math.min(count, 4));
    const persistedRequest = options?.persistedRequest ?? request;
    const billingTaskId = `image:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    let holdId: string | null = null;

    if (!this.isOwnImageModel(input.userId, request)) {
      const estimate = await this.pointsService.estimateCost({
        taskType: this.resolveImagePricingTaskType(request),
        modelProvider: request.modelConfig.provider ?? undefined,
        modelName: request.modelConfig.model,
        quality: this.normalizeImageQuality(request.settings?.quality),
        resolution: request.settings?.size,
        quantity: normalizedCount,
        referenceImages:
          (request.sourceImages?.length ?? 0) +
          (request.referenceImages?.length ?? 0),
      });

      const { hold } = await this.pointsService.createHold(input.userId, {
        taskType: estimate.taskType,
        taskId: billingTaskId,
        amount: estimate.estimatedCost,
        pricingSnapshot: this.toJson(estimate.pricingSnapshot),
        refundPolicySnapshot: this.toJson(estimate.refundPolicy),
        metadata: this.toJson({
          templateId: input.templateId,
          modelConfigId: input.modelConfigId,
          conversationId: input.conversationId ?? null,
          mode: request.mode,
          prompt: request.prompt,
        }),
        remark: `image-generation:${estimate.taskType}`,
      });
      holdId = hold.id;
    }

    try {
      const { images, appliedSettings } = await this.callImageApi(
        request,
        normalizedCount,
      );
      const uploadedImages = await this.uploadGeneratedImages(images);
      const persisted = await this.persistImageResult(
        input,
        persistedRequest,
        uploadedImages,
        Date.now() - startedAt,
        { confirmHoldId: holdId },
      );

      const generationId =
        typeof (persisted.generation as { id?: unknown })?.id === 'string'
          ? (persisted.generation as { id: string }).id
          : billingTaskId;

      this.campaignRewardService
        .recordSuccessGeneration(input.userId, 'image', generationId)
        .catch((err) =>
          this.logger.warn(
            `recordSuccessGeneration (image) failed: user=${input.userId} reason=${(err as Error).message}`,
          ),
        );

      // P0-3: 图片生成成功后触发邀请奖励结算（幂等；无邀请记录或已结算时无副作用）
      this.inviteService
        .settleInvitationOnFirstGeneration(input.userId)
        .catch((err) =>
          this.logger.warn(
            `settleInvitationOnFirstGeneration (image) failed: user=${input.userId} reason=${(err as Error).message}`,
          ),
        );

      return {
        ...persisted,
        appliedSettings,
        prompt: request.prompt,
        model: request.modelConfig.model,
      };
    } catch (err) {
      if (holdId) {
        await this.safeRefundImageHold(holdId, '图片生成失败');
      }
      throw err;
    }
  }

  private async uploadRefIfDataUrl(
    ref: SourceImageRef | undefined,
  ): Promise<SourceImageRef | undefined> {
    if (!ref || !this.isImageDataUrl(ref.url)) return ref;
    try {
      const url = await this.imageTemplatesService.uploadBase64Image(
        ref.url,
        'amux-studio/image-generations',
      );
      return { ...ref, url };
    } catch (err) {
      this.logger.error(
        `uploadRefIfDataUrl failed: ${String(err instanceof Error ? err.message : err)}`,
      );
      return ref;
    }
  }

  private async normalizeRefImages(
    refs: SourceImageRef[] | undefined,
  ): Promise<SourceImageRef[] | undefined> {
    if (!refs || refs.length === 0) return refs;
    return Promise.all(refs.map((ref) => this.uploadRefIfDataUrl(ref))).then(
      (list) => list.filter((v): v is SourceImageRef => !!v),
    );
  }

  async persistImageResult(
    input: ResolveImageRequestInput,
    request: ResolvedImageRequest,
    images: string[],
    durationMs: number,
    options?: { confirmHoldId?: string | null },
  ): Promise<PersistedImageResult> {
    const normalizedSourceImages = await this.normalizeRefImages(request.sourceImages);
    const normalizedReferenceImages = await this.normalizeRefImages(request.referenceImages);
    const referenceImageUrl =
      normalizedSourceImages?.[0]?.url ?? normalizedReferenceImages?.[0]?.url;
    const persistedVariables = this.toJson({
      ...request.variables,
      __workbench: {
        mode: request.mode,
        sourceImages: normalizedSourceImages ?? [],
        referenceImages: normalizedReferenceImages ?? [],
        settings: request.settings ?? {},
        modelConfigId: input.modelConfigId,
        chatModelId: input.chatModelId ?? null,
      },
    });

    const imageItemsSeed = (generationId: string) =>
      images.map((url, index) => ({
        url,
        index,
        generationId,
        prompt: request.prompt,
        sourceImages: normalizedSourceImages,
        referenceImages: normalizedReferenceImages,
      }));

    const { generation, imageItems } =
      await this.repository.createCompletedImageGenerationResult(
        {
          templateId: input.templateId,
          userId: input.userId,
          modelUsed: request.modelConfig.model,
          resolvedPrompt: request.prompt,
          variables: persistedVariables,
          referenceImage: referenceImageUrl,
          generatedImages: images,
          durationMs,
          conversationId: input.conversationId,
          conversationContent: images.map((url) => `![](${url})`).join('\n'),
          buildImageItems: imageItemsSeed,
          buildMessageMetadata: (generationId, items) =>
            ({
              messageType: 'image_result',
              mode: request.mode,
              generationId,
              templateId: input.templateId,
              model: request.modelConfig.model,
              prompt: request.prompt,
              sourceImages: normalizedSourceImages,
              referenceImages: normalizedReferenceImages,
              settings: request.settings,
              images: items,
            }) as Prisma.InputJsonValue,
        },
        options?.confirmHoldId
          ? async (tx) => {
              const confirmation = await this.pointsService.confirmHoldWithinTx(
                tx,
                options.confirmHoldId!,
              );
              if (
                !confirmation.confirmed &&
                confirmation.hold.status === PointHoldStatus.REFUNDED
              ) {
                throw new BadRequestException(
                  '图片生成冻结已退款，不能完成资产入库',
                );
              }
            }
          : undefined,
      );

    return { generation, images: imageItems };
  }

  private isOwnImageModel(userId: string, request: ResolvedImageRequest): boolean {
    return request.modelConfig.createdBy === userId;
  }

  private normalizeImageQuality(value: unknown): 'low' | 'medium' | 'high' {
    const quality = String(value ?? 'medium').toLowerCase();
    if (quality.includes('low')) return 'low';
    if (quality.includes('high') || quality.includes('hd')) return 'high';
    return 'medium';
  }

  private resolveImagePricingTaskType(request: ResolvedImageRequest): string {
    const quality = this.normalizeImageQuality(request.settings?.quality);
    if (quality === 'low') return 'gpt_image_2_low';
    if (quality === 'high') return 'gpt_image_2_high';
    return 'gpt_image_2_medium';
  }

  private async safeRefundImageHold(holdId: string, reason: string) {
    try {
      await this.pointsService.refundHold(holdId, reason);
    } catch (err) {
      this.logger.error(
        `image generation point hold refund failed: hold=${holdId} reason=${String(
          err instanceof Error ? err.message : err,
        )}`,
      );
    }
  }

  private findLastGeneratedPrompt(messages: Array<{ metadata?: unknown }>): string | undefined {
    for (const message of [...messages].reverse()) {
      const metadata = this.asRecord(message.metadata);
      if (
        metadata?.messageType === 'image_result' &&
        typeof metadata.prompt === 'string'
      ) {
        return metadata.prompt;
      }
    }
    return undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
