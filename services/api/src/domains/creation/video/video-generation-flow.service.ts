import { Injectable, BadRequestException, HttpStatus, NotFoundException, Logger } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import {
  type Prisma,
  VideoGenStatus,
  type video_clip_generations,
} from '../../platform/prisma/generated';
import { PointsService } from '../../billing/points/points.service';
import { MembershipService } from '../../billing/membership/membership.service';
import { RiskService } from '../risk/risk.service';
import { VideoAssetPersistenceService } from './video-asset-persistence.service';
import { VideoCallbackUrlBuilder } from './video-callback-url.builder';
import { VideoGenerationHoldReconciliationService } from './video-generation-hold-reconciliation.service';
import { VideoGenerationModelResolverService } from './video-generation-model-resolver.service';
import { VideoGenerationRepository } from './video-generation.repository';
import { VideoGenerationTerminalConvergenceService } from './video-generation-terminal-convergence.service';
import { VideoProjectStatusConvergenceService } from './video-project-status-convergence.service';
import {
  buildSeedanceCostEstimateInput,
  buildCompletedGenerationInput,
  buildCreateTaskFailureInput,
  buildExpiredGenerationInput,
  buildExplicitFailedGenerationInput,
  buildFailedGenerationInput,
  buildPendingGenerationInput,
  buildQueuedGenerationPollWindow,
  buildVideoHoldInput,
  normalizeVideoGenerationClipParamsForModel,
  resolveClipPrompt,
  resolveStoryboardTotalDuration,
  resolveStoryboardVideoPrompt,
  resolveSucceededGenerationFailureReason,
  resolveSucceededGenerationVideo,
  resolveVideoGenerationRequestLimits,
  resolveVideoRouting,
  toPrismaInputJson,
  type VideoGenerationClipParams as ClipParams,
  splitQueuedGenerationsForPolling,
} from './video-generation-flow.helpers';
import {
  assembleVideoRequest,
  parseVideoCallback,
  queryVideoTask,
  resolveVideoPreset,
  submitVideoTask,
  videoQueryUrl,
  videoSubmitUrl,
  type VideoTaskOutcome,
} from '@autix/ai-adapters/video';
import { readProtocolKey } from '@autix/domain/model';
import { toUnifiedVideoParams, type VideoModelHint } from '@autix/domain/video';
import { toLegacyVideoOutcome } from './video-outcome.adapter';

// Ark 的公有默认 host。旧路径里这条兜底曾藏在已删除的 seedance-api.service.ts 的
// SEEDANCE_BASE_URL + resolveSeedanceBaseUrl 内部（仅当 model_configs.baseUrl /
// metadata.baseUrl / AMUX_BASE_URL 均未配置时触发）。协议引擎的 VideoCallRequest.baseUrl
// 是必填 string（不像旧 createTask 接受 null 并自行兜底），故这条兜底必须留在
// 调用方，翻译过来保持与今天逐字节一致。
const ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com';

function resolveEngineBaseUrl(baseUrl: string | null | undefined): string {
  const trimmed = baseUrl?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : ARK_DEFAULT_BASE_URL;
}

/**
 * 残余 legacy 行（计划 1 迁移时快照缺失，protocolKey/modelConfigId 为 NULL）唯一可能
 * 归属的协议 —— 这些行都是切引擎前提交的，而切引擎前 Ark 是唯一协议。
 * resolveLegacyApiContext 会先校验实时配置确实还指向这个协议，不是拿它直接信任。
 */
const LEGACY_VIDEO_PROTOCOL_KEY = 'ark-video@v3';

export interface ClipGenerateInput {
  clipId: string;
  projectId: string;
  userId: string;
  variantLabel?: string;
}

function toVideoModelHint(modelConfig: {
  provider?: string | null;
  model?: string | null;
  metadata?: unknown;
}): VideoModelHint {
  return {
    provider: modelConfig.provider,
    model: modelConfig.model,
    metadata:
      modelConfig.metadata && typeof modelConfig.metadata === 'object' && !Array.isArray(modelConfig.metadata)
        ? modelConfig.metadata as VideoModelHint['metadata']
        : null,
  };
}

@Injectable()
export class VideoGenerationFlowService {
  private readonly logger = new Logger(VideoGenerationFlowService.name);

  constructor(
    private readonly repository: VideoGenerationRepository,
    private readonly pointsService: PointsService,
    private readonly modelResolver: VideoGenerationModelResolverService,
    private readonly callbackUrlBuilder: VideoCallbackUrlBuilder,
    private readonly videoAssets: VideoAssetPersistenceService,
    private readonly membershipService: MembershipService,
    private readonly riskService: RiskService,
    private readonly projectStatusConvergence: VideoProjectStatusConvergenceService,
    private readonly holdReconciliation: VideoGenerationHoldReconciliationService,
    private readonly terminalConvergence: VideoGenerationTerminalConvergenceService,
  ) { }

  @Cron('*/30 * * * * *')
  async pollPendingGenerations() {
    const pollWindow = buildQueuedGenerationPollWindow();

    const pending = await this.repository.findActiveProviderGenerations();

    if (pending.length === 0) return;

    const { toExpire, toPoll } = splitQueuedGenerationsForPolling(
      pending,
      pollWindow,
    );
    for (const g of toExpire) {
      await this.markExpired(g.id, 'cron: queued 超过 30 分钟未完成');
    }

    if (toPoll.length === 0) return;

    const pairs: Array<{
      generation: typeof toPoll[number];
      outcome: VideoTaskOutcome;
    }> = [];

    for (const g of toPoll) {
      try {
        if (!g.providerTaskId) continue;

        // 优先用提交时的快照（不可变）：clip params 生成后仍可改
        // （video-project.store.ts 的 updateClipParams），若轮询读实时 params，
        // 用户中途切模型会导致 in-flight 任务被拿新渠道的凭证去查。
        // 残余 legacy 行（modelConfigId 为 NULL，计划 1 迁移时快照缺失）走受限回退。
        const apiContext = g.modelConfigId
          ? await this.modelResolver.resolveApiContextByModelConfigId(
              g.modelConfigId,
            )
          : await this.resolveLegacyApiContext(g);
        if (!apiContext) continue;

        // preset 只在拿到经校验的 apiContext 之后再解析：legacy 行的 g.protocolKey
        // 为 null，resolveVideoPreset(undefined) 会 fail-loud 抛出——resolveLegacyApiContext
        // 已经确认了实时配置就是 ark-video@v3，这里的默认值因此是安全的，不是猜测。
        const preset = resolveVideoPreset(
          g.protocolKey ?? LEGACY_VIDEO_PROTOCOL_KEY,
        );
        const outcome = await queryVideoTask({
          preset,
          baseUrl: resolveEngineBaseUrl(apiContext.baseUrl),
          apiKey: apiContext.apiKey,
          taskId: g.providerTaskId,
          onWarn: (m) => this.logger.warn(`generation ${g.id}: ${m}`),
        });
        pairs.push({ generation: g, outcome });
      } catch (err) {
        this.logger.warn(
          `pollPendingGenerations: query ${g.id} failed: ${String(err instanceof Error ? err.message : err)}`,
        );
      }
    }

    if (pairs.length > 0) {
      await this.pollPendingByTaskIds(pairs);
    }
  }

  /**
   * 残余 legacy 行（计划 1 迁移时 hold 快照缺失、无从回填 modelConfigId）的受限回退。
   *
   * **必须校验实时配置仍指向同一协议且模型一致** —— 否则用户中途改了模型，我们就会拿
   * 另一家的凭证去查这个旧任务（串渠道）。宁可拒绝查询、让它走终态收敛超时（用户侧表现
   * 为失败 + 退款），也不能串。
   *
   * 该分支在确认零残余行后删除（见计划 1 的残余审计 SQL）。
   */
  private async resolveLegacyApiContext(g: video_clip_generations) {
    if (!g.clipId) return null; // 直连行无 clip；且必带 modelConfigId，不进 legacy 回退
    const clip = await this.repository.findClipParams(g.clipId);
    const live = await this.modelResolver.resolveApiContextForClipParams(
      clip?.params ?? null,
    );
    if (!live) return null;
    const liveKey = readProtocolKey(live.metadata);
    if (liveKey !== LEGACY_VIDEO_PROTOCOL_KEY || live.model !== g.model) {
      this.logger.error(
        `legacy generation ${g.id}: live config drifted (protocolKey=${liveKey}, model=${live.model}) — refusing cross-channel query`,
      );
      return null;
    }
    return live;
  }

  async generateClip(input: ClipGenerateInput) {
    const clip = await this.repository.findClipForGeneration(input.clipId);
    if (!clip) throw new BadRequestException('Clip 不存在');
    if (clip.project.userId !== input.userId)
      throw new BadRequestException('无权操作此项目');

    const rawParams = (clip.params ?? {}) as ClipParams;

    const { modelConfigId, modelConfig, apiKey, baseUrl } =
      await this.modelResolver.resolveForGeneration({
        id: clip.id,
        params: clip.params,
      }, input.userId);
    const params = normalizeVideoGenerationClipParamsForModel(
      rawParams,
      toVideoModelHint(modelConfig),
    );

    // P0-1: 会员等级闸门——视频生成前先校验当前会员套餐能力（分辨率/时长/开关）
    // 必须在 createHold / 调用供应商之前完成，避免占用积分和成本。
    const entitlement = await this.membershipService.resolveVideoEntitlements(
      input.userId,
    );
    const requestLimits = resolveVideoGenerationRequestLimits(params, toVideoModelHint(modelConfig));
    this.logger.log(
      `generateClip request: ${JSON.stringify({
        projectId: input.projectId,
        clipId: input.clipId,
        userId: input.userId,
        variantLabel: input.variantLabel,
        requestLimits,
        params,
      })}`,
    );
    this.membershipService.assertVideoEntitlement(entitlement, {
      resolution: requestLimits.resolution,
      durationSeconds: requestLimits.durationSeconds,
    });

    // P3-2: 轻量 RiskService 校验硬上限（时长/分辨率）+ 并发数（基于现有 video_clip_generations 计数）
    await this.riskService.assertVideoRequest(input.userId, entitlement, {
      resolution: requestLimits.resolution,
      durationSeconds: requestLimits.durationSeconds,
    });

    this.logger.log(
      `generateClip model resolved: ${JSON.stringify({
        projectId: input.projectId,
        clipId: input.clipId,
        modelConfigId,
        model: modelConfig.model,
        provider: modelConfig.provider,
        baseUrlConfigured: Boolean(baseUrl),
        apiKeyConfigured: Boolean(apiKey),
      })}`,
    );

    const materials = clip.materials;

    const resolvedPrompt = resolveClipPrompt(clip.prompt, params);
    // 计划 4：提交路径切到声明式协议引擎，不再经 SeedanceApiService。
    // preset 从服务端解析的 modelConfig.metadata.protocolKey 路由；resolveVideoPreset
    // 对缺失/未注册的 key fail-loud（前置门禁已确认生产视频模型都有 protocolKey）。
    // Wan 2.7 是一个模型，上游按素材角色分派到 t2v/i2v/ref —— routing 据素材覆盖 preset 与 model ID。
    const routing = resolveVideoRouting(modelConfig.metadata, modelConfig.model, materials.map((m) => m.role));
    if (routing.maxDurationSeconds != null && requestLimits.durationSeconds > routing.maxDurationSeconds)
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'video.duration_exceeds_mode_limit', {
        max: routing.maxDurationSeconds,
        requested: requestLimits.durationSeconds,
      });
    const preset = routing.preset;
    const callbackUrl = this.callbackUrlBuilder.build(preset.key);
    const callRequest = {
      preset,
      baseUrl: resolveEngineBaseUrl(baseUrl),
      apiKey,
      // FIX-3: 始终使用服务端解析/鉴权过的模型，忽略客户端传入的 params.model，
      // 防止"选便宜模型过鉴权、用 params.model 偷换为贵模型"导致跑贵付便宜。
      // toUnifiedVideoParams 不投影 model，这条不变量天然成立。Wan 家族的 routing.model 亦服务端权威。
      model: routing.model,
      prompt: resolvedPrompt,
      materials,
      params: toUnifiedVideoParams(params),
      callbackUrl,
    };
    // assembleVideoRequest 是 submitVideoTask 内部实际组装请求体所用的同一纯函数
    // （golden 测试已锁死其与旧 buildTaskRequest 逐字节等价）——这里先算一次，
    // 既用于日志/hold 快照，也用于「内容是否为空」的判定，避免重复造轮子。
    const requestBody = assembleVideoRequest(callRequest);
    const requestContent = Array.isArray(requestBody.content)
      ? (requestBody.content as Array<{ type: string }>)
      : [];
    this.logger.log(
      `generateClip prompt resolved: ${JSON.stringify({
        projectId: input.projectId,
        clipId: input.clipId,
        clipOrder: clip.order,
        clipStatus: clip.status,
        generationMode: params.generationMode,
        clipPromptLength: clip.prompt?.trim().length ?? 0,
        storyboardPromptLength:
          typeof params.storyboardPrompt === 'string'
            ? params.storyboardPrompt.trim().length
            : 0,
        resolvedPromptLength: resolvedPrompt.length,
        resolvedPromptPreview: resolvedPrompt.slice(0, 260),
        contentTextCount: requestContent.filter((item) => item.type === 'text').length,
        contentTypes: requestContent.map((item) => item.type),
      })}`,
    );

    // 判空必须协议无关：flat-media（PoYo VEO）请求体没有 content 数组（prompt 在 input.prompt），
    // 查 requestBody.content 会永远判空。按「解析后 prompt 为空且无素材」判定，两种协议都对。
    if (resolvedPrompt.trim().length === 0 && materials.length === 0)
      throw new BadRequestException('Clip 缺少素材或 prompt');

    const generationId: string = randomUUID();
    const estimateInput = buildSeedanceCostEstimateInput({
      params,
      modelConfigId,
      membershipLevel: entitlement.level,
    });
    const billingTaskType = estimateInput.taskType;
    this.logger.log(
      `generateClip seedance payload prepared: ${JSON.stringify({
        generationId,
        projectId: input.projectId,
        clipId: input.clipId,
        modelConfigId,
        model: requestBody.model,
        billingTaskType,
        contentCount: requestContent.length,
        contentTypes: requestContent.map((item) => item.type),
        materialCount: materials.length,
        promptLength: resolvedPrompt?.length ?? 0,
        resolution: requestBody.resolution,
        ratio: requestBody.ratio,
        duration: requestBody.duration,
        generateAudio: requestBody.generate_audio,
        watermark: requestBody.watermark,
      })}`,
    );
    let holdId: string | null = null;
    const estimate = await this.pointsService.estimateCost(estimateInput);
    this.logger.log(
      `generateClip cost estimated: ${JSON.stringify({
        generationId,
        billingTaskType,
        estimatedCost: estimate.estimatedCost,
      })}`,
    );

    const { hold } = await this.pointsService.createHold(
      input.userId,
      buildVideoHoldInput({
        billingTaskType,
        generationId,
        estimatedCost: estimate.estimatedCost,
        pricingSnapshot: estimate.pricingSnapshot,
        projectId: input.projectId,
        clipId: input.clipId,
        modelConfigId,
        taskRequest: requestBody,
      }),
    );
    holdId = hold.id;
    this.logger.log(
      `generateClip point hold created: ${JSON.stringify({
        generationId,
        holdId,
        billingTaskType,
        estimatedCost: estimate.estimatedCost,
      })}`,
    );

    try {
      await this.repository.createPendingGenerationAndMarkRunning({
        ...buildPendingGenerationInput({
          generationId,
          clipId: input.clipId,
          projectId: input.projectId,
          userId: input.userId,
          variantLabel: input.variantLabel,
          params,
          fallbackModel: modelConfig.model,
          resolvedPrompt,
          taskRequest: requestBody,
        }),
        // 计划 3：protocolKey 快照改为提交时实际解析出的 preset.key（而非硬编码常量），
        // 供轮询/回调据此按快照凭证查询，不受 clip params 后续被改动的影响。
        protocolKey: preset.key,
        modelConfigId,
      });
    } catch (err) {
      if (holdId) {
        await this.holdReconciliation.safeRefund(
          generationId,
          'video generation creation failed',
        );
      }
      throw err;
    }

    try {
      // 运行日志：打到哪个上游接口 + 实际下发的调用参数（endpoint 与 submitVideoTask
      // 内部同源，见 videoSubmitUrl）。放在 submit 之前——即使上游报错也能看到本次
      // 请求的接口与参数。
      this.logger.log(
        `generateClip upstream call: ${JSON.stringify({
          generationId,
          protocolKey: preset.key,
          endpoint: videoSubmitUrl(preset, callRequest.baseUrl),
          method: preset.submit.endpoint.method,
          model: callRequest.model,
          params: callRequest.params,
        })}`,
      );
      const { providerTaskId } = await submitVideoTask(callRequest);

      await this.repository.markGenerationQueued(generationId, providerTaskId);
      this.logger.log(
        `generateClip queued: ${JSON.stringify({
          generationId,
          providerTaskId,
          projectId: input.projectId,
          clipId: input.clipId,
        })}`,
      );

      return { generationId, taskId: providerTaskId };
    } catch (err) {
      await this.repository.markGenerationCreateTaskFailedAndRefund(
        buildCreateTaskFailureInput({
          generationId,
          clipId: input.clipId,
          error: err,
        }),
        (tx) =>
          this.holdReconciliation.refundGenerationHoldWithinTx(
            tx,
            generationId,
            'createTask 同步失败',
          ),
      );
      await this.projectStatusConvergence.recalculateProjectStatus(
        input.projectId,
      );
      throw err;
    }
  }

  /**
   * 回调链路与查询链路共用的状态收敛入口。
   * 进入即对终态短路，保证 callback + cron/refresh 同时命中时的幂等性。
   *
   * outcome 是协议引擎已归一化的终态（query 响应或 callback body 二者同构）。
   * toLegacyVideoOutcome 把它翻译回既有内部词汇（含 refundReason 等引擎不返回的
   * 面向用户字段）——下游整段逻辑因此**一行不改**，切换的爆炸半径收敛在这条适配器上。
   */
  async applyTaskStatus(
    generation: video_clip_generations,
    outcome: VideoTaskOutcome,
  ) {
    if (await this.terminalConvergence.reconcileIfTerminal(generation)) return;

    const legacy = toLegacyVideoOutcome(outcome);
    if (legacy.kind === 'missing_status') {
      this.logger.warn(
        `applyTaskStatus: missing status for generation ${generation.id}`,
      );
      return;
    }

    if (legacy.kind === 'succeeded') {
      const generationParams =
        generation.params && typeof generation.params === 'object' && !Array.isArray(generation.params)
          ? (generation.params as Record<string, unknown>)
          : {};
      const isStoryboardProjectGeneration =
        generationParams.generationMode === 'storyboard';
      const failureReason = resolveSucceededGenerationFailureReason({
        sourceUrl: legacy.sourceUrl,
      });
      if (failureReason) {
        this.logger.warn(
          `succeeded but missing video_url, generation=${generation.id}`,
        );
        await this.markGenerationFailed(
          generation,
          failureReason,
          legacy.externalStatus,
        );
        return;
      }

      const videoUrl = await this.videoAssets.persistProviderVideo(
        legacy.sourceUrl,
        generation.id,
      );
      const videoResolution = resolveSucceededGenerationVideo({
        sourceUrl: legacy.sourceUrl,
        persistedVideoUrl: videoUrl,
        persistAttempted: true,
      });
      if (videoResolution.kind === 'failed') {
        this.logger.warn(
          `succeeded but R2 persist failed, generation=${generation.id}`,
        );
        await this.markGenerationFailed(
          generation,
          videoResolution.reason,
          legacy.externalStatus,
        );
        return;
      }

      // 末帧同样要转存：它会成为素材库封面与链式生成的输入图，留供应商链接等于留 24h 死链。
      // 失败落 null 而不是失败整次生成——少张封面 ≠ 视频没生成出来。
      const persistedLastFrameUrl = await this.videoAssets.persistProviderImage(
        legacy.lastFrameUrl ?? undefined,
        generation.id,
      );
      const completedInput = buildCompletedGenerationInput({
        generation,
        outcome: legacy,
        videoUrl: videoResolution.videoUrl,
        lastFrameUrl: persistedLastFrameUrl,
      });
      if (isStoryboardProjectGeneration) {
        await this.repository.markProjectGenerationCompletedAndConfirmHold(
          {
            generationId: completedInput.generationId,
            projectId: generation.projectId!, // storyboard 行恒有 projectId（直连走 clipId===null 分支，不到这里）
            externalStatus: completedInput.externalStatus,
            videoUrl: completedInput.videoUrl,
            lastFrameUrl: completedInput.lastFrameUrl,
            durationSec: completedInput.durationSec,
          },
          (tx) =>
            this.holdReconciliation.confirmGenerationHoldWithinTx(
              tx,
              generation.id,
            ),
        );
      } else if (generation.clipId) {
        await this.repository.markGenerationCompletedAndConfirmHold(
          // clipId 已在此分支确认非空
          { ...completedInput, clipId: generation.clipId },
          (tx) =>
            this.holdReconciliation.confirmGenerationHoldWithinTx(
              tx,
              generation.id,
            ),
        );
      } else {
        // 直连行（clipId=null）：只写 generation 行本身，不碰不存在的父 clip/project。
        await this.repository.markDirectGenerationCompletedAndConfirmHold(
          {
            generationId: completedInput.generationId,
            externalStatus: completedInput.externalStatus,
            videoUrl: completedInput.videoUrl,
            lastFrameUrl: completedInput.lastFrameUrl,
            durationSec: completedInput.durationSec,
          },
          (tx) =>
            this.holdReconciliation.confirmGenerationHoldWithinTx(
              tx,
              generation.id,
            ),
        );
      }
      if (!isStoryboardProjectGeneration && generation.clipId) {
        await this.projectStatusConvergence.recalculateProjectStatus(
          generation.projectId!, // clipId 非空的非 storyboard 分支恒为单 clip 生成，projectId 恒非空
        );
      }
    } else if (legacy.kind === 'failed') {
      const generationParams =
        generation.params && typeof generation.params === 'object' && !Array.isArray(generation.params)
          ? (generation.params as Record<string, unknown>)
          : {};
      const isStoryboardProjectGeneration =
        generationParams.generationMode === 'storyboard';
      const failedInput = buildFailedGenerationInput({ generation, outcome: legacy });
      if (isStoryboardProjectGeneration) {
        await this.repository.markProjectGenerationFailedAndRefund(
          {
            generationId: failedInput.generationId,
            projectId: generation.projectId!, // storyboard 行恒有 projectId（直连走 clipId===null 分支，不到这里）
            status: failedInput.status,
            externalStatus: failedInput.externalStatus,
            error: failedInput.error,
          },
          (tx) =>
            this.holdReconciliation.refundGenerationHoldWithinTx(
              tx,
              generation.id,
              legacy.refundReason,
            ),
        );
        return;
      }

      if (generation.clipId) {
        await this.repository.markGenerationFailedAndRefund(
          // clipId 已在此分支确认非空
          { ...failedInput, clipId: generation.clipId },
          (tx) =>
            this.holdReconciliation.refundGenerationHoldWithinTx(
              tx,
              generation.id,
              legacy.refundReason,
            ),
        );
      } else {
        // 直连行（clipId=null）：只写 generation 行本身，不碰不存在的父 clip/project。
        await this.repository.markDirectGenerationFailedAndRefund(
          {
            generationId: failedInput.generationId,
            status: failedInput.status,
            externalStatus: failedInput.externalStatus,
            error: failedInput.error,
          },
          (tx) =>
            this.holdReconciliation.refundGenerationHoldWithinTx(
              tx,
              generation.id,
              legacy.refundReason,
            ),
        );
      }
      if (generation.clipId && generation.projectId) {
        await this.projectStatusConvergence.convergeAfterClipFailure({
          clipId: generation.clipId,
          projectId: generation.projectId,
        });
      }
    } else {
      await this.repository.updateGenerationExternalStatus(
        generation.id,
        legacy.externalStatus,
      );
    }
  }

  /**
   * 回调入口：按 (protocolKey, taskId) 定位 generation（协议路由已在计划 1 收窄成
   * 两列查询），再用同一协议的 preset 解析回调体，交给 applyTaskStatus 统一收敛。
   */
  async handleCallback(
    protocolKey: string,
    taskId: string,
    payload: Record<string, unknown>,
  ) {
    const generation = await this.repository.findGenerationByProviderTaskId(
      protocolKey,
      taskId,
    );
    if (!generation) {
      this.logger.warn(`Callback for unknown task: ${protocolKey}/${taskId}`);
      return;
    }
    const preset = resolveVideoPreset(protocolKey);
    const { outcome } = parseVideoCallback({
      preset,
      body: payload,
      onWarn: (m) => this.logger.warn(`generation ${generation.id}: ${m}`),
    });
    await this.applyTaskStatus(generation, outcome);
  }

  /**
   * 用户/管理员手动刷新单个 generation。走引擎的 `queryVideoTask` 单查 + 统一收敛入口。
   *
   * 与 pollPendingGenerations 同一套快照优先策略：优先用 generation 自身的
   * protocolKey/modelConfigId 快照；残余 legacy 行（快照缺失）走受限回退，
   * 拒绝时抛出而非静默跳过——手动刷新是用户主动触发的单次请求，没有轮询兜底，
   * 必须给出明确的失败反馈而不是悄悄什么都不做。
   */
  async refreshGeneration(args: {
    projectId: string;
    generationId: string;
    userId: string;
  }) {
    const generation = await this.repository.findOwnedGeneration(args);
    if (!generation) throw new NotFoundException('Generation 不存在');
    if (!generation.providerTaskId)
      throw new BadRequestException('任务尚未创建，无法刷新');

    if (await this.terminalConvergence.reconcileIfTerminal(generation)) {
      return this.repository.findGenerationById(generation.id);
    }

    const apiContext = generation.modelConfigId
      ? await this.modelResolver.resolveApiContextByModelConfigId(
          generation.modelConfigId,
        )
      : await this.resolveLegacyApiContext(generation);
    if (!apiContext) {
      throw new BadRequestException('视频模型缺少 API Key 配置或已跨渠道漂移，无法刷新');
    }
    const preset = resolveVideoPreset(
      generation.protocolKey ?? LEGACY_VIDEO_PROTOCOL_KEY,
    );

    const queryBaseUrl = resolveEngineBaseUrl(apiContext.baseUrl);
    // 运行日志：手动刷新是用户/管理员触发的低频调用，记录查询打到哪个上游接口。
    // 批量轮询 cron（pollActiveGenerations）不打此日志——每几秒一次会刷屏。
    this.logger.log(
      `refreshGeneration upstream call: ${JSON.stringify({
        generationId: generation.id,
        protocolKey: preset.key,
        endpoint: videoQueryUrl(preset, queryBaseUrl, generation.providerTaskId),
        method: preset.query.endpoint.method,
      })}`,
    );
    try {
      const outcome = await queryVideoTask({
        preset,
        baseUrl: queryBaseUrl,
        apiKey: apiContext.apiKey,
        taskId: generation.providerTaskId,
        onWarn: (m) => this.logger.warn(`generation ${generation.id}: ${m}`),
      });
      await this.applyTaskStatus(generation, outcome);
    } catch (err) {
      this.logger.warn(
        `refreshGeneration ${generation.id} failed: ${String(err instanceof Error ? err.message : err)}`,
      );
      throw err;
    }

    return this.repository.findGenerationById(generation.id);
  }

  /**
   * cron 批查后批量收敛入口。
   * 接收 (generation, outcome) 元组数组，串行调用 `applyTaskStatus`。
   * 本方法不做 API 调用，调用方需自行完成引擎的 queryVideoTask 并配对。
   */
  async pollPendingByTaskIds(
    pairs: Array<{
      generation: video_clip_generations;
      outcome: VideoTaskOutcome;
    }>,
  ) {
    for (const { generation, outcome } of pairs) {
      try {
        if (await this.terminalConvergence.reconcileIfTerminal(generation))
          continue;
        await this.applyTaskStatus(generation, outcome);
      } catch (err) {
        this.logger.warn(
          `pollPendingByTaskIds: apply ${generation.id} failed: ${String(err instanceof Error ? err.message : err)}`,
        );
      }
    }
  }

  /**
   * 强制将单个 generation 标记为 expired（cron 30min 兜底使用）。
   */
  async markExpired(generationId: string, reason: string) {
    const generation = await this.repository.findGenerationById(generationId);
    if (!generation) return;
    if (await this.terminalConvergence.reconcileIfTerminal(generation)) return;

    // 超时**不退款** —— 视频域不替上游判"我猜它失败了"。只把无人认领的任务排出轮询
    // 队列（标终态），退款由积分侧的孤儿回收（PointsHoldReclaimCron，60min）兜底。
    // markExpired 是轮询队列（findActiveProviderGenerations: orderBy asc, take 50）的唯一
    // 排水口，故必须保留标终态 —— 删掉会让卡死任务永占队列前列、新任务饿死。
    const expiredInput = buildExpiredGenerationInput({ generation, reason });
    if (generation.clipId) {
      await this.repository.markGenerationExpiredWithoutRefund({
        // clipId 已在此分支确认非空
        ...expiredInput,
        clipId: generation.clipId,
      });
      await this.projectStatusConvergence.convergeAfterClipFailure({
        clipId: generation.clipId,
        projectId: generation.projectId!,
      });
    } else {
      // 直连行（clipId=null）：cron 的排水口——只写 generation 行本身，无项目收敛。
      await this.repository.markDirectGenerationExpiredWithoutRefund({
        generationId: generation.id,
        externalStatus: 'expired',
        error: reason,
      });
    }

    this.logger.warn(
      `Generation ${generationId} 排水标记 expired（不退款，交积分侧孤儿回收）: ${reason}`,
    );
  }

  async generateAllClips(projectId: string, userId: string) {
    // 项目级 owner 校验前置（避免越权批量提交，单个 generateClip 内部校验仍兜底）
    const project = await this.repository.findProjectOwner(projectId);
    if (!project) throw new NotFoundException('项目不存在');
    if (project.userId !== userId)
      throw new BadRequestException('无权操作此项目');

    const clips = await this.repository.findProjectClipsOrdered(projectId);
    if (clips.length === 0)
      throw new BadRequestException('项目无 Clip');

    return this.generateStoryboardProjectVideo({ projectId, userId, clips });
  }

  private async generateStoryboardProjectVideo(input: {
    projectId: string;
    userId: string;
    clips: Awaited<ReturnType<VideoGenerationRepository['findProjectClipsOrdered']>>;
  }) {
    const { projectId, userId, clips } = input;
    const anchorClip = clips[0];
    if (!anchorClip) throw new BadRequestException('项目无 Clip');
    const rawParams: Record<string, unknown> & ClipParams = {
      ...((anchorClip.params ?? {}) as ClipParams),
      generationMode: 'storyboard',
      duration: resolveStoryboardTotalDuration(
        clips,
        ((anchorClip.params ?? {}) as ClipParams).duration,
      ),
    };
    const modelContext = await this.modelResolver.resolveForGeneration({
      id: anchorClip.id,
      params: JSON.parse(JSON.stringify(rawParams)) as Prisma.JsonValue,
    }, userId);
    const params = normalizeVideoGenerationClipParamsForModel(
      rawParams,
      toVideoModelHint(modelContext.modelConfig),
    ) as Record<string, unknown> & ClipParams;
    const persistedParams = JSON.parse(JSON.stringify(params)) as Prisma.JsonValue;

    const entitlement = await this.membershipService.resolveVideoEntitlements(userId);
    const requestLimits = resolveVideoGenerationRequestLimits(params, toVideoModelHint(modelContext.modelConfig));
    this.membershipService.assertVideoEntitlement(entitlement, {
      resolution: requestLimits.resolution,
      durationSeconds: requestLimits.durationSeconds,
    });
    await this.riskService.assertVideoRequest(userId, entitlement, {
      resolution: requestLimits.resolution,
      durationSeconds: requestLimits.durationSeconds,
    });

    const { modelConfigId, modelConfig, apiKey, baseUrl } = modelContext;
    const resolvedPrompt = resolveStoryboardVideoPrompt({ clips, params });
    const storyboardMaterials = clips.flatMap((clip) => clip.materials ?? []);
    // 计划 4：提交路径切到声明式协议引擎，不再经 SeedanceApiService（同 generateClip）。
    // Wan 2.7 家族按素材角色派发 preset + model ID（同 generateClip）。
    const routing = resolveVideoRouting(
      modelConfig.metadata,
      modelConfig.model,
      storyboardMaterials.map((m) => m.role),
    );
    if (routing.maxDurationSeconds != null && requestLimits.durationSeconds > routing.maxDurationSeconds)
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'video.duration_exceeds_mode_limit', {
        max: routing.maxDurationSeconds,
        requested: requestLimits.durationSeconds,
      });
    const preset = routing.preset;
    const callbackUrl = this.callbackUrlBuilder.build(preset.key);
    const callRequest = {
      preset,
      baseUrl: resolveEngineBaseUrl(baseUrl),
      apiKey,
      // FIX-3: 服务端解析过的模型，不采信 params.model（同 generateClip）。
      model: routing.model,
      prompt: resolvedPrompt,
      materials: storyboardMaterials,
      params: toUnifiedVideoParams(params),
      callbackUrl,
    };
    const requestBody = assembleVideoRequest(callRequest);
    const requestContent = Array.isArray(requestBody.content)
      ? (requestBody.content as Array<{ type: string }>)
      : [];
    // 判空协议无关（同 generateClip）：flat-media（PoYo）无 content 数组，按 prompt+素材判。
    if (resolvedPrompt.trim().length === 0 && storyboardMaterials.length === 0)
      throw new BadRequestException('项目缺少分镜 prompt');

    const generationId = randomUUID();
    const estimateInput = buildSeedanceCostEstimateInput({
      params,
      modelConfigId,
      membershipLevel: entitlement.level,
    });
    const billingTaskType = estimateInput.taskType;
    this.logger.log(
      `generateAllClips storyboard project task: ${JSON.stringify({
        projectId,
        userId,
        generationId,
        anchorClipId: anchorClip.id,
        totalClips: clips.length,
        duration: params.duration,
        modelConfigId,
        model: requestBody.model,
        billingTaskType,
        promptLength: resolvedPrompt.length,
        promptPreview: resolvedPrompt.slice(0, 400),
        contentCount: requestContent.length,
        contentTypes: requestContent.map((item) => item.type),
        materialCount: storyboardMaterials.length,
      })}`,
    );

    let holdId: string | null = null;
    try {
      const estimate = await this.pointsService.estimateCost(estimateInput);
      const { hold } = await this.pointsService.createHold(
        userId,
        buildVideoHoldInput({
          billingTaskType,
          generationId,
          estimatedCost: estimate.estimatedCost,
          pricingSnapshot: estimate.pricingSnapshot,
          projectId,
          clipId: anchorClip.id,
          modelConfigId,
          taskRequest: requestBody,
        }),
      );
      holdId = hold.id;
      await this.repository.createPendingProjectGenerationAndMarkRunning({
        generationId,
        clipId: anchorClip.id,
        projectId,
        userId,
        params: persistedParams as Prisma.InputJsonValue,
        model: modelConfig.model,
        resolvedPrompt,
        // 计划 3：protocolKey 快照改为提交时实际解析出的 preset.key（同 generateClip）。
        protocolKey: preset.key,
        modelConfigId,
      });

      // 运行日志：同 generateClip —— 接口 + 调用参数，放在 submit 之前。
      this.logger.log(
        `generateAllClips storyboard upstream call: ${JSON.stringify({
          generationId,
          protocolKey: preset.key,
          endpoint: videoSubmitUrl(preset, callRequest.baseUrl),
          method: preset.submit.endpoint.method,
          model: callRequest.model,
          params: callRequest.params,
        })}`,
      );
      const { providerTaskId } = await submitVideoTask(callRequest);
      await this.repository.markGenerationQueued(generationId, providerTaskId);
      this.logger.log(
        `generateAllClips storyboard project queued: ${JSON.stringify({
          projectId,
          generationId,
          providerTaskId,
          holdId,
        })}`,
      );
      return [{ generationId, taskId: providerTaskId, clipId: anchorClip.id }];
    } catch (err) {
      if (holdId) {
        await this.holdReconciliation.safeRefund(
          generationId,
          'storyboard project createTask failed',
        );
      }
      try {
        await this.repository.markProjectGenerationFailedAndRefund(
          {
            generationId,
            projectId,
            status: VideoGenStatus.failed,
            externalStatus: 'create_task_failed',
            error: err instanceof Error ? err.message : String(err),
          },
          async () => undefined,
        );
      } catch {
        // best effort: the generation may not have been persisted yet.
      }
      throw err;
    }
  }

  /**
   * succeeded 兜底专用：callback 报 succeeded 但 video_url 缺失或 R2 持久化失败时，
   * generation 视为失败，配套退款 + cascade/recalc，避免幽灵 completed 记录。
   */
  private async markGenerationFailed(
    generation: { id: string; clipId: string | null; projectId: string | null },
    reason: string,
    externalStatus: string,
  ) {
    const failedInput = buildExplicitFailedGenerationInput({ generation, reason, externalStatus });
    if (generation.clipId) {
      await this.repository.markGenerationFailedAndRefund(
        // clipId 已在此分支确认非空
        { ...failedInput, clipId: generation.clipId },
        (tx) =>
          this.holdReconciliation.refundGenerationHoldWithinTx(
            tx,
            generation.id,
            reason,
          ),
      );
    } else {
      // 直连行（clipId=null）：succeeded 兜底也可能命中直连生成，只写 generation 行本身。
      await this.repository.markDirectGenerationFailedAndRefund(
        {
          generationId: failedInput.generationId,
          status: failedInput.status,
          externalStatus: failedInput.externalStatus,
          error: failedInput.error,
        },
        (tx) =>
          this.holdReconciliation.refundGenerationHoldWithinTx(
            tx,
            generation.id,
            reason,
          ),
      );
    }
    if (generation.clipId && generation.projectId) {
      await this.projectStatusConvergence.convergeAfterClipFailure({
        clipId: generation.clipId,
        projectId: generation.projectId,
      });
    }
  }

  async persistVideoMessage(
    conversationId: string | null,
    generationId: string,
    videoUrl: string,
    prompt: string,
  ) {
    if (!conversationId) return;

    await this.repository.createVideoResultMessage({
      conversationId,
      generationId,
      videoUrl,
      prompt,
    });
  }
}
