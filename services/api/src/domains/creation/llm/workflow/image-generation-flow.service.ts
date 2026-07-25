import { randomUUID } from 'node:crypto';
import { Injectable, BadRequestException, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../../platform/i18n/i18n-http.exception';
import { AppLogger } from '../../../platform/common/app-logger';
import {
  GenerationBillingStatus,
  GenerationErrorStage,
  GenerationKind,
  MessageRole,
  ModelType,
  PointHoldStatus,
} from '../../../platform/prisma/generated';
import { GenerationTaskRecorder } from '../../../platform/generation-tasks/generation-task.recorder';
import {
  fromImageUpstreamError,
  fromUnknown,
  readGenerationFailure,
  type GenerationFailure,
} from '../../../platform/generation-tasks/generation-failure';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../../model-config/model-config.service';
import { ImageTemplatesService } from '../../../marketplace/image-templates/image-templates.service';
import {
  PointsService,
  HoldConcurrencyLimitExceededError,
} from '../../../billing/points/points.service';
import { MembershipService } from '../../../billing/membership/membership.service';
import { ImageConcurrencyLimitException } from '../../../billing/membership/image-entitlement.helpers';
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
  buildImageParamsFailure,
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
    private readonly taskRecorder: GenerationTaskRecorder,
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
        title: 'Professional Image Workbench',
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
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.image_gen.model_no_vision', undefined, {
        data: { errorCode: 'ERR_CHAT_MODEL_VISION_REQUIRED' },
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
      await this.safeRefundPromptOptimizeHold(hold.holdId, 'Prompt optimization failed');
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
      throw new BadRequestException('The image model is missing baseUrl or apiKey configuration');
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
        // failure 与用户异常在同一处构造：结构化上游字段（upstreamBody / requestId /
        // classification）在这一行之后就再也拿不到了 —— 这里是最原始的位置。
        throw buildImageParamsFailure(request, error).exception;
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
    // 统一任务 ID：同时作为 generation_tasks.id 与 point_holds.taskId，让图片与视频的
    // 计费 join 语义一致（视频侧一直用 generationId）。客服按 hold 反查任务行才能落到实处。
    const generationTaskId = randomUUID();
    let holdId: string | null = null;
    // 失败落库的 stage：上游派发前恒为 SUBMIT，callImageApi 成功返回后（上传/落库/结算）
    // 全部算 PERSIST。这是唯一一处需要「当前走到哪了」的状态，故用可变量而非层层传参。
    let stage: GenerationErrorStage = GenerationErrorStage.SUBMIT;
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

    // 顺序是硬约束（spec §5.6）：预生成 id → start() → 建 hold → 打上游。
    //   · 早于建 hold：否则 hold.taskId 指向一条不存在的任务行，客服按 hold 反查落空；
    //   · 早于打上游：否则上游失败仍然零落库 —— 这正是本次要堵的缺口。
    // start() 不是 best-effort：任务行是生成的前置条件，写不进去就整个请求中止
    // （此刻还没冻结积分、没打上游，中止的代价最小）。
    //
    // 放在几道准入闸门（entitlement / 硬上限 / 并发 / 估价）**之后**：那些拒绝发生在
    // 任何花费与上游调用之前，用户拿到的是 4xx 参数错误，不是「一次失败的生成」；
    // 若提前到闸门之前，每次被拒都会留下一行永远不会收敛的 PENDING。
    await this.taskRecorder.start({
      id: generationTaskId,
      kind: GenerationKind.IMAGE,
      userId: input.userId,
      model: request.modelConfig.model,
      modelConfigId: request.modelConfig.id,
      provider: request.modelConfig.provider,
      prompt: request.prompt,
      paramsSnapshot: persistedRequest,
      materialCount:
        (request.referenceImages?.length ?? 0) + (request.sourceImages?.length ?? 0),
    });

    let hold: { id: string };
    try {
      ({ hold } = await this.pointsService.createHold(
        input.userId,
        buildImageGenerationHoldCreateInput({
          taskId: generationTaskId,
          estimate,
          // 冻结额 = 单张价 × 张数（张数由业务逻辑计费，见 holds.ts 注释）。
          count: normalizedCount,
          requestInput: input,
          request,
          // 原子并发闸门：createHold 在事务内串行校验，闭合预检查的 TOCTOU 竞态。
          concurrencyLimit: imageEntitlement.concurrency,
        }),
      ));
    } catch (err) {
      // 任务行已存在，冻结失败必须留痕（stage=BILLING），否则这行会永远 PENDING。
      await this.failTask(generationTaskId, fromUnknown(err, GenerationErrorStage.BILLING));
      // 原子闸门命中：换成用户可见的会员并发异常（含 code / data，供前端弹 modal）。
      if (err instanceof HoldConcurrencyLimitExceededError) {
        throw new ImageConcurrencyLimitException(
          imageEntitlement.levelName,
          imageEntitlement.concurrency,
          err.activeCount,
          1,
        );
      }
      throw err;
    }
    holdId = hold.id;
    // recordBilling(HELD) 是 hold 存在之后的第一个落点：顺带回填
    // generation_tasks.holdId（start() 时 hold 还没建，写不进去；此前没人回填过，
    // 导致图片侧这一列永远是 null，join 只能从 point_holds.taskId 反向走）。
    await this.taskRecorder.recordBilling(
      generationTaskId,
      GenerationBillingStatus.HELD,
      undefined,
      holdId,
    );

    // 成功之后（persistImageResult 已提交：image_generations 已建、任务行已
    // SUCCEEDED、hold 已 CONFIRMED）的收尾步骤——CONFIRMED 计费回写 / generationId
    // 解析 / 结果整形——若再抛出，不能落进下面 catch 里「这次生成失败」的处理：
    // 那会对已终态的行再走一次 failTask（CAS 判负→打假警报），并对已确认的 hold
    // 误触发退款、把 billingStatus 从 CONFIRMED 覆写成 REFUNDED/REFUND_FAILED。
    let succeeded = false;
    try {
      const {
        images,
        appliedSettings,
        sourceImages: dispatchedSourceImages,
        referenceImages: dispatchedReferenceImages,
      } = await this.callImageApi(request, normalizedCount);
      // 上游已经成功返回：此后的失败（转存/落库/结算）不再是 SUBMIT。
      stage = GenerationErrorStage.PERSIST;
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
        {
          confirmHoldId: holdId,
          membershipLevel,
          heldImageCount: normalizedCount,
          appliedSettings,
          generationTaskId,
          startedAt,
        },
      );
      // persistImageResult 已提交：任务行已 SUCCEEDED、hold 已 CONFIRMED。此刻之后
      // 的任何异常都不再是「这次生成失败」，见上方注释。
      succeeded = true;
      await this.taskRecorder.recordBilling(
        generationTaskId,
        GenerationBillingStatus.CONFIRMED,
      );

      const generationId = resolvePersistedGenerationId(
        persisted.generation,
        generationTaskId,
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
      if (succeeded) {
        // 生成本身已经成功（任务行 SUCCEEDED、hold 已 CONFIRMED）：这里的异常来自
        // 成功之后的收尾步骤，不是生成失败。既不打 CAS 判负的假警报，也不去退一笔
        // 已经确认的 hold、更不把 billingStatus 从 CONFIRMED 覆写回去 —— 只记录，
        // 原始异常照常抛出，让上层知道收尾这一步没完全做完。
        this.logger.error(
          `image generation post-success finalization failed (task already SUCCEEDED, not rolling back task status or triggering refund): ` +
            `task=${generationTaskId} reason=${String(err instanceof Error ? err.message : err)}`,
        );
        throw err;
      }
      // 先落任务终态，再退款：退款把钱还回去，任务行才是「这次为什么失败」的唯一证据。
      // 两者都不得掩盖原始异常 —— 用户/上层看到的必须还是那个真实的错误。
      await this.failTask(generationTaskId, resolveImageGenerationFailure(err, stage));
      if (holdId) {
        const refunded = await this.safeRefundImageHold(holdId, 'image generation failed');
        await this.taskRecorder.recordBilling(
          generationTaskId,
          refunded
            ? GenerationBillingStatus.REFUNDED
            : GenerationBillingStatus.REFUND_FAILED,
        );
      }
      throw err;
    }
  }

  /**
   * 失败终态落库。**永不抛** —— 它跑在 catch 里，抛出去只会把真正的失败原因换成
   * 一条数据库错误，用户与上层都再也看不到根因。
   *
   * CAS 判负在图片侧的含义与视频侧不同：视频侧要区分「行不存在（本特性上线前的存量
   * 生成）」与「行已终态（两表分叉）」；图片侧的任务行是本次请求刚 `start()` 出来的，
   * 不存在存量行，`start()` 失败已让请求中止。调用方现在也只在 `succeeded` 为
   * false（即生成本身尚未成功）时才会走到这里，所以不会再被「成功之后的收尾步骤
   * 失败」误触发。判负目前唯一已知成因是同一个 generationTaskId 被并发写了两次
   * 终态；但不排除未来新增别的终态写入路径（例如 PENDING/QUEUED 过期清扫）抢先
   * 落库——判负日志按可能成因罗列，不假定只有一种，避免它退化成必然误报的噪声源。
   * 那是真异常，记 error 级日志留证；但**不抛**，理由同上——此刻已经在处理另一个
   * 失败了，退款还没做，抛出会连退款一起跳过。
   */
  private async failTask(
    generationTaskId: string,
    failure: GenerationFailure,
  ): Promise<void> {
    try {
      const won = await this.repository.runInTransaction((tx) =>
        this.taskRecorder.fail(generationTaskId, failure, tx),
      );
      if (!won) {
        this.logger.error(
          `generation task terminal CAS lost: task=${generationTaskId} stage=${failure.stage} — ` +
            `row is already terminal, possible causes: a concurrent path wrote the same id twice; ` +
            `or another terminal-writing path (e.g. PENDING/QUEUED expiry sweep) landed first; investigate concurrent context`,
        );
      }
    } catch (err) {
      this.logger.error(
        `generation task failure persist failed (original failure still rethrown as-is): task=${generationTaskId} ` +
          `stage=${failure.stage} reason=${String(err instanceof Error ? err.message : err)}`,
      );
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
            `Reference image staging failed: ${String(err instanceof Error ? err.message : err)}`,
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
      /** 提供时，成功终态在建 image_generations 的**同一事务**内写入。 */
      generationTaskId?: string;
      startedAt?: number;
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
                  'Image generation hold has been refunded; cannot complete asset ingestion',
                );
              }
            }
          : undefined,
        options?.generationTaskId
          ? async (tx, generation) => {
              // 必须在这个事务内：否则会出现「图片已入库、任务表仍 PENDING」。
              const won = await this.taskRecorder.succeed(
                options.generationTaskId!,
                {
                  imageGenerationId: generation.id,
                  // imageGenerationId 只在成功时才有值（图片行只在成功时才建）——
                  // 与视频侧 create 时就写 videoGenerationId 是**有意的不对称**。
                  durationMs: options.startedAt ? Date.now() - options.startedAt : durationMs,
                },
                tx,
              );
              if (!won) {
                // 抛错回滚整个事务 —— 图片成功与任务记录必须原子：任务行已被写成终态
                // （唯一可能：并发重复写），此刻再提交图片会造出一条永远对不上账的记录。
                throw new Error(
                  `generation task ${options.generationTaskId} already terminal`,
                );
              }
            }
          : undefined,
      );

    return { generation, images: imageItems };
  }

  /** @returns 是否真的退成了 —— 调用方据此记 REFUNDED / REFUND_FAILED，不再靠猜。 */
  private async safeRefundImageHold(holdId: string, reason: string): Promise<boolean> {
    try {
      await this.pointsService.refundHold(holdId, reason);
      return true;
    } catch (err) {
      this.logger.error(
        `image generation point hold refund failed: hold=${holdId} reason=${String(
          err instanceof Error ? err.message : err,
        )}`,
      );
      return false;
    }
  }
}

/**
 * 把任意抛出物还原成 `GenerationFailure`，优先级：
 *   1. 异常上挂着的 failure（params 类失败在 `callImageApi` 里就压成了 BadRequestException，
 *      结构化上游字段只存在于这个挂载里）；
 *   2. 裸的 `ImageUpstreamError`（5xx / 超时等未被压过的上游失败）；
 *   3. 兜底 `fromUnknown`（转存失败、结算失败、落库失败……）。
 * 顺序不能反：反过来第 2 条永远轮不到，第 1 条的挂载也会被 fromUnknown 吃掉。
 */
function resolveImageGenerationFailure(
  err: unknown,
  stage: GenerationErrorStage,
): GenerationFailure {
  return (
    readGenerationFailure(err) ??
    (err instanceof ImageUpstreamError
      ? fromImageUpstreamError(err, stage)
      : fromUnknown(err, stage))
  );
}
