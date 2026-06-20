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
import {
  asImageFlowRecord,
  buildGeneratedImageItems,
  buildImageConversationSummary,
  buildImageConversationContent,
  buildImageGenerationEstimateInput,
  buildImageGenerationHoldMetadata,
  buildImageGenerationHoldRemark,
  buildImageResultMessageMetadata,
  buildPersistedImageVariables,
  buildPromptOptimizeEstimateInput,
  buildPromptOptimizeHoldMetadata,
  buildPromptOptimizeHoldRemark,
  buildPromptRefinementPayload,
  buildPromptSummaryPayload,
  findLastGeneratedPrompt,
  isImageDataUrl,
  selectImageReferenceUrl,
  shouldTuneWorkbenchPrompt,
} from './image-generation-flow.helpers';

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
    return buildImageConversationSummary(messages);
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
        lastGeneratedPrompt: findLastGeneratedPrompt(messages),
        userId: input.userId,
        chatModelId: input.chatModelId,
      });
    } else if (input.chatModelId && shouldTuneWorkbenchPrompt(input.settings)) {
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
    const metadata = asImageFlowRecord(imageModel.metadata);
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
    const payload = buildPromptSummaryPayload(input);

    const result = await model.invoke([
      new SystemMessage(system.content),
      this.buildWorkbenchHumanMessage(payload.userText, config, payload.imageUrls),
    ]);

    const content =
      typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);
    return content.trim();
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
    const payload = buildPromptRefinementPayload(input);

    const system = await this.systemPromptService.render('image.promptEditor');

    const inputTokens = estimateTextTokens(`${system.content}\n\n${payload.userText}`);
    const estimatedOutputTokens = Math.max(128, estimateTextTokens(input.prompt));
    const hold = await this.createPromptOptimizeHold(input, config, {
      inputTokens,
      outputTokens: estimatedOutputTokens,
    });
    try {
      const result = await model.invoke([
        new SystemMessage(system.content),
        this.buildWorkbenchHumanMessage(payload.userText, config, payload.imageUrls),
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
    const estimate = await this.pointsService.estimateCost(
      buildPromptOptimizeEstimateInput(PROMPT_OPTIMIZE_TASK_TYPE, config, tokens),
    );

    const { hold } = await this.pointsService.createHold(input.userId, {
      taskType: PROMPT_OPTIMIZE_TASK_TYPE,
      taskId,
      amount: estimate.estimatedCost,
      pricingSnapshot: this.toJson(estimate.pricingSnapshot),
      refundPolicySnapshot: estimate.refundPolicy
        ? this.toJson(estimate.refundPolicy)
        : undefined,
      metadata: this.toJson(
        buildPromptOptimizeHoldMetadata({ ...input, config, tokens }),
      ),
      remark: buildPromptOptimizeHoldRemark(config.provider, config.model),
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

  async uploadGeneratedImage(image: string): Promise<string> {
    if (!isImageDataUrl(image)) return image;
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
      const estimate = await this.pointsService.estimateCost(
        buildImageGenerationEstimateInput(request, normalizedCount),
      );

      const { hold } = await this.pointsService.createHold(input.userId, {
        taskType: estimate.taskType,
        taskId: billingTaskId,
        amount: estimate.estimatedCost,
        pricingSnapshot: this.toJson(estimate.pricingSnapshot),
        refundPolicySnapshot: this.toJson(estimate.refundPolicy),
        metadata: this.toJson(buildImageGenerationHoldMetadata(input, request)),
        remark: buildImageGenerationHoldRemark(estimate.taskType),
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
    if (!ref || !isImageDataUrl(ref.url)) return ref;
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
    const referenceImageUrl = selectImageReferenceUrl(
      normalizedSourceImages,
      normalizedReferenceImages,
    );
    const persistedVariables = this.toJson(
      buildPersistedImageVariables(
        request,
        input,
        normalizedSourceImages,
        normalizedReferenceImages,
      ),
    );

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
          conversationContent: buildImageConversationContent(images),
          buildImageItems: (generationId) =>
            buildGeneratedImageItems({
              images,
              generationId,
              prompt: request.prompt,
              sourceImages: normalizedSourceImages,
              referenceImages: normalizedReferenceImages,
            }),
          buildMessageMetadata: (generationId, items) =>
            buildImageResultMessageMetadata({
              generationId,
              templateId: input.templateId,
              request,
              images: items,
              sourceImages: normalizedSourceImages,
              referenceImages: normalizedReferenceImages,
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

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
