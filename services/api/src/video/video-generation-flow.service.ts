import { Injectable, BadRequestException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  VideoGenStatus,
  VideoClipStatus,
  VideoProjectStatus,
  MessageRole,
  ModelType,
  type Prisma,
  type video_clip_generations,
} from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { CloudflareR2Service } from '../storage/cloudflare-r2.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { MembershipService } from '../membership/membership.service';
import { InviteService } from '../invite/invite.service';
import { RiskService } from '../risk/risk.service';
import {
  SeedanceApiService,
  type SeedanceTaskStatus,
} from './seedance-api.service';

export interface ClipGenerateInput {
  clipId: string;
  projectId: string;
  userId: string;
  variantLabel?: string;
}

interface ClipParams {
  model?: string;
  resolution?: string;
  ratio?: string;
  duration?: number;
  seed?: number;
  generateAudio?: boolean;
  generate_audio?: boolean;
  watermark?: boolean;
  modelConfigId?: string;
  generationMode?: string;
  storyboardPrompt?: string;
}

const TERMINAL_STATUSES = new Set<VideoGenStatus>([
  VideoGenStatus.completed,
  VideoGenStatus.failed,
  VideoGenStatus.expired,
]);

@Injectable()
export class VideoGenerationFlowService implements OnModuleInit {
  private readonly logger = new Logger(VideoGenerationFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly r2Service: CloudflareR2Service,
    private readonly modelConfigService: ModelConfigService,
    private readonly seedanceApi: SeedanceApiService,
    private readonly config: ConfigService,
    private readonly membershipService: MembershipService,
    private readonly inviteService: InviteService,
    private readonly riskService: RiskService,
  ) { }

  async onModuleInit() {
    // Plan-2: 启动期只读探测默认视频模型，缺失时 WARN（不阻断启动，避免开发态被卡）
    try {
      const def = await this.modelConfigService.findDefaultByType(
        ModelType.video,
      );
      if (!def) {
        this.logger.warn(
          '[Plan-2] 未发现默认视频模型 (type=video, isDefault=true)。',
        );
        this.logger.warn(
          '[Plan-2] 视频生成路径将依赖 clip.params.modelConfigId 显式指定；若也缺失则 generate 时抛 BadRequestException。',
        );
      } else {
        this.logger.log(
          `[Plan-2] 默认视频模型: ${def.name} (id=${def.id}, model=${def.model})`,
        );
      }
    } catch (err) {
      this.logger.warn(`[Plan-2] 默认视频模型探测失败: ${(err as Error).message}`);
    }

    // 第二阶段：启动期只读探测动态视频计费规则，缺失时 WARN，实际生成时阻断。
    try {
      const rules = await this.prisma.generation_pricing_rules.findMany({
        where: {
          taskType: {
            in: [
              'seedance_fast_720p',
              'seedance_480p',
              'seedance_720p',
              'seedance_1080p',
            ],
          },
          isActive: true,
        },
        select: { taskType: true, name: true },
      });
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

  /**
   * Plan-1: 服务端构造 Seedance 回调 URL，剥离前端控制。
   * APP_PUBLIC_URL 是部署域名（属于站点配置而非模型配置，**不可**写入 model_configs）：
   *   - 已配置 → 注入 callback_url，回调链路（主）+ cron（兜底）双保险；
   *   - 未配置 → 不传 callback_url，完全依赖 cron + 手动 refresh 收敛，避免本地/首发部署被硬卡。
   */
  private buildCallbackUrl(): string | undefined {
    const base = this.config.get<string>('APP_PUBLIC_URL');
    if (!base) return undefined;
    const trimmed = base.replace(/\/+$/, '');
    const secret = this.config.get<string>('VIDEO_CALLBACK_SECRET');
    const suffix = secret ? `?token=${encodeURIComponent(secret)}` : '';
    return `${trimmed}/api/video/callback${suffix}`;
  }

  private resolveClipPrompt(prompt: string | null, params: ClipParams): string {
    const clipPrompt = prompt?.trim() ?? '';
    const storyboardPrompt =
      params.generationMode === 'storyboard' && typeof params.storyboardPrompt === 'string'
        ? params.storyboardPrompt.trim()
        : '';

    return [
      storyboardPrompt ? `整片提示词：${storyboardPrompt}` : '',
      clipPrompt ? `当前分镜提示词：${clipPrompt}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  async generateClip(input: ClipGenerateInput) {
    const clip = await this.prisma.video_clips.findUnique({
      where: { id: input.clipId },
      include: { materials: true, project: true },
    });
    if (!clip) throw new BadRequestException('Clip 不存在');
    if (clip.project.userId !== input.userId)
      throw new BadRequestException('无权操作此项目');

    const params = (clip.params ?? {}) as ClipParams;
    const generateAudio =
      params.generateAudio ?? params.generate_audio;

    // P0-1: 会员等级闸门——视频生成前先校验当前会员套餐能力（分辨率/时长/开关）
    // 必须在 createHold / 调用供应商之前完成，避免占用积分和成本。
    const entitlement = await this.membershipService.resolveVideoEntitlements(
      input.userId,
    );
    const normalizedResolution = this.normalizeResolution(params.resolution) as
      | '480p'
      | '720p'
      | '1080p';
    const normalizedDuration = this.normalizeDuration(params.duration);
    this.membershipService.assertVideoEntitlement(entitlement, {
      resolution: normalizedResolution,
      durationSeconds: normalizedDuration,
    });

    // P3-2: 轻量 RiskService 校验硬上限（时长/分辨率）+ 并发数（基于现有 video_clip_generations 计数）
    await this.riskService.assertVideoRequest(input.userId, entitlement, {
      resolution: normalizedResolution,
      durationSeconds: normalizedDuration,
    });

    // Plan-2: 任意路径创建的 clip 都允许缺省 modelConfigId，运行时 fallback 到默认视频模型
    let modelConfigId = params.modelConfigId;
    if (!modelConfigId) {
      const def = await this.modelConfigService.findDefaultByType(
        ModelType.video,
      );
      if (!def) {
        throw new BadRequestException(
          '未配置默认视频模型，请先在管理后台配置（type=video, isDefault=true）',
        );
      }
      modelConfigId = def.id;
      // 回写 clip.params，避免每次 generate 都触发 fallback 查询
      const nextParams = {
        ...((clip.params as Record<string, unknown>) ?? {}),
        modelConfigId,
      };
      await this.prisma.video_clips.update({
        where: { id: clip.id },
        data: { params: nextParams as Prisma.InputJsonValue },
      });
      this.logger.log(
        `Clip ${clip.id} fallback to default video model ${modelConfigId}`,
      );
    }

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    const apiKey = modelConfig.apiKey;
    if (!apiKey)
      throw new BadRequestException('视频模型缺少 API Key 配置');

    let materials = [...clip.materials];

    if (clip.chainFromPrev) {
      const prevClip = await this.prisma.video_clips.findUnique({
        where: {
          projectId_order: { projectId: input.projectId, order: clip.order - 1 },
        },
      });
      if (prevClip) {
        const prevGen = await this.prisma.video_clip_generations.findFirst({
          where: {
            clipId: prevClip.id,
            status: VideoGenStatus.completed,
          },
          orderBy: { createdAt: 'desc' },
        });
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

    const hasNextClip = await this.prisma.video_clips.findUnique({
      where: {
        projectId_order: { projectId: input.projectId, order: clip.order + 1 },
      },
    });
    const returnLastFrame = !!hasNextClip;

    const resolvedPrompt = this.resolveClipPrompt(clip.prompt, params);
    const content = this.seedanceApi.buildContent(materials, resolvedPrompt);

    if (content.length === 0)
      throw new BadRequestException('Clip 缺少素材或 prompt');

    const taskRequest = this.seedanceApi.buildTaskRequest({
      model: params.model ?? modelConfig.model,
      content,
      callbackUrl: this.buildCallbackUrl(),
      returnLastFrame,
      generateAudio,
      resolution: params.resolution,
      ratio: params.ratio,
      duration: params.duration,
      seed: params.seed,
      watermark: params.watermark,
    });

    const generationId: string = randomUUID();
    const billingTaskType = this.resolveSeedancePricingTaskType(
      params,
      taskRequest.model,
    );
    let holdId: string | null = null;
    try {
      const estimate = await this.pointsService.estimateCost({
        taskType: billingTaskType,
        modelName: taskRequest.model,
        resolution: this.normalizeResolution(params.resolution),
        seconds: this.normalizeDuration(params.duration),
        referenceImages: content.filter((item) => item.type === 'image_url').length,
        hasVideoInput: content.some((item) => item.type === 'video_url'),
        hasAudioInput: content.some((item) => item.type === 'audio_url'),
      });

      const { hold } = await this.pointsService.createHold(input.userId, {
        taskType: billingTaskType,
        taskId: generationId,
        amount: estimate.estimatedCost,
        pricingSnapshot: this.toJson(estimate.pricingSnapshot),
        refundPolicySnapshot: this.toJson(estimate.refundPolicy),
        metadata: this.toJson({
          projectId: input.projectId,
          clipId: input.clipId,
          modelConfigId,
          seedanceTaskRequest: taskRequest,
        }),
        remark: `video-generation:${billingTaskType}`,
      });
      holdId = hold.id;
    } catch (err) {
      throw err;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.video_clip_generations.create({
          data: {
            id: generationId,
            clipId: input.clipId,
            projectId: input.projectId,
            userId: input.userId,
            variantLabel: input.variantLabel,
            model: params.model ?? modelConfig.model,
            resolvedPrompt,
            params: taskRequest as unknown as Prisma.InputJsonValue,
            status: VideoGenStatus.pending,
          },
        });

        await tx.video_clips.update({
          where: { id: input.clipId },
          data: { status: VideoClipStatus.generating },
        });

        await tx.video_projects.update({
          where: { id: input.projectId },
          data: { status: VideoProjectStatus.generating },
        });
      });
    } catch (err) {
      if (holdId) {
        await this.safeRefund(generationId, 'video generation creation failed');
      }
      throw err;
    }

    try {
      const taskResponse = await this.seedanceApi.createTask(
        apiKey,
        taskRequest,
      );

      await this.prisma.video_clip_generations.update({
        where: { id: generationId },
        data: {
          seedanceTaskId: taskResponse.id,
          status: VideoGenStatus.queued,
          externalStatus: 'queued',
        },
      });

      return { generationId, taskId: taskResponse.id };
    } catch (err) {
      await this.prisma.video_clip_generations.update({
        where: { id: generationId },
        data: {
          status: VideoGenStatus.failed,
          error:
            err instanceof Error ? err.message : 'Unknown error creating task',
        },
      });
      await this.prisma.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });
      await this.safeRefund(generationId, 'createTask 同步失败');
      await this.recalcProjectStatus(input.projectId);
      throw err;
    }
  }

  /**
   * Plan-1: 回调链路与查询链路共用的状态收敛入口。
   * 进入即对终态短路，保证 callback + cron/refresh 同时命中时的幂等性。
   * payload 来自 Seedance（callback body 或 GET /tasks/{id} / list）；二者结构一致。
   */
  async applyTaskStatus(
    generation: video_clip_generations,
    payload: Record<string, unknown> | SeedanceTaskStatus,
  ) {
    if (TERMINAL_STATUSES.has(generation.status)) {
      await this.reconcileTerminalHold(generation);
      return;
    }

    const raw = payload as Record<string, unknown>;
    const status = raw.status as string | undefined;
    if (!status) {
      this.logger.warn(
        `applyTaskStatus: missing status for generation ${generation.id}`,
      );
      return;
    }
    const externalStatus = status;

    if (status === 'succeeded') {
      // Plan-6: succeeded 但 video_url 缺失 → 不当 completed，退款 + cascade + recalc
      const sourceUrl =
        (raw.video_url as string | undefined) ??
        ((raw.content as { video_url?: string } | undefined)?.video_url);
      if (!sourceUrl) {
        this.logger.warn(
          `[Plan-6] succeeded but missing video_url, generation=${generation.id}`,
        );
        await this.markGenerationFailed(
          generation,
          'callback succeeded but video_url missing',
          externalStatus,
        );
        return;
      }

      const videoUrl = await this.downloadAndUploadVideo(
        sourceUrl,
        generation.id,
      );
      // Plan-6: R2 三次重试都失败 → 不再回退源 URL（火山链接 24h 过期），统一走兜底
      if (!videoUrl) {
        this.logger.warn(
          `[Plan-6] succeeded but R2 persist failed, generation=${generation.id}`,
        );
        await this.markGenerationFailed(
          generation,
          'callback succeeded but failed to persist video to R2',
          externalStatus,
        );
        return;
      }

      const lastFrameUrl =
        (raw.last_frame_url as string | undefined) ??
        ((raw.content as { last_frame_url?: string } | undefined)
          ?.last_frame_url);

      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: {
          status: VideoGenStatus.completed,
          externalStatus,
          videoUrl,
          lastFrameUrl: lastFrameUrl ?? null,
          durationSec: (raw.duration as number) ?? null,
          callbackReceivedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await this.prisma.video_clips.update({
        where: { id: generation.clipId },
        data: { status: VideoClipStatus.completed },
      });

      await this.safeConfirmHold(generation.id);
      await this.triggerNextClipIfNeeded(generation);
      await this.recalcProjectStatus(generation.projectId);
    } else if (status === 'failed' || status === 'expired') {
      const errorMsg =
        (raw.error as { message?: string })?.message ?? status;

      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: {
          status:
            status === 'expired'
              ? VideoGenStatus.expired
              : VideoGenStatus.failed,
          externalStatus,
          error: errorMsg,
          callbackReceivedAt: new Date(),
        },
      });

      await this.prisma.video_clips.update({
        where: { id: generation.clipId },
        data: { status: VideoClipStatus.failed },
      });

      await this.safeRefund(
        generation.id,
        status === 'expired' ? '视频生成超时' : `视频生成失败: ${errorMsg}`,
      );

      // Plan-5: 链段级联失败 + 项目状态收敛
      await this.cascadeFailDependents(generation.clipId);
      await this.recalcProjectStatus(generation.projectId);
    } else {
      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: { externalStatus },
      });
    }
  }

  async handleCallback(taskId: string, payload: Record<string, unknown>) {
    const generation = await this.prisma.video_clip_generations.findFirst({
      where: { seedanceTaskId: taskId },
    });
    if (!generation) {
      this.logger.warn(`Callback for unknown taskId: ${taskId}`);
      return;
    }
    await this.applyTaskStatus(generation, payload);
  }

  /**
   * Plan-1: 用户/管理员手动刷新单个 generation。走 `queryTask` 单查 + 统一收敛入口。
   */
  async refreshGeneration(args: {
    projectId: string;
    generationId: string;
    userId: string;
  }) {
    const generation = await this.prisma.video_clip_generations.findFirst({
      where: { id: args.generationId, projectId: args.projectId, userId: args.userId },
    });
    if (!generation) throw new NotFoundException('Generation 不存在');
    if (!generation.seedanceTaskId)
      throw new BadRequestException('任务尚未创建，无法刷新');

    if (TERMINAL_STATUSES.has(generation.status)) {
      return generation;
    }

    const clip = await this.prisma.video_clips.findUnique({
      where: { id: generation.clipId },
    });
    const modelConfigId = (clip?.params as ClipParams | null)?.modelConfigId;
    if (!modelConfigId)
      throw new BadRequestException('Clip 未配置模型，无法刷新');

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    if (!modelConfig.apiKey)
      throw new BadRequestException('视频模型缺少 API Key 配置');

    try {
      const payload = await this.seedanceApi.queryTask(
        modelConfig.apiKey,
        generation.seedanceTaskId,
      );
      await this.applyTaskStatus(generation, payload);
    } catch (err) {
      this.logger.warn(
        `refreshGeneration ${generation.id} failed: ${String(err instanceof Error ? err.message : err)}`,
      );
      throw err;
    }

    return this.prisma.video_clip_generations.findUnique({
      where: { id: generation.id },
    });
  }

  /**
   * Plan-1: cron 批查后批量收敛入口。
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
      if (TERMINAL_STATUSES.has(generation.status)) continue;
      try {
        await this.applyTaskStatus(generation, payload);
      } catch (err) {
        this.logger.warn(
          `pollPendingByTaskIds: apply ${generation.id} failed: ${String(err instanceof Error ? err.message : err)}`,
        );
      }
    }
  }

  /**
   * Plan-1: 强制将单个 generation 标记为 expired（cron 30min 兜底使用）。
   */
  async markExpired(generationId: string, reason: string) {
    const generation = await this.prisma.video_clip_generations.findUnique({
      where: { id: generationId },
    });
    if (!generation) return;
    if (TERMINAL_STATUSES.has(generation.status)) return;

    await this.prisma.video_clip_generations.update({
      where: { id: generationId },
      data: {
        status: VideoGenStatus.expired,
        externalStatus: 'expired',
        error: reason,
        callbackReceivedAt: new Date(),
      },
    });

    await this.prisma.video_clips.update({
      where: { id: generation.clipId },
      data: { status: VideoClipStatus.failed },
    });

    await this.safeRefund(generation.id, reason);
    await this.cascadeFailDependents(generation.clipId);
    await this.recalcProjectStatus(generation.projectId);

    this.logger.warn(
      `Generation ${generationId} marked expired: ${reason}`,
    );
  }

  async generateAllClips(projectId: string, userId: string) {
    // Plan-5: 项目级 owner 校验前置（避免越权批量提交，单个 generateClip 内部校验仍兜底）
    const project = await this.prisma.video_projects.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    });
    if (!project) throw new NotFoundException('项目不存在');
    if (project.userId !== userId)
      throw new BadRequestException('无权操作此项目');

    const clips = await this.prisma.video_clips.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    if (clips.length === 0)
      throw new BadRequestException('项目无 Clip');

    // Plan-5: 链头 = chainFromPrev=false 且 status=pending；并行触发所有链头
    const heads = clips.filter(
      (c) => !c.chainFromPrev && c.status === VideoClipStatus.pending,
    );

    if (heads.length === 0) {
      // 所有 head 都已生成或全是 chain（异常配置）→ 退化为"触发首 pending clip"以兼容旧行为
      const firstPending = clips.find(
        (c) => c.status === VideoClipStatus.pending,
      );
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
            `[Plan-5] head clip ${c.id} trigger failed: ${String(
              err instanceof Error ? err.message : err,
            )}`,
          );
          return null;
        }
      }),
    );
    const ok = results
      .filter((x): x is NonNullable<(typeof x)> => x !== null)
      .map((x) => ({
        generationId: String(x.generationId),
        taskId: x.taskId,
        clipId: x.clipId,
      }));
    if (ok.length === 0) {
      throw new BadRequestException(
        '所有 head clip 触发失败，请检查模型/计费配置',
      );
    }
    return ok;
  }

  private async triggerNextClipIfNeeded(
    generation: { clipId: string; projectId: string; userId: string },
  ) {
    // Plan-5: 仅做"chain 接力"；项目终态收敛交给 recalcProjectStatus 统一处理
    const clip = await this.prisma.video_clips.findUnique({
      where: { id: generation.clipId },
      select: { order: true },
    });
    if (!clip) return;

    const nextClip = await this.prisma.video_clips.findUnique({
      where: {
        projectId_order: {
          projectId: generation.projectId,
          order: clip.order + 1,
        },
      },
    });

    if (
      nextClip &&
      nextClip.status === VideoClipStatus.pending &&
      nextClip.chainFromPrev
    ) {
      try {
        await this.generateClip({
          clipId: nextClip.id,
          projectId: generation.projectId,
          userId: generation.userId,
        });
      } catch (err) {
        this.logger.error(
          `[Plan-5] chain trigger failed for clip ${nextClip.id}: ${String(
            err instanceof Error ? err.message : err,
          )}`,
        );
      }
    }
  }

  /**
   * Plan-5: project status 单一收敛入口。
   * 规则（迁就现有 enum，无 partial_failed）：
   *  - 任意 generating/pending → generating
   *  - 全部 failed → failed
   *  - 含 completed（部分成功也算）→ completed
   *  - 否则保留 draft
   */
  private async recalcProjectStatus(projectId: string) {
    const clips = await this.prisma.video_clips.findMany({
      where: { projectId },
      select: { status: true },
    });
    if (clips.length === 0) return;

    const has = (s: VideoClipStatus) => clips.some((c) => c.status === s);
    const all = (s: VideoClipStatus) => clips.every((c) => c.status === s);

    let next: VideoProjectStatus;
    if (has(VideoClipStatus.generating) || has(VideoClipStatus.pending)) {
      next = VideoProjectStatus.generating;
    } else if (all(VideoClipStatus.failed)) {
      next = VideoProjectStatus.failed;
    } else if (has(VideoClipStatus.completed)) {
      next = VideoProjectStatus.completed;
    } else {
      next = VideoProjectStatus.draft;
    }

    await this.prisma.video_projects.update({
      where: { id: projectId },
      data: { status: next },
    });
  }

  /**
   * Plan-5: 链段级联失败。
   * 当 brokenClip 失败时，沿"order 严格连续 + chainFromPrev=true + status=pending"的尾部链段
   * 批量标记为 failed，避免它们永远卡在 pending（前置依赖 lastFrame 已不可得）。
   * 严格停在第一处独立 head 或不连续 order，绝不跨链误伤。
   */
  private async cascadeFailDependents(brokenClipId: string) {
    const cur = await this.prisma.video_clips.findUnique({
      where: { id: brokenClipId },
      select: { id: true, projectId: true, order: true },
    });
    if (!cur) return;

    const tail = await this.prisma.video_clips.findMany({
      where: {
        projectId: cur.projectId,
        order: { gt: cur.order },
        status: VideoClipStatus.pending,
      },
      orderBy: { order: 'asc' },
    });

    let prev = cur.order;
    const failIds: string[] = [];
    for (const c of tail) {
      if (c.order !== prev + 1) break;
      if (!c.chainFromPrev) break;
      failIds.push(c.id);
      prev = c.order;
    }
    if (failIds.length === 0) return;

    await this.prisma.video_clips.updateMany({
      where: { id: { in: failIds } },
      data: { status: VideoClipStatus.failed },
    });
    this.logger.warn(
      `[Plan-5] cascade-failed ${failIds.length} chain clip(s) after broken ${brokenClipId}`,
    );
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
    await this.prisma.video_clip_generations.update({
      where: { id: generation.id },
      data: {
        status: VideoGenStatus.failed,
        externalStatus,
        error: reason,
        callbackReceivedAt: new Date(),
      },
    });
    await this.prisma.video_clips.update({
      where: { id: generation.clipId },
      data: { status: VideoClipStatus.failed },
    });
    await this.safeRefund(generation.id, reason);
    await this.cascadeFailDependents(generation.clipId);
    await this.recalcProjectStatus(generation.projectId);
  }

  private async downloadAndUploadVideo(
    sourceUrl: string | undefined,
    generationId: string,
  ): Promise<string | null> {
    if (!sourceUrl) return null;
    // Plan-6: 3 次重试 + 1s/2s 指数退避；任何分支失败均返回 null（不再回退源 URL，避免火山 24h 过期死链）
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) {
          throw new Error(`fetch source failed: HTTP ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const result = await this.r2Service.uploadBuffer(buffer, {
          contentType: 'video/mp4',
          folder: 'amux-studio/video-generations',
          ext: 'mp4',
        });
        return result.publicUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[Plan-6] R2 upload attempt ${attempt}/${MAX_ATTEMPTS} failed for generation=${generationId}: ${msg}`,
        );
        if (attempt === MAX_ATTEMPTS) return null;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    return null;
  }

  private normalizeResolution(value: string | undefined): string {
    const resolution = String(value ?? '720p').toLowerCase();
    if (resolution.includes('1080')) return '1080p';
    if (resolution.includes('480')) return '480p';
    return '720p';
  }

  private normalizeDuration(value: number | undefined): number {
    const duration = Number(value ?? 5);
    if (!Number.isFinite(duration) || duration <= 0) return 5;
    return Math.ceil(duration);
  }

  private resolveSeedancePricingTaskType(params: ClipParams, model: string): string {
    const modelName = model.toLowerCase();
    const resolution = this.normalizeResolution(params.resolution);
    if (resolution === '1080p') return 'seedance_1080p';
    if (resolution === '480p') return 'seedance_480p';
    if (modelName.includes('fast')) return 'seedance_fast_720p';
    return 'seedance_720p';
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private async safeConfirmHold(generationId: string) {
    try {
      const hold = await this.pointsService.findPendingHoldByTask({
        taskId: generationId,
      });
      if (!hold) {
        this.logger.warn(
          `point hold confirm skipped (no pending hold): generation=${generationId}`,
        );
        return;
      }
      await this.pointsService.confirmHold(hold.id);
      this.logger.log(
        `point hold confirmed: generation=${generationId} hold=${hold.id}`,
      );

      // P0-3: 视频生成成功后触发邀请奖励结算（幂等）
      this.inviteService
        .settleInvitationOnFirstGeneration(hold.userId)
        .catch((err) =>
          this.logger.warn(
            `settleInvitationOnFirstGeneration (video) failed: user=${hold.userId} reason=${(err as Error).message}`,
          ),
        );
    } catch (err) {
      this.logger.error(
        `point hold confirm failed: generation=${generationId} reason=${String(err instanceof Error ? err.message : err)}`,
      );
    }
  }

  private async reconcileTerminalHold(generation: {
    id: string;
    status: VideoGenStatus;
  }) {
    const hold = await this.pointsService.findPendingHoldByTask({
      taskId: generation.id,
    });
    if (!hold) return;
    if (generation.status === VideoGenStatus.completed) {
      await this.safeConfirmHold(generation.id);
      return;
    }
    if (
      generation.status === VideoGenStatus.failed ||
      generation.status === VideoGenStatus.expired
    ) {
      await this.safeRefund(generation.id, `终态对账: ${generation.status}`);
    }
  }

  private async safeRefund(generationId: string, reason: string) {
    try {
      const hold = await this.pointsService.findPendingHoldByTask({
        taskId: generationId,
      });
      if (hold) {
        const result = await this.pointsService.refundHold(hold.id, reason);
        this.logger.log(
          `point hold refunded: generation=${generationId} hold=${hold.id} amount=${result.amount} balance=${result.balance} reason=${reason}`,
        );
        return;
      }

      this.logger.warn(
        `points refund skipped (no pending hold): generation=${generationId}`,
      );
    } catch (err) {
      this.logger.error(
        `points refund failed: generation=${generationId} reason=${String(err instanceof Error ? err.message : err)}`,
      );
    }
  }

  async persistVideoMessage(
    conversationId: string | null,
    generationId: string,
    videoUrl: string,
    prompt: string,
  ) {
    if (!conversationId) return;

    await this.prisma.messages.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: `视频已生成: ${videoUrl}`,
        metadata: {
          messageType: 'video_result',
          generationId,
          videoUrl,
          prompt,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
