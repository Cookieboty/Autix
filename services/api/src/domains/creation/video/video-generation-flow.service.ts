import { Injectable, BadRequestException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import {
  VideoGenStatus,
  type Prisma,
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
import { VideoChainTriggerDispatcherService } from './video-chain-trigger-dispatcher.service';
import { VideoGenerationHoldReconciliationService } from './video-generation-hold-reconciliation.service';
import { VideoGenerationModelResolverService } from './video-generation-model-resolver.service';
import { VideoGenerationRepository } from './video-generation.repository';
import { VideoGenerationTerminalConvergenceService } from './video-generation-terminal-convergence.service';
import { VideoProjectStatusConvergenceService } from './video-project-status-convergence.service';
import {
  buildSeedanceCostEstimateInput,
  buildSeedanceTaskRequestOptions,
  buildVideoHoldInput,
  getFirstPendingClip,
  getPendingHeadClips,
  normalizeSeedanceTaskOutcome,
  presentGenerateAllClipResults,
  resolveClipPrompt,
  resolveVideoGenerationRequestLimits,
  type VideoGenerationClipParams as ClipParams,
} from './video-generation-flow.helpers';

export interface ClipGenerateInput {
  clipId: string;
  projectId: string;
  userId: string;
  variantLabel?: string;
}

@Injectable()
export class VideoGenerationFlowService implements OnModuleInit {
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
    private readonly chainTriggerDispatcher: VideoChainTriggerDispatcherService,
  ) { }

  async onModuleInit() {
    await this.modelResolver.probeDefaultVideoModel();
    // 第二阶段：启动期只读探测动态视频计费规则，缺失时 WARN，实际生成时阻断。
    try {
      const rules =
        await this.repository.findActiveSeedancePricingRulesForProbe();
      if (rules.length === 0) {
        this.logger.warn(
          '未发现 Seedance 动态计费规则；generateClip 将在计费预估阶段阻断生成。',
        );
      } else {
        this.logger.log(
          `Seedance 动态计费规则已启用: ${rules.map((r) => r.taskType).join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Seedance 动态计费规则探测失败: ${(err as Error).message}`,
      );
    }
  }

  @Cron('*/5 * * * *')
  async pollPendingGenerations() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const pending =
      await this.repository.findQueuedGenerationsCreatedBefore(tenMinutesAgo);

    if (pending.length === 0) return;

    const toExpire = pending.filter((g) => g.createdAt < thirtyMinutesAgo);
    for (const g of toExpire) {
      await this.markExpired(g.id, 'cron: queued 超过 30 分钟未完成');
    }

    const toPoll = pending.filter((g) => g.createdAt >= thirtyMinutesAgo && g.seedanceTaskId);
    if (toPoll.length === 0) return;

    const pairs: Array<{
      generation: typeof toPoll[number];
      payload: Record<string, unknown> | SeedanceTaskStatus;
    }> = [];

    for (const g of toPoll) {
      try {
        const clip = await this.repository.findClipParams(g.clipId);
        if (!g.seedanceTaskId) continue;

        const apiKey = await this.modelResolver.getApiKeyForClipParams(
          clip?.params ?? null,
        );
        if (!apiKey) continue;

        const payload = await this.seedanceApi.queryTask(apiKey, g.seedanceTaskId);
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

    const params = (clip.params ?? {}) as ClipParams;

    // P0-1: 会员等级闸门——视频生成前先校验当前会员套餐能力（分辨率/时长/开关）
    // 必须在 createHold / 调用供应商之前完成，避免占用积分和成本。
    const entitlement = await this.membershipService.resolveVideoEntitlements(
      input.userId,
    );
    const requestLimits = resolveVideoGenerationRequestLimits(params);
    this.membershipService.assertVideoEntitlement(entitlement, {
      resolution: requestLimits.resolution,
      durationSeconds: requestLimits.durationSeconds,
    });

    // P3-2: 轻量 RiskService 校验硬上限（时长/分辨率）+ 并发数（基于现有 video_clip_generations 计数）
    await this.riskService.assertVideoRequest(input.userId, entitlement, {
      resolution: requestLimits.resolution,
      durationSeconds: requestLimits.durationSeconds,
    });

    const { modelConfigId, modelConfig, apiKey } =
      await this.modelResolver.resolveForGeneration({
        id: clip.id,
        params: clip.params,
      });

    let materials = [...clip.materials];

    if (clip.chainFromPrev) {
      const prevClip = await this.repository.findClipAtOrder(
        input.projectId,
        clip.order - 1,
      );
      if (prevClip) {
        const prevGen =
          await this.repository.findLatestCompletedGenerationForClip(
            prevClip.id,
          );
        if (prevGen?.lastFrameUrl) {
          materials = materials.filter((m) => m.role !== 'first_frame');
          materials.unshift({
            id: 'chain_first_frame',
            clipId: input.clipId,
            role: 'first_frame',
            sourceType: 'video_generation',
            sourceId: prevGen.id,
            url: prevGen.lastFrameUrl,
            name: 'Auto from previous clip',
            metadata: null,
            createdAt: new Date(),
          });
        }
      }
    }

    const hasNextClip = await this.repository.clipExistsAtOrder(
      input.projectId,
      clip.order + 1,
    );
    const returnLastFrame = !!hasNextClip;

    const resolvedPrompt = resolveClipPrompt(clip.prompt, params);
    const content = this.seedanceApi.buildContent(materials, resolvedPrompt);

    if (content.length === 0)
      throw new BadRequestException('Clip 缺少素材或 prompt');

    const taskRequest = this.seedanceApi.buildTaskRequest(
      buildSeedanceTaskRequestOptions({
        params,
        model: modelConfig.model,
        content,
        callbackUrl: this.callbackUrlBuilder.build(),
        returnLastFrame,
      }),
    );

    const generationId: string = randomUUID();
    const estimateInput = buildSeedanceCostEstimateInput({
      params,
      model: taskRequest.model,
      content,
    });
    const billingTaskType = estimateInput.taskType;
    let holdId: string | null = null;
    try {
      const estimate = await this.pointsService.estimateCost(estimateInput);

      const { hold } = await this.pointsService.createHold(
        input.userId,
        buildVideoHoldInput({
          billingTaskType,
          generationId,
          estimatedCost: estimate.estimatedCost,
          pricingSnapshot: estimate.pricingSnapshot,
          refundPolicy: estimate.refundPolicy,
          projectId: input.projectId,
          clipId: input.clipId,
          modelConfigId,
          taskRequest,
        }),
      );
      holdId = hold.id;
    } catch (err) {
      throw err;
    }

    try {
      await this.repository.createPendingGenerationAndMarkRunning({
        generationId,
        clipId: input.clipId,
        projectId: input.projectId,
        userId: input.userId,
        variantLabel: input.variantLabel,
        model: params.model ?? modelConfig.model,
        resolvedPrompt,
        params: taskRequest as unknown as Prisma.InputJsonValue,
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
      const taskResponse = await this.seedanceApi.createTask(
        apiKey,
        taskRequest,
      );

      await this.repository.markGenerationQueued(generationId, taskResponse.id);

      return { generationId, taskId: taskResponse.id };
    } catch (err) {
      await this.repository.markGenerationCreateTaskFailedAndRefund(
        {
          generationId,
          clipId: input.clipId,
          error:
            err instanceof Error ? err.message : 'Unknown error creating task',
        },
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
      if (!outcome.sourceUrl) {
        this.logger.warn(
          `succeeded but missing video_url, generation=${generation.id}`,
        );
        await this.markGenerationFailed(
          generation,
          'callback succeeded but video_url missing',
          outcome.externalStatus,
        );
        return;
      }

      const videoUrl = await this.videoAssets.persistProviderVideo(
        outcome.sourceUrl,
        generation.id,
      );
      if (!videoUrl) {
        this.logger.warn(
          `succeeded but R2 persist failed, generation=${generation.id}`,
        );
        await this.markGenerationFailed(
          generation,
          'callback succeeded but failed to persist video to R2',
          outcome.externalStatus,
        );
        return;
      }

      const confirmedUserId =
        await this.repository.markGenerationCompletedAndConfirmHold(
          {
            generationId: generation.id,
            clipId: generation.clipId,
            externalStatus: outcome.externalStatus,
            videoUrl,
            lastFrameUrl: outcome.lastFrameUrl,
            durationSec: outcome.durationSec,
          },
          (tx) =>
            this.holdReconciliation.confirmGenerationHoldWithinTx(
              tx,
              generation.id,
            ),
        );

      if (confirmedUserId) {
        this.holdReconciliation.settleVideoInvitation(confirmedUserId);
      }
      await this.chainTriggerDispatcher.triggerNextClipIfNeeded(
        generation,
        (next) => this.generateClip(next),
      );
      await this.projectStatusConvergence.recalculateProjectStatus(
        generation.projectId,
      );
    } else if (outcome.kind === 'failed') {
      await this.repository.markGenerationFailedAndRefund(
        {
          generationId: generation.id,
          clipId: generation.clipId,
          status: outcome.generationStatus,
          externalStatus: outcome.externalStatus,
          error: outcome.error,
        },
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
    const generation = await this.repository.findGenerationBySeedanceTaskId(
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
    if (!generation.seedanceTaskId)
      throw new BadRequestException('任务尚未创建，无法刷新');

    if (await this.terminalConvergence.reconcileIfTerminal(generation)) {
      return this.repository.findGenerationById(generation.id);
    }

    const clip = await this.repository.findClipById(generation.clipId);
    const apiKey = await this.modelResolver.getApiKeyForClipParamsOrThrow(
      clip?.params ?? null,
    );

    try {
      const payload = await this.seedanceApi.queryTask(
        apiKey,
        generation.seedanceTaskId,
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
      {
        generationId,
        clipId: generation.clipId,
        status: VideoGenStatus.expired,
        externalStatus: 'expired',
        error: reason,
      },
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

    // 链头 = chainFromPrev=false 且 status=pending；并行触发所有链头
    const heads = getPendingHeadClips(clips);

    if (heads.length === 0) {
      // 所有 head 都已生成或全是 chain（异常配置）→ 退化为"触发首 pending clip"以兼容旧行为
      const firstPending = getFirstPendingClip(clips);
      if (!firstPending)
        throw new BadRequestException('无可生成 Clip');
      const r = await this.generateClip({
        clipId: firstPending.id,
        projectId,
        userId,
      });
      return [{ ...r, clipId: firstPending.id }];
    }

    // 单个 head 失败不阻断其它 head；全失败才整体抛错
    const results = await Promise.all(
      heads.map(async (c) => {
        try {
          const r = await this.generateClip({
            clipId: c.id,
            projectId,
            userId,
          });
          return { ...r, clipId: c.id };
        } catch (err) {
          this.logger.error(
            `head clip ${c.id} trigger failed: ${String(
              err instanceof Error ? err.message : err,
            )}`,
          );
          return null;
        }
      }),
    );
    const ok = presentGenerateAllClipResults(results);
    if (ok.length === 0) {
      throw new BadRequestException(
        '所有 head clip 触发失败，请检查模型/计费配置',
      );
    }
    return ok;
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
      {
        generationId: generation.id,
        clipId: generation.clipId,
        status: VideoGenStatus.failed,
        externalStatus,
        error: reason,
      },
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
