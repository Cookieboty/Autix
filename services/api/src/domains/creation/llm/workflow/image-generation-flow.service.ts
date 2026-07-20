import { Injectable, BadRequestException } from '@nestjs/common';
import { AppLogger } from '../../../platform/common/app-logger';
import {
  MessageRole,
  ModelType,
  PointHoldStatus,
} from '../../../platform/prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../../model-config/model-config.service';
import { ImageTemplatesService } from '../../../marketplace/image-templates/image-templates.service';
import { PointsService } from '../../../billing/points/points.service';
import { MembershipService } from '../../../billing/membership/membership.service';
import { CampaignRewardService } from '../../../billing/campaign/campaign-reward.service';
import { createChatModelFromDbConfig } from '../model.factory';
import { SystemPromptService } from '../../../platform/system-settings/system-prompt.service';
import { estimateTextTokens, extractTokenUsage } from '../billing/token-estimation';
import { LlmRepository } from '../llm.repository';
import {
  executeImageCall,
  resolveImagePreset,
  ImageUpstreamError,
  type ProtocolPreset,
} from '@autix/ai-adapters/image';
import { readImageModelMetadata } from '@autix/domain/model';
import {
  buildImageCallRequest,
  buildImageModelNotConfiguredException,
  buildUnsupportedImageParamsException,
  narrowImageParamsSchema,
  toImageUrlOrDataUri,
  type AppliedImageSettings,
  type CallImageApiResult,
  type ImageGenerationSettings,
  type ResolvedImageRequest,
  type SourceImageRef,
} from './image-generation-call-params';
import {
  buildCompletedImageGenerationRepositoryInput,
  buildImageConversationSummary,
  buildImageGenerationEstimateInput,
  buildImageGenerationHoldCreateInput,
  buildImageGenerationSuccessResult,
  buildPromptOptimizeEstimateInput,
  assertPromptOptimizeInputWithinLimit,
  buildPromptOptimizeHoldCreateInput,
  buildPromptRefinementPayload,
  buildPromptSummaryPayload,
  buildRefineWorkbenchPromptPlan,
  buildRefineWorkbenchPromptResult,
  buildResolvedImageRequest,
  buildWorkbenchHumanMessageContent,
  findLastGeneratedPrompt,
  getUploadFailureLogDetails,
  isImageDataUrl,
  normalizeImageGenerationCount,
  normalizePromptOverride,
  resolvePersistedGenerationId,
  resolveImageRequestMode,
  shouldTuneWorkbenchPrompt,
  supportsImagePromptChatModel,
  supportsImagePromptVision,
} from './image-generation-flow.helpers';
// isUserOwnedImageModel 已移除：自有模型不再免费，图片生成始终计费。
import { assertImageHardLimits, resolveImageCountCeiling } from './image-generation-flow.risk';
import { IMAGE_GENERATION_TASK_TYPE } from './image-generation-flow.holds';

export type {
  AppliedImageSettings,
  CallImageApiResult,
  ImageGenerationSettings,
  ResolvedImageRequest,
  SourceImageRef,
} from './image-generation-call-params';

const PROMPT_OPTIMIZE_TASK_TYPE = 'prompt_optimize_generation';

/** 上游错误体单条日志上限：够看清错误码/message，又不至于把整份回显（可能含用户 prompt）灌进日志。 */
const UPSTREAM_BODY_LOG_LIMIT = 512;

/**
 * 上游错误体完全由 provider 控制，长度无上限，且 classification='params' 时常把我们提交的
 * 请求（含用户 prompt）原样回显。落日志前统一截断，超长时标注原始长度便于判断是否被截。
 */
function truncateUpstreamBody(body: string | undefined): string {
  if (!body) return '-';
  if (body.length <= UPSTREAM_BODY_LOG_LIMIT) return body;
  return `${body.slice(0, UPSTREAM_BODY_LOG_LIMIT)}…[truncated, total=${body.length}]`;
}

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
  private readonly logger = new AppLogger(ImageGenerationFlowService.name);

  constructor(
    private readonly repository: LlmRepository,
    private readonly modelConfigService: ModelConfigService,
    private readonly imageTemplatesService: ImageTemplatesService,
    private readonly pointsService: PointsService,
    private readonly campaignRewardService: CampaignRewardService,
    private readonly systemPromptService: SystemPromptService,
    private readonly membershipService: MembershipService,
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
    const mode = resolveImageRequestMode(input);
    const modelConfig = await this.modelConfigService.getConfigForOrchestrator(
      input.modelConfigId,
      input.userId,
    );

    let prompt = normalizePromptOverride(input.promptOverride);
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

    return buildResolvedImageRequest({
      mode,
      prompt,
      modelConfig,
      template: template as Record<string, unknown>,
      variables,
      sourceImages: input.sourceImages,
      referenceImages: input.referenceImages,
      settings: input.settings,
    });
  }

  async refineWorkbenchPrompt(
    userId: string,
    input: RefineWorkbenchPromptInput,
  ): Promise<RefineWorkbenchPromptResult> {
    const imageModel = await this.modelConfigService.getConfigForOrchestrator(
      input.imageModelConfigId,
      userId,
    );
    const refinementPlan = buildRefineWorkbenchPromptPlan({
      prompt: input.prompt,
      settings: input.settings,
      imageModel,
    });
    const chatConfig = input.chatModelId
      ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelId, userId)
      : await this.modelConfigService.findDefaultByTypeForUser(ModelType.general, userId);

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
      prompt: refinementPlan.composedPrompt,
      sourceImages: input.sourceImages,
      referenceImages: input.referenceImages,
      settings: refinementPlan.tuningSettings,
      userId,
      chatModelConfig: chatConfig,
    });

    return buildRefineWorkbenchPromptResult({
      originalPrompt: input.prompt,
      composedPrompt: refinementPlan.composedPrompt,
      refinedPrompt,
      imageModel,
      chatModel: chatConfig,
      additions: refinementPlan.additions,
    });
  }

  async summarizePrompt(input: SummaryInput): Promise<string> {
    const config = input.chatModelId
      ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelId, input.userId)
      : await this.modelConfigService.findDefaultByTypeForUser(ModelType.general, input.userId);
    if (!config) {
      throw new BadRequestException({
        errorCode: 'ERR_DEFAULT_GENERAL_MODEL_MISSING',
        message: 'No default general model configured for prompt summarization',
      });
    }

    if (!supportsImagePromptChatModel(config)) {
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
    if (imageUrls.length > 0 && !supportsImagePromptVision(config)) {
      throw new BadRequestException({
        errorCode: 'ERR_CHAT_MODEL_VISION_REQUIRED',
        message: '所选 Prompt 微调模型不支持图片理解，请选择支持图片理解的模型或移除参考图。',
      });
    }

    const content = buildWorkbenchHumanMessageContent(text, imageUrls);
    return typeof content === 'string'
      ? new HumanMessage(content)
      : new HumanMessage({ content });
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
        ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelId, input.userId)
        : await this.modelConfigService.findDefaultByTypeForUser(ModelType.general, input.userId));

    if (!config) {
      throw new BadRequestException({
        errorCode: 'ERR_DEFAULT_GENERAL_MODEL_MISSING',
        message: 'No default general model configured for prompt refinement',
      });
    }

    if (!supportsImagePromptChatModel(config)) {
      throw new BadRequestException({
        errorCode: 'ERR_CHAT_MODEL_INVALID',
        message: `Model ${config.id} does not support chat completion`,
      });
    }

    const model = createChatModelFromDbConfig(config);
    const payload = buildPromptRefinementPayload(input);

    const system = await this.systemPromptService.render('image.promptEditor');

    const inputTokens = estimateTextTokens(`${system.content}\n\n${payload.userText}`);
    // FIX-18: 输入 token 绝对上限，拒绝超大上下文（防止上游 token 滥用/DoS）。
    assertPromptOptimizeInputWithinLimit(inputTokens);
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
      await this.confirmPromptOptimizeHold(hold, result, content);
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
  ): Promise<{
    holdId: string;
    estimatedCost: number;
    inputTokens: number;
    outputTokens: number;
    membershipLevel: number;
  }> {
    const taskId = `prompt-optimize:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const membershipLevel = await this.membershipService.resolveActiveMembershipLevel(input.userId);
    const estimate = await this.pointsService.estimateCost(
      buildPromptOptimizeEstimateInput(PROMPT_OPTIMIZE_TASK_TYPE, config, tokens, membershipLevel),
    );

    const { hold } = await this.pointsService.createHold(
      input.userId,
      buildPromptOptimizeHoldCreateInput({
        taskType: PROMPT_OPTIMIZE_TASK_TYPE,
        taskId,
        estimate,
        ...input,
        config,
        tokens,
      }),
    );
    return {
      holdId: hold.id,
      estimatedCost: estimate.estimatedCost,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      membershipLevel,
    };
  }

  // Settlement re-prices from the hold's frozen pricingSnapshot (quoteHoldFromSnapshot),
  // never from a live estimateCost() re-query — an admin price change must not
  // re-price a task already in flight. `membershipLevel` is no longer read here:
  // the discount is already baked into the snapshot captured at hold time.
  private async confirmPromptOptimizeHold(
    hold: { holdId: string; estimatedCost: number; inputTokens: number },
    result: unknown,
    content: string,
  ) {
    const usage = extractTokenUsage(result);
    try {
      const actualAmount = await this.pointsService.quoteHoldFromSnapshot(hold.holdId, {
        inputTokens: usage.inputTokens ?? hold.inputTokens,
        outputTokens: usage.outputTokens ?? estimateTextTokens(content),
        contextTokens: usage.contextTokens,
      });
      await this.pointsService.confirmHold(hold.holdId, actualAmount);
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
    // 提前解析一次 preset：只是为了拿 referenceMode（决定要不要在派发前转存 data: URL）。
    // buildImageCallRequest 内部还会再解析一次同一个 protocolKey —— 可接受的重复计算，
    // 不为此改 buildImageCallRequest 的签名。resolveImagePreset 抛的是裸 Error（ai-adapters
    // 是纯协议层），沿用 buildImageCallRequest 同款转换，保持「配置错误→400
    // ERR_IMAGE_MODEL_NOT_CONFIGURED，不是 500」这条既有契约。
    let preset: ProtocolPreset;
    try {
      preset = resolveImagePreset(
        readImageModelMetadata(request.modelConfig.metadata).protocolKey,
      );
    } catch (error) {
      throw buildImageModelNotConfiguredException(request, error);
    }

    // URL-only 上游（generate-json-url，如 Seedream）不认识 data: URL —— 派发前必须
    // 把参考图/源图转成存储 URL；转存失败必须 fail fast（绝不像 uploadRefIfDataUrl
    // 那样吞错回退 data URL，那会把整段 base64 直接怼给上游）。
    if (preset.referenceMode?.kind === 'generate-json-url') {
      request = {
        ...request,
        referenceImages: await this.uploadDataUrlsOrThrow(request.referenceImages),
        sourceImages: await this.uploadDataUrlsOrThrow(request.sourceImages),
      };
    }

    const paramsSchema = narrowImageParamsSchema(
      request.modelConfig.paramsSchema,
      request.modelConfig.id,
    );
    const callRequest = buildImageCallRequest(request, count, paramsSchema);

    if (!callRequest.baseUrl || !callRequest.apiKey) {
      throw new BadRequestException('图片模型缺少 baseUrl 或 apiKey 配置');
    }

    this.logger.log(
      `image api dispatch: mode=${request.mode} protocol=${callRequest.preset.key} operation=${callRequest.operation} baseUrl=${callRequest.baseUrl} model=${callRequest.model} count=${callRequest.count} params=${JSON.stringify(callRequest.params)} sourceImages=${callRequest.sourceImages?.length ?? 0} referenceImages=${callRequest.referenceImages?.length ?? 0}`,
    );

    try {
      const result = await executeImageCall(callRequest);

      if (result.warnings.length > 0) {
        this.logger.warn(
          `image api coercions: model=${callRequest.model} protocol=${callRequest.preset.key} ${result.warnings.join('; ')}`,
        );
      }
      this.logger.log(
        `image api result: mode=${request.mode} protocol=${result.upstream.protocolKey} model=${callRequest.model} count=${callRequest.count} imageCount=${result.artifacts.length} durationMs=${result.upstream.durationMs}`,
      );

      // ai-adapters 是纯协议层（spec §8）：artifact → data-uri / url 的转换留在这里。
      return {
        images: result.artifacts.map(toImageUrlOrDataUri),
        appliedSettings: {
          // 「真正发出去的值」（spec §4.4）—— 不是「我们打算发的值」。
          ...result.applied.params,
          count: callRequest.count,
          coerced: result.applied.coercions.length > 0,
          notes: result.applied.coercions,
        },
        // 派发前归一化（generate-json-url 转存）后的实际值——上面重赋值过的局部
        // `request`。generate-json-url 时是存储 URL；其它协议时与调用方传入的
        // 原值相同（未被此函数改动）。调用方（generateAndPersistImage）必须拿
        // 这份去持久化，而不是自己手上那份可能仍是 data: URL 的原始 request——
        // 否则 persistImageResult 的 normalizeRefImages 会对同一张图重新上传
        // 一次，且入库 URL 可能与已经发给上游的 URL 不一致（Finding LOW #2）。
        sourceImages: request.sourceImages,
        referenceImages: request.referenceImages,
      };
    } catch (error) {
      if (error instanceof ImageUpstreamError) {
        // 上游失败的完整链路快照：无论哪一类（503/429/超时/params…）都先落一条结构化日志，
        // 把「打的是哪个端点、上游回了什么」摊开——否则 503(upstream) 这类只会被最外层
        // AllExceptionsFilter 打成一句没有 body 的 Unhandled exception，根因（上游原文）丢失。
        this.logger.error(
          `image upstream failed: model=${callRequest.model} protocol=${callRequest.preset.key} operation=${callRequest.operation} status=${error.httpStatus ?? '-'} classification=${error.classification} retryable=${error.retryable} endpoint=${error.endpoint ?? '-'} requestId=${error.requestId ?? '-'} retryAfter=${error.retryAfter ?? '-'} body=${truncateUpstreamBody(error.upstreamBody)}`,
        );
      }
      if (error instanceof ImageUpstreamError && error.classification === 'params') {
        // 参数不被上游接受 —— **不再「换一组 safe defaults 重试」**。那套重试用的
        // safe defaults 仍是同一个 1024x1024@1K，从未修好过任何东西，只是把上游多打
        // 一次；真正的病根（kind 嗅探把 @tier token 发给不认识它的端点）已由 preset 的
        // stripTierSuffix 根除。保存期的跨配置校验器保证 schema 与 preset 自洽，
        // 参数错误此刻是配置错误，不是可重试的抖动。
        this.logger.warn(
          `image upstream rejected params: model=${callRequest.model} protocol=${callRequest.preset.key} status=${error.httpStatus ?? '-'} body=${truncateUpstreamBody(error.upstreamBody)}`,
        );
        throw buildUnsupportedImageParamsException(request, error);
      }
      throw error;
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
      const details = getUploadFailureLogDetails({
        image: original,
        index: idx,
        reason: (res as PromiseRejectedResult).reason,
      });
      this.logger.error(
        [
          `uploadGeneratedImage failed at index=${details.index}`,
          `size=${details.sizeHint}`,
          `head="${details.preview}"`,
          `reason=${details.reason}`,
        ].join(' '),
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
    // 张数在 dispatch 入口 clamp 一次：模型能力上限（metadata.limits.maxCount）∩ 风控硬上限。
    // adapter 层与 coerceImageParams 里的重复 clamp 已随 adapter 一起删除。
    const normalizedCount = normalizeImageGenerationCount(
      count,
      resolveImageCountCeiling(request.modelConfig.metadata),
    );
    const persistedRequest = options?.persistedRequest ?? request;
    const billingTaskId = `image:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    let holdId: string | null = null;
    const membershipLevel = await this.membershipService.resolveActiveMembershipLevel(input.userId);

    // FIX-4: 图片生成的两层服务端闸门（hold/调用之前）：
    //   1) 分级 entitlement（按会员等级限制分辨率/画质，默认宽松，可由 features.image 收紧）；
    //   2) 绝对硬上限（任何人不得突破的分辨率/数量上限，防滥用/DoS）。
    const imageEntitlement = await this.membershipService.resolveImageEntitlements(input.userId);
    this.membershipService.assertImageEntitlement(imageEntitlement, {
      size: request.settings?.size,
      quality: request.settings?.quality,
    });
    assertImageHardLimits({ size: request.settings?.size, count: normalizedCount });

    // FIX: 并发闸门 —— 统计在途 image_generation hold（PENDING/PROCESSING），
    // 达到等级 concurrency 即拒绝。必须在 createHold 之前，避免把自己算进去。
    const activeImageHolds = await this.pointsService.countActiveHoldsByType(
      input.userId,
      IMAGE_GENERATION_TASK_TYPE,
    );
    this.membershipService.assertImageConcurrency(activeImageHolds, imageEntitlement);

    const estimate = await this.pointsService.estimateCost(
      buildImageGenerationEstimateInput(request, membershipLevel),
    );

    const { hold } = await this.pointsService.createHold(
      input.userId,
      buildImageGenerationHoldCreateInput({
        taskId: billingTaskId,
        estimate,
        // 冻结额 = 单张价 × 张数（张数由业务逻辑计费，见 holds.ts 注释）。
        count: normalizedCount,
        requestInput: input,
        request,
      }),
    );
    holdId = hold.id;

    try {
      const {
        images,
        appliedSettings,
        sourceImages: dispatchedSourceImages,
        referenceImages: dispatchedReferenceImages,
      } = await this.callImageApi(request, normalizedCount);
      const uploadedImages = await this.uploadGeneratedImages(images);
      // 用 callImageApi 归一化（generate-json-url 转存）后的 sourceImages/
      // referenceImages 覆盖 persistedRequest 里的同名字段：persistImageResult
      // 的 normalizeRefImages 看到的必须是已经发给上游的那份 URL，不是原始
      // （可能仍是 data: URL 的）persistedRequest —— 否则会对同一张图二次上传，
      // 且入库 URL 可能与实际发给上游的不一致（Finding LOW #2）。
      const persistedRequestWithDispatchedRefs: ResolvedImageRequest = {
        ...persistedRequest,
        sourceImages: dispatchedSourceImages ?? persistedRequest.sourceImages,
        referenceImages: dispatchedReferenceImages ?? persistedRequest.referenceImages,
      };
      const persisted = await this.persistImageResult(
        input,
        persistedRequestWithDispatchedRefs,
        uploadedImages,
        Date.now() - startedAt,
        { confirmHoldId: holdId, membershipLevel, heldImageCount: normalizedCount, appliedSettings },
      );

      const generationId = resolvePersistedGenerationId(
        persisted.generation,
        billingTaskId,
      );

      this.campaignRewardService
        .recordSuccessGeneration(input.userId, 'image', generationId)
        .catch((err) =>
          this.logger.warn(
            `recordSuccessGeneration (image) failed: user=${input.userId} reason=${(err as Error).message}`,
          ),
        );

      return buildImageGenerationSuccessResult({
        persisted,
        appliedSettings,
        request,
      });
    } catch (err) {
      if (holdId) {
        await this.safeRefundImageHold(holdId, '图片生成失败');
      }
      throw err;
    }
  }

  /** URL-only 上游（generate-json-url）派发前必须把 data:URL 转存储 URL；失败 fail fast，绝不回退 data URL。 */
  private async uploadDataUrlsOrThrow(
    refs: SourceImageRef[] | undefined,
  ): Promise<SourceImageRef[] | undefined> {
    if (!refs?.length) return refs;
    return Promise.all(
      refs.map(async (ref) => {
        if (!isImageDataUrl(ref.url)) return ref;
        try {
          const url = await this.imageTemplatesService.uploadBase64Image(
            ref.url,
            'amux-studio/image-generations',
          );
          return { ...ref, url };
        } catch (err) {
          throw new BadRequestException(
            `参考图暂存失败：${String(err instanceof Error ? err.message : err)}`,
          );
        }
      }),
    );
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
    options?: {
      confirmHoldId?: string | null;
      membershipLevel?: number;
      heldImageCount?: number;
      appliedSettings?: AppliedImageSettings;
    },
  ): Promise<PersistedImageResult> {
    const normalizedSourceImages = await this.normalizeRefImages(request.sourceImages);
    const normalizedReferenceImages = await this.normalizeRefImages(request.referenceImages);
    // Settlement re-prices from the hold's frozen pricingSnapshot, never a live
    // estimateCost() re-query — an admin price change must not re-price a task
    // already in flight. Empty usage: there are no usage-source params for image
    // (quoteHoldFromSnapshot caps the per-image quote at the frozen amount).
    //
    // 张数由业务逻辑计费：snapshot 只算「单张」价，实际扣费 = 单张价 × 实际产图数。
    // billedImages 夹在 heldImageCount 内(冻结额 = 单张 × 张数),保证 confirm 金额
    // 绝不超过冻结额——否则 buildHoldConfirmationPlan 会「确认扣费不能超过冻结金额」抛错，
    // 而那时图已经生成。未产出的张数在 confirm 时按差额退回。
    const perImageAmount =
      options?.confirmHoldId && images.length > 0
        ? await this.pointsService.quoteHoldFromSnapshot(options.confirmHoldId, {})
        : null;
    const billedImages =
      options?.heldImageCount != null
        ? Math.min(images.length, Math.max(0, options.heldImageCount))
        : images.length;
    const actualAmount = perImageAmount === null ? null : perImageAmount * billedImages;
    if (options?.confirmHoldId && actualAmount !== null) {
      this.logger.log(
        `image generation hold actual cost: hold=${options.confirmHoldId} actualImages=${images.length} billedImages=${billedImages} perImage=${perImageAmount} actualAmount=${actualAmount}`,
      );
    }

    const { generation, imageItems } =
      await this.repository.createCompletedImageGenerationResult(
        buildCompletedImageGenerationRepositoryInput({
          requestInput: input,
          request,
          images,
          durationMs,
          sourceImages: normalizedSourceImages,
          referenceImages: normalizedReferenceImages,
          appliedSettings: options?.appliedSettings,
        }),
        options?.confirmHoldId
          ? async (tx) => {
              const confirmation = await this.pointsService.confirmHoldWithinTx(
                tx,
                options.confirmHoldId!,
                actualAmount ?? undefined,
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
}
