import { Injectable, BadRequestException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VideoGenStatus,
  VideoClipStatus,
  VideoProjectStatus,
  PointsSource,
  MessageRole,
  ModelType,
  type Prisma,
  type video_clip_generations,
} from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { CloudflareR2Service } from '../storage/cloudflare-r2.service';
import { ModelConfigService } from '../model-config/model-config.service';
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
  watermark?: boolean;
  modelConfigId?: string;
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

    // Plan-3: 启动期只读探测视频生成计费规则（task_point_costs.video_generation）
    try {
      const costRow = await this.prisma.task_point_costs.findUnique({
        where: { taskType: 'video_generation' },
      });
      if (!costRow) {
        this.logger.warn(
          '[Plan-3] 未发现 task_point_costs.video_generation 行；generateClip 将抛 BadRequestException 阻断生成。',
        );
        this.logger.warn(
          '[Plan-3] 请执行 migration 8_video_generation_cost 或在 task_point_costs 表手动 INSERT。',
        );
      } else if (!costRow.isActive) {
        this.logger.warn(
          `[Plan-3] task_point_costs.video_generation 已停用 (isActive=false)，generateClip 将抛错。`,
        );
      } else {
        this.logger.log(
          `[Plan-3] 视频生成计费: cost=${costRow.cost} (taskType=video_generation, active)`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `[Plan-3] 视频生成计费规则探测失败: ${(err as Error).message}`,
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

  async generateClip(input: ClipGenerateInput) {
    const clip = await this.prisma.video_clips.findUnique({
      where: { id: input.clipId },
      include: { materials: true, project: true },
    });
    if (!clip) throw new BadRequestException('Clip 不存在');
    if (clip.project.userId !== input.userId)
      throw new BadRequestException('无权操作此项目');

    const params = clip.params as ClipParams;
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

    const content = this.seedanceApi.buildContent(materials, clip.prompt);

    if (content.length === 0)
      throw new BadRequestException('Clip 缺少素材或 prompt');

    const taskRequest = this.seedanceApi.buildTaskRequest({
      model: params.model ?? modelConfig.model,
      content,
      callbackUrl: this.buildCallbackUrl(),
      returnLastFrame,
      generateAudio: params.generateAudio,
      resolution: params.resolution,
      ratio: params.ratio,
      duration: params.duration,
      seed: params.seed,
      watermark: params.watermark,
    });

    const generation = await this.prisma.video_clip_generations.create({
      data: {
        clipId: input.clipId,
        projectId: input.projectId,
        userId: input.userId,
        variantLabel: input.variantLabel,
        model: params.model ?? modelConfig.model,
        resolvedPrompt: clip.prompt ?? '',
        params: taskRequest as unknown as Prisma.InputJsonValue,
        status: VideoGenStatus.pending,
      },
    });

    await this.prisma.video_clips.update({
      where: { id: input.clipId },
      data: { status: VideoClipStatus.generating },
    });

    await this.prisma.video_projects.update({
      where: { id: input.projectId },
      data: { status: VideoProjectStatus.generating },
    });

    // Plan-3: 入口预扣 — generation 已落库，余额不足直接抛 BadRequestException（402 语义由 controller 决定）
    // sourceId=generation.id 是退款时反查的唯一锚点（schema 无 metadata 字段，不可改 schema）
    const taskCostRow = await this.prisma.task_point_costs.findUnique({
      where: { taskType: 'video_generation' },
    });
    if (!taskCostRow || !taskCostRow.isActive) {
      // 兜底：cost 行缺失或被禁用 → 标记 generation.failed 并抛错，避免悄悄跑出免费视频
      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: {
          status: VideoGenStatus.failed,
          error: 'task_point_costs.video_generation 未配置或已停用',
        },
      });
      await this.prisma.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });
      throw new BadRequestException(
        '视频生成计费规则未配置（task_point_costs.video_generation）',
      );
    }
    const cost = taskCostRow.cost;
    if (cost > 0) {
      try {
        await this.pointsService.deductPoints(
          input.userId,
          cost,
          PointsSource.TASK,
          generation.id,
          `video-generation: project ${input.projectId}`,
        );
      } catch (err) {
        // 余额不足等扣费失败：清理 generation/clip 状态并冒泡
        await this.prisma.video_clip_generations.update({
          where: { id: generation.id },
          data: {
            status: VideoGenStatus.failed,
            error:
              err instanceof Error ? err.message : '积分扣费失败',
          },
        });
        await this.prisma.video_clips.update({
          where: { id: input.clipId },
          data: { status: VideoClipStatus.failed },
        });
        throw err;
      }
    }

    try {
      const taskResponse = await this.seedanceApi.createTask(
        apiKey,
        taskRequest,
      );

      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: {
          seedanceTaskId: taskResponse.id,
          status: VideoGenStatus.queued,
          externalStatus: 'queued',
        },
      });

      return { generationId: generation.id, taskId: taskResponse.id };
    } catch (err) {
      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
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
      // Plan-3: createTask 同步失败 → 退款（refundByGenerationId 自带幂等，未扣过则 no-op）
      await this.safeRefund(generation.id, 'createTask 同步失败');
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
    if (TERMINAL_STATUSES.has(generation.status)) return;

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

      // Plan-3: 扣费时机已前移到 generateClip 入口，succeeded 分支不再二次扣费
      // Plan-5: 接力 chain，再统一收敛 project status
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

      // Plan-3: failed/expired 终态 → 退还入口预扣的积分（幂等）
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
   * 注意：积分回滚归 Plan-3 范畴，本方法只做状态收敛 + clip/project 状态联动。
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
    const ok = results.filter(
      (
        x,
      ): x is { generationId: string; taskId: string; clipId: string } =>
        x !== null,
    );
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
   * Plan-6: succeeded 兜底专用 — 当 callback 报 succeeded 但 video_url 缺失或 R2 持久化失败时，
   * 把 generation 视为失败，配套 plan-3 退款 + plan-5 cascade/recalc，避免幽灵 completed 记录。
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

  /**
   * Plan-3: 静默退款 — 退款失败不冒泡，避免污染 callback / refresh / cron 主流程。
   * 真实影响（含 refunded=false 的 no-op）已通过日志暴露，便于后续手工对账。
   */
  private async safeRefund(generationId: string, reason: string) {
    try {
      const result = await this.pointsService.refundByGenerationId(
        generationId,
        reason,
      );
      if (result.refunded) {
        this.logger.log(
          `[Plan-3] refund ok: generation=${generationId} amount=${result.amount} balance=${result.balance} reason=${reason}`,
        );
      } else {
        this.logger.warn(
          `[Plan-3] refund skipped (no consume row or already refunded): generation=${generationId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[Plan-3] refund failed: generation=${generationId} reason=${String(err instanceof Error ? err.message : err)}`,
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
