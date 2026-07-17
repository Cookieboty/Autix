import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
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
import {
  SeedanceApiService,
  type SeedanceTaskStatus,
} from './seedance-api.service';
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
  normalizeSeedanceTaskOutcome,
  normalizeVideoGenerationClipParamsForModel,
  resolveClipPrompt,
  resolveStoryboardTotalDuration,
  resolveStoryboardVideoPrompt,
  resolveSucceededGenerationFailureReason,
  resolveSucceededGenerationVideo,
  resolveVideoGenerationRequestLimits,
  toPrismaInputJson,
  type VideoGenerationClipParams as ClipParams,
  splitQueuedGenerationsForPolling,
} from './video-generation-flow.helpers';
import { assembleVideoRequest, resolveVideoPreset, submitVideoTask } from '@autix/ai-adapters/video';
import { readProtocolKey } from '@autix/domain/model';
import { toUnifiedVideoParams, type VideoModelHint } from '@autix/domain/video';

// Ark 的公有默认 host。旧路径里这条兜底藏在 seedance-api.service.ts 的
// SEEDANCE_BASE_URL + resolveSeedanceBaseUrl 内部（仅当 model_configs.baseUrl /
// metadata.baseUrl / AMUX_BASE_URL 均未配置时触发）——该文件属于 Task 4 删除范围，
// 不从那里 import，避免留一条注定要断的依赖。协议引擎的 VideoCallRequest.baseUrl
// 是必填 string（不像旧 createTask 接受 null 并自行兜底），故这条兜底必须留在
// 调用方，翻译过来保持与今天逐字节一致。
const ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com';

function resolveEngineBaseUrl(baseUrl: string | null | undefined): string {
  const trimmed = baseUrl?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : ARK_DEFAULT_BASE_URL;
}

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
    private readonly seedanceApi: SeedanceApiService,
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
      payload: Record<string, unknown> | SeedanceTaskStatus;
    }> = [];

    for (const g of toPoll) {
      try {
        const clip = await this.repository.findClipParams(g.clipId);
        if (!g.providerTaskId) continue;

        const apiContext = await this.modelResolver.resolveApiContextForClipParams(
          clip?.params ?? null,
        );
        if (!apiContext) continue;

        const payload = await this.seedanceApi.queryTask(
          apiContext.apiKey,
          g.providerTaskId,
          apiContext.baseUrl,
        );
        pairs.push({ generation: g, payload });
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
    const preset = resolveVideoPreset(readProtocolKey(modelConfig.metadata));
    const callbackUrl = this.callbackUrlBuilder.build();
    const callRequest = {
      preset,
      baseUrl: resolveEngineBaseUrl(baseUrl),
      apiKey,
      // FIX-3: 始终使用服务端解析/鉴权过的模型，忽略客户端传入的 params.model，
      // 防止"选便宜模型过鉴权、用 params.model 偷换为贵模型"导致跑贵付便宜。
      // toUnifiedVideoParams 不投影 model，这条不变量天然成立。
      model: modelConfig.model,
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

    if (requestContent.length === 0)
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
        // 过渡期常量：此刻 Seedance/Ark 是唯一视频协议。计划 3 切到引擎后，
        // 这里会改为 modelConfig.metadata.protocolKey，并与旧 flow 一起删除。
        protocolKey: 'ark-video@v3',
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
   * payload 来自 Seedance（callback body 或 GET /tasks/{id} / list）；二者结构一致。
   */
  async applyTaskStatus(
    generation: video_clip_generations,
    payload: Record<string, unknown> | SeedanceTaskStatus,
  ) {
    if (await this.terminalConvergence.reconcileIfTerminal(generation)) return;

    const raw = payload as Record<string, unknown>;
    const outcome = normalizeSeedanceTaskOutcome(raw);
    if (outcome.kind === 'missing_status') {
      this.logger.warn(
        `applyTaskStatus: missing status for generation ${generation.id}`,
      );
      return;
    }

    if (outcome.kind === 'succeeded') {
      const generationParams =
        generation.params && typeof generation.params === 'object' && !Array.isArray(generation.params)
          ? (generation.params as Record<string, unknown>)
          : {};
      const isStoryboardProjectGeneration =
        generationParams.generationMode === 'storyboard';
      const failureReason = resolveSucceededGenerationFailureReason({
        sourceUrl: outcome.sourceUrl,
      });
      if (failureReason) {
        this.logger.warn(
          `succeeded but missing video_url, generation=${generation.id}`,
        );
        await this.markGenerationFailed(
          generation,
          failureReason,
          outcome.externalStatus,
        );
        return;
      }

      const videoUrl = await this.videoAssets.persistProviderVideo(
        outcome.sourceUrl,
        generation.id,
      );
      const videoResolution = resolveSucceededGenerationVideo({
        sourceUrl: outcome.sourceUrl,
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
          outcome.externalStatus,
        );
        return;
      }

      const completedInput = buildCompletedGenerationInput({
        generation,
        outcome,
        videoUrl: videoResolution.videoUrl,
      });
      if (isStoryboardProjectGeneration) {
        await this.repository.markProjectGenerationCompletedAndConfirmHold(
          {
            generationId: completedInput.generationId,
            projectId: generation.projectId,
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
      } else {
        await this.repository.markGenerationCompletedAndConfirmHold(
          completedInput,
          (tx) =>
            this.holdReconciliation.confirmGenerationHoldWithinTx(
              tx,
              generation.id,
            ),
        );
      }
      if (!isStoryboardProjectGeneration) {
        await this.projectStatusConvergence.recalculateProjectStatus(
          generation.projectId,
        );
      }
    } else if (outcome.kind === 'failed') {
      const generationParams =
        generation.params && typeof generation.params === 'object' && !Array.isArray(generation.params)
          ? (generation.params as Record<string, unknown>)
          : {};
      const isStoryboardProjectGeneration =
        generationParams.generationMode === 'storyboard';
      const failedInput = buildFailedGenerationInput({ generation, outcome });
      if (isStoryboardProjectGeneration) {
        await this.repository.markProjectGenerationFailedAndRefund(
          {
            generationId: failedInput.generationId,
            projectId: generation.projectId,
            status: failedInput.status,
            externalStatus: failedInput.externalStatus,
            error: failedInput.error,
          },
          (tx) =>
            this.holdReconciliation.refundGenerationHoldWithinTx(
              tx,
              generation.id,
              outcome.refundReason,
            ),
        );
        return;
      }

      await this.repository.markGenerationFailedAndRefund(
        failedInput,
        (tx) =>
          this.holdReconciliation.refundGenerationHoldWithinTx(
            tx,
            generation.id,
            outcome.refundReason,
          ),
      );
      await this.projectStatusConvergence.convergeAfterClipFailure({
        clipId: generation.clipId,
        projectId: generation.projectId,
      });
    } else {
      await this.repository.updateGenerationExternalStatus(
        generation.id,
        outcome.externalStatus,
      );
    }
  }

  async handleCallback(taskId: string, payload: Record<string, unknown>) {
    const generation = await this.repository.findGenerationByProviderTaskId(
      'ark-video@v3',
      taskId,
    );
    if (!generation) {
      this.logger.warn(`Callback for unknown taskId: ${taskId}`);
      return;
    }
    await this.applyTaskStatus(generation, payload);
  }

  /**
   * 用户/管理员手动刷新单个 generation。走 `queryTask` 单查 + 统一收敛入口。
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

    const clip = await this.repository.findClipById(generation.clipId);
    const apiContext = await this.modelResolver.resolveApiContextForClipParamsOrThrow(
      clip?.params ?? null,
    );

    try {
      const payload = await this.seedanceApi.queryTask(
        apiContext.apiKey,
        generation.providerTaskId,
        apiContext.baseUrl,
      );
      await this.applyTaskStatus(generation, payload);
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
   * 接收 (generation, payload) 元组数组，串行调用 `applyTaskStatus`。
   * 本方法不做 API 调用，调用方需自行完成 Seedance.listTasks/queryTask 并配对。
   */
  async pollPendingByTaskIds(
    pairs: Array<{
      generation: video_clip_generations;
      payload: Record<string, unknown> | SeedanceTaskStatus;
    }>,
  ) {
    for (const { generation, payload } of pairs) {
      try {
        if (await this.terminalConvergence.reconcileIfTerminal(generation))
          continue;
        await this.applyTaskStatus(generation, payload);
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

    await this.repository.markGenerationFailedAndRefund(
      buildExpiredGenerationInput({ generation, reason }),
      (tx) =>
        this.holdReconciliation.refundGenerationHoldWithinTx(
          tx,
          generation.id,
          reason,
        ),
    );
    await this.projectStatusConvergence.convergeAfterClipFailure({
      clipId: generation.clipId,
      projectId: generation.projectId,
    });

    this.logger.warn(
      `Generation ${generationId} marked expired: ${reason}`,
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
    const preset = resolveVideoPreset(readProtocolKey(modelConfig.metadata));
    const callbackUrl = this.callbackUrlBuilder.build();
    const callRequest = {
      preset,
      baseUrl: resolveEngineBaseUrl(baseUrl),
      apiKey,
      // FIX-3: 服务端解析过的模型，不采信 params.model（同 generateClip）。
      model: modelConfig.model,
      prompt: resolvedPrompt,
      materials: storyboardMaterials,
      params: toUnifiedVideoParams(params),
      callbackUrl,
    };
    const requestBody = assembleVideoRequest(callRequest);
    const requestContent = Array.isArray(requestBody.content)
      ? (requestBody.content as Array<{ type: string }>)
      : [];
    if (requestContent.length === 0)
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
        // 过渡期常量：此刻 Seedance/Ark 是唯一视频协议。计划 3 切到引擎后，
        // 这里会改为 modelConfig.metadata.protocolKey，并与旧 flow 一起删除。
        protocolKey: 'ark-video@v3',
        modelConfigId,
      });

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
    generation: { id: string; clipId: string; projectId: string },
    reason: string,
    externalStatus: string,
  ) {
    await this.repository.markGenerationFailedAndRefund(
      buildExplicitFailedGenerationInput({ generation, reason, externalStatus }),
      (tx) =>
        this.holdReconciliation.refundGenerationHoldWithinTx(
          tx,
          generation.id,
          reason,
        ),
    );
    await this.projectStatusConvergence.convergeAfterClipFailure({
      clipId: generation.clipId,
      projectId: generation.projectId,
    });
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
