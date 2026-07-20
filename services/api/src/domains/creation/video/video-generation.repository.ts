import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import {
  GenerationBillingStatus,
  GenerationKind,
  GenerationTaskStatus,
  MessageRole,
  VideoClipStatus,
  VideoGenStatus,
  VideoProjectStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { GenerationFailure } from '../../platform/generation-tasks/generation-failure';
import { GenerationTaskRecorder } from '../../platform/generation-tasks/generation-task.recorder';
import { buildGenerationMaterialRows } from '../materials/generation-library';
import { claimVideoTerminal } from './video-generation-terminal-cas';

/** 三条 create 路径共有的 generation_tasks 侧字段（`start()` 的入参投影）。 */
export interface VideoGenerationTaskSeed {
  /** 提交时的模型 provider 快照，仅用于观测归因。 */
  provider?: string | null;
  materialCount: number;
  holdId: string | null;
}

@Injectable()
export class VideoGenerationRepository {
  private readonly logger = new AppLogger(VideoGenerationRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taskRecorder: GenerationTaskRecorder,
  ) {}

  /**
   * generation_tasks 的终态 CAS 与 video_clip_generations 的终态 CAS 在同一事务里执行，
   * 正常情况下二者胜负恒一致（同一把锁下的同一条生成）。任务侧判负只有两种成因，
   * 它们的正确处置**恰好相反**，故必须分辨而不能塌缩成同一条日志：
   *
   * (a) **任务行不存在** —— 本特性上线前就已在 pending/queued 的存量行（或回填未执行），
   *     它们没有 generation_tasks 记录，`updateMany` 恒命中 0 行。此时**必须以
   *     video_clip_generations 的胜负为准**：任务表是观测侧的派生记录，让它的判负回滚整个
   *     事务，等于让存量行永远无法收敛终态、hold 只能等 60min 孤儿回收。故只告警不抛。
   *
   * (b) **任务行存在但已是终态** —— 两表分叉，真·不变量破坏。今天不可达（10 个
   *     `claimVideoTerminal` 调用点的任务终态写入都在本事务内，两表 CLAIMABLE_FROM 相同），
   *     但一旦有人在视频事务之外写 generation_tasks 终态（管理后台、对账 cron、图片侧
   *     共用 id），继续提交就是把分叉永久固化。故**抛出使事务回滚**，并打 error 级日志。
   *
   * 判别读只发生在罕见的判负分支上，且是一次主键读 —— 热路径零额外查询。
   *
   * @returns 任务行是否存在。false（存量行）时调用方应跳过 `recordBilling` ——
   * 那次 update 必然 P2025，被 recorder 吞掉后只会多打一条比 warn 更容易误触告警的
   * error 级噪音。
   */
  private async resolveTaskClaim(
    tx: Prisma.TransactionClient,
    claimed: boolean,
    generationId: string,
    target: string,
  ): Promise<boolean> {
    if (claimed) return true;

    const task = await tx.generation_tasks.findUnique({
      where: { id: generationId },
      select: { status: true },
    });

    if (!task) {
      this.logger.warn(
        `generation_tasks 终态未抢到（多半是本特性上线前的存量行，无任务记录）：` +
          `generation=${generationId} target=${target} —— 以 video_clip_generations 为准，继续提交`,
      );
      return false;
    }

    const message =
      `generation_tasks 与 video_clip_generations 两表分叉：任务行已是终态 ` +
      `status=${task.status}，而本次视频终态 CAS 刚抢到 target=${target} —— ` +
      `说明有人在视频事务之外写了任务终态。回滚本事务：generation=${generationId}`;
    this.logger.error(message);
    throw new Error(message);
  }

  findActiveProviderGenerations(limit = 50) {
    return this.prisma.video_clip_generations.findMany({
      where: {
        status: { in: [VideoGenStatus.queued, VideoGenStatus.pending] },
        providerTaskId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  findClipParams(clipId: string) {
    return this.prisma.video_clips.findUnique({
      where: { id: clipId },
      select: { params: true },
    });
  }

  findClipForGeneration(clipId: string) {
    return this.prisma.video_clips.findUnique({
      where: { id: clipId },
      include: { materials: true, project: true },
    });
  }

  findClipById(clipId: string) {
    return this.prisma.video_clips.findUnique({
      where: { id: clipId },
    });
  }

  findClipAtOrder(projectId: string, order: number) {
    return this.prisma.video_clips.findUnique({
      where: {
        projectId_order: { projectId, order },
      },
    });
  }

  async clipExistsAtOrder(projectId: string, order: number): Promise<boolean> {
    const clip = await this.prisma.video_clips.findUnique({
      where: {
        projectId_order: { projectId, order },
      },
      select: { id: true },
    });
    return !!clip;
  }

  findLatestCompletedGenerationForClip(clipId: string) {
    return this.prisma.video_clip_generations.findFirst({
      where: {
        clipId,
        status: VideoGenStatus.completed,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPendingGenerationAndMarkRunning(input: {
    generationId: string;
    clipId: string;
    projectId: string;
    userId: string;
    variantLabel?: string;
    model: string;
    resolvedPrompt: string;
    params: Prisma.InputJsonValue;
    /** 提交时的协议快照（不可变）。轮询/回调据此解析 preset。 */
    protocolKey: string;
    /** 提交时的模型配置 identity（不可变）。 */
    modelConfigId: string;
    task: VideoGenerationTaskSeed;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.video_clip_generations.create({
        data: {
          id: input.generationId,
          clipId: input.clipId,
          projectId: input.projectId,
          userId: input.userId,
          variantLabel: input.variantLabel,
          model: input.model,
          resolvedPrompt: input.resolvedPrompt,
          params: input.params,
          status: VideoGenStatus.pending,
          protocolKey: input.protocolKey,
          modelConfigId: input.modelConfigId,
        },
      });

      // 与 create 同事务：start 失败必须让整条生成不启动。若放到事务外 best-effort，
      // 任务行缺失会让终态 CAS 恒判负，反而阻塞生成收敛（见 warnIfTaskNotClaimed）。
      await this.startTaskWithinTx(tx, input);

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.generating },
      });

      await tx.video_projects.update({
        where: { id: input.projectId },
        data: { status: VideoProjectStatus.generating },
      });
    });
  }

  async createPendingProjectGenerationAndMarkRunning(input: {
    generationId: string;
    clipId: string;
    projectId: string;
    userId: string;
    variantLabel?: string;
    model: string;
    resolvedPrompt: string;
    params: Prisma.InputJsonValue;
    /** 提交时的协议快照（不可变）。轮询/回调据此解析 preset。 */
    protocolKey: string;
    /** 提交时的模型配置 identity（不可变）。 */
    modelConfigId: string;
    task: VideoGenerationTaskSeed;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.video_clip_generations.create({
        data: {
          id: input.generationId,
          clipId: input.clipId,
          projectId: input.projectId,
          userId: input.userId,
          variantLabel: input.variantLabel,
          model: input.model,
          resolvedPrompt: input.resolvedPrompt,
          params: input.params,
          status: VideoGenStatus.pending,
          protocolKey: input.protocolKey,
          modelConfigId: input.modelConfigId,
        },
      });

      // 与 create 同事务（同 createPendingGenerationAndMarkRunning）。
      await this.startTaskWithinTx(tx, input);

      await tx.video_clips.updateMany({
        where: { projectId: input.projectId },
        data: { status: VideoClipStatus.generating },
      });

      await tx.video_projects.update({
        where: { id: input.projectId },
        data: { status: VideoProjectStatus.generating },
      });
    });
  }

  markGenerationQueued(generationId: string, taskId: string) {
    return this.prisma.video_clip_generations.update({
      where: { id: generationId },
      data: {
        providerTaskId: taskId,
        status: VideoGenStatus.queued,
        externalStatus: 'queued',
      },
    });
  }

  /**
   * @returns true = 本次抢到终态并已写完所有副作用；false = 已被并发的另一路径写成终态，
   * 本次整体放弃（未写 clip、未退款）。
   */
  async markGenerationCreateTaskFailedAndRefund(
    input: { generationId: string; clipId: string; error: string; failure: GenerationFailure },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<boolean> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const won = await claimVideoTerminal(tx, input.generationId, {
        status: VideoGenStatus.failed,
        error: input.error,
      });
      // 输家立即退出：不标 clip failed，更不退款——否则并发下同一 hold 会被退两次。
      if (!won) return null;

      // 同事务写任务终态：stage 由调用方给（此路径恒为 SUBMIT）。
      const taskRowExists = await this.resolveTaskClaim(
        tx,
        await this.taskRecorder.fail(input.generationId, input.failure, tx),
        input.generationId,
        'FAILED',
      );

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });
      await refundHold(tx);
      return { taskRowExists };
    });
    if (!outcome) return false;
    // 计费记录与主事务正交，提交之后再写：它失败不该回滚已经落定的终态与退款。
    // 任务行不存在（存量行）时跳过：那次 update 必然 P2025，只会多一条 error 级噪音。
    if (outcome.taskRowExists) {
      await this.taskRecorder.recordBilling(input.generationId, GenerationBillingStatus.REFUNDED);
    }
    return true;
  }

  /**
   * 完成的生成视频同步进素材库，让 /asset 与素材选择面板能聚合到生成内容。
   * 三个完成入口（直连 / 分镜 / 项目）共用。
   *
   * **刻意不在完成事务内调用**：素材同步只是派生视图，而同一事务里还有 confirmHold
   * （真实扣费确认）与生成状态落库。放进去意味着素材写入的任何失败——唯一索引冲突之外的
   * 约束错、连接抖动——都会把已确认的扣费和已完成的生成一起回滚，把「视频生成好了」
   * 变成「视频没了钱也退了」，用可有可无的副产品绑架了关键路径。
   * 因此改为事务提交后单独写，失败只记日志：素材缺失可由回填脚本补，扣费回滚不能。
   *
   * skipDuplicates 配合 partial unique index 保证幂等：回调重投、回填重跑都不会重复。
   */
  private async persistGeneratedVideoAsset(input: {
    userId: string;
    generationId: string;
    videoUrl: string;
    lastFrameUrl: string | null;
    durationSec: number | null;
    prompt: string;
    model: string;
    createdAt: Date;
  }) {
    try {
      await this.prisma.material_assets.createMany({
        data: buildGenerationMaterialRows({
          userId: input.userId,
          generationId: input.generationId,
          urls: [input.videoUrl],
          prompt: input.prompt,
          kind: 'video',
          // 封面走末帧：视频没有自带缩略图，素材库/选择面板拿它当 poster
          thumbnailUrl: input.lastFrameUrl,
          createdAt: input.createdAt,
          metadata: { modelUsed: input.model, durationSec: input.durationSec },
        }),
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.error(
        `material sync failed for generation=${input.generationId}: ${(error as Error).message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async markGenerationCompletedAndConfirmHold(
    input: {
      generationId: string;
      clipId: string;
      externalStatus: string;
      videoUrl: string;
      lastFrameUrl: string | null;
      durationSec: number | null;
    },
    confirmHold: (tx: Prisma.TransactionClient) => Promise<{ userId: string }>,
  ): Promise<boolean> {
    let pendingAsset: Parameters<typeof this.persistGeneratedVideoAsset>[0] | null = null;
    const outcome = await this.prisma.$transaction(async (tx) => {
      // CAS 必须排在 confirmHold 之前：抢不到就不能确认扣费，否则并发下同一 hold
      // 被确认两次。原实现先 confirmHold 再无条件 update，正是这个缺陷的来源。
      const won = await claimVideoTerminal(tx, input.generationId, {
        status: VideoGenStatus.completed,
        externalStatus: input.externalStatus,
        videoUrl: input.videoUrl,
        lastFrameUrl: input.lastFrameUrl,
        durationSec: input.durationSec,
        callbackReceivedAt: new Date(),
        completedAt: new Date(),
      });
      // 输家整体放弃：不确认 hold、不标 clip completed、不落素材。
      if (!won) return null;

      // updateMany 不回行，落素材要的 userId/prompt/model/createdAt 在同一事务里重读。
      const generation = await tx.video_clip_generations.findUnique({
        where: { id: input.generationId },
      });

      const taskRowExists = await this.succeedTaskWithinTx(
        tx,
        input.generationId,
        generation?.createdAt,
      );

      await confirmHold(tx);

      // 素材同步挪到事务外（见 persistGeneratedVideoAsset 注释）：这里只留取数据。
      // userId 取生成记录本身而非 confirmation——素材归属该跟着生成走，
      // 而不是跟着谁付的款。
      if (generation) {
        pendingAsset = {
          userId: generation.userId,
          generationId: input.generationId,
          videoUrl: input.videoUrl,
          lastFrameUrl: input.lastFrameUrl,
          durationSec: input.durationSec,
          prompt: generation.resolvedPrompt,
          model: generation.model,
          createdAt: generation.createdAt,
        };
      }

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.completed },
      });
      return { taskRowExists };
    });
    if (!outcome) return false;
    // 计费记录与主事务正交，提交之后再写（同 markGenerationCreateTaskFailedAndRefund）。
    if (outcome.taskRowExists) {
      await this.taskRecorder.recordBilling(input.generationId, GenerationBillingStatus.CONFIRMED);
    }
    // 事务已提交：扣费确认与生成状态已经落定，素材同步失败不再影响它们。
    if (pendingAsset) await this.persistGeneratedVideoAsset(pendingAsset);
    return true;
  }

  /**
   * 三条完成路径共用的任务侧成功终态写入。必须在 `claimVideoTerminal` 之后、同事务内调用。
   *
   * `durationMs` 取「视频行 createdAt → 现在」：任务行与视频行同事务创建，两者的
   * submittedAt/createdAt 同源，这样算不必额外读一次 generation_tasks。
   */
  private async succeedTaskWithinTx(
    tx: Prisma.TransactionClient,
    generationId: string,
    createdAt: Date | undefined,
  ): Promise<boolean> {
    const claimed = await this.taskRecorder.succeed(
      generationId,
      { durationMs: createdAt ? Date.now() - createdAt.getTime() : undefined },
      tx,
    );
    return this.resolveTaskClaim(tx, claimed, generationId, 'SUCCEEDED');
  }

  /**
   * @returns true = 本次抢到终态并已写完所有副作用；false = 已被并发的另一路径写成终态，
   * 本次整体放弃（未确认 hold、未收敛分镜/项目、未落素材）。
   */
  async markProjectGenerationCompletedAndConfirmHold(
    input: {
      generationId: string;
      projectId: string;
      externalStatus: string;
      videoUrl: string;
      lastFrameUrl: string | null;
      durationSec: number | null;
    },
    confirmHold: (tx: Prisma.TransactionClient) => Promise<{ userId: string }>,
  ): Promise<boolean> {
    let pendingAsset: Parameters<typeof this.persistGeneratedVideoAsset>[0] | null = null;
    const outcome = await this.prisma.$transaction(async (tx) => {
      // CAS 必须排在 confirmHold 之前：抢不到就不能确认扣费，否则并发下同一 hold
      // 被确认两次。原实现先 confirmHold 再无条件 update，正是这个缺陷的来源。
      const won = await claimVideoTerminal(tx, input.generationId, {
        status: VideoGenStatus.completed,
        externalStatus: input.externalStatus,
        videoUrl: input.videoUrl,
        lastFrameUrl: input.lastFrameUrl,
        durationSec: input.durationSec,
        callbackReceivedAt: new Date(),
        completedAt: new Date(),
      });
      // 输家整体放弃：不确认 hold、不把分镜/项目收敛成 completed、不落素材。
      if (!won) return null;

      // updateMany 不回行，落素材要的 userId/prompt/model/createdAt 在同一事务里重读。
      const generation = await tx.video_clip_generations.findUnique({
        where: { id: input.generationId },
      });

      const taskRowExists = await this.succeedTaskWithinTx(
        tx,
        input.generationId,
        generation?.createdAt,
      );

      await confirmHold(tx);

      // 素材同步挪到事务外（见 persistGeneratedVideoAsset 注释）：这里只留取数据。
      // userId 取生成记录本身而非 confirmation——素材归属该跟着生成走，
      // 而不是跟着谁付的款。
      if (generation) {
        pendingAsset = {
          userId: generation.userId,
          generationId: input.generationId,
          videoUrl: input.videoUrl,
          lastFrameUrl: input.lastFrameUrl,
          durationSec: input.durationSec,
          prompt: generation.resolvedPrompt,
          model: generation.model,
          createdAt: generation.createdAt,
        };
      }

      await tx.video_clips.updateMany({
        where: { projectId: input.projectId },
        data: { status: VideoClipStatus.completed },
      });

      await tx.video_projects.update({
        where: { id: input.projectId },
        data: { status: VideoProjectStatus.completed },
      });
      return { taskRowExists };
    });
    if (!outcome) return false;
    // 计费记录与主事务正交，提交之后再写。
    if (outcome.taskRowExists) {
      await this.taskRecorder.recordBilling(input.generationId, GenerationBillingStatus.CONFIRMED);
    }
    // 事务已提交：扣费确认与生成状态已经落定，素材同步失败不再影响它们。
    if (pendingAsset) await this.persistGeneratedVideoAsset(pendingAsset);
    return true;
  }

  async markGenerationFailedAndRefund(
    input: {
      generationId: string;
      clipId: string;
      status: VideoGenStatus;
      externalStatus: string;
      error: string;
      /** stage 由调用方显式给（POLL / CALLBACK / PERSIST），**不得**从 callbackReceivedAt 推断。 */
      failure: GenerationFailure;
    },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<boolean> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const won = await claimVideoTerminal(tx, input.generationId, {
        status: input.status,
        externalStatus: input.externalStatus,
        error: input.error,
        callbackReceivedAt: new Date(),
      });
      // 输家立即退出：不标 clip failed，更不退款——重复退款会凭空发积分。
      if (!won) return null;

      const taskRowExists = await this.failTaskWithinTx(
        tx,
        input.generationId,
        input.failure,
        input.status,
      );

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });

      await refundHold(tx);
      return { taskRowExists };
    });
    if (!outcome) return false;
    if (outcome.taskRowExists) {
      await this.taskRecorder.recordBilling(input.generationId, GenerationBillingStatus.REFUNDED);
    }
    return true;
  }

  /**
   * 失败/超时路径共用的任务侧终态写入。必须在 `claimVideoTerminal` 之后、同事务内调用。
   *
   * 任务状态由视频状态直译：`expired → EXPIRED`，其余 → `FAILED`。stage 一律取
   * `failure.stage`（调用方显式传入），不做任何推断。
   */
  private async failTaskWithinTx(
    tx: Prisma.TransactionClient,
    generationId: string,
    failure: GenerationFailure,
    videoStatus: VideoGenStatus,
  ): Promise<boolean> {
    const status =
      videoStatus === VideoGenStatus.expired
        ? GenerationTaskStatus.EXPIRED
        : GenerationTaskStatus.FAILED;
    const claimed = await this.taskRecorder.fail(generationId, failure, tx, status);
    return this.resolveTaskClaim(tx, claimed, generationId, status);
  }

  /**
   * 标记 generation 为终态但**不退款** —— 供超时排水用（video-generation-flow.service
   * 的 markExpired）。退款是积分侧孤儿回收（PointsHoldReclaimCron，60min）的职责：
   * 视频域不替上游判"我猜它失败了"然后退钱，只把无人认领的任务排出轮询队列。
   *
   * 与 markGenerationFailedAndRefund 逐字相同，**只去掉最后的 refundHold(tx)**：
   * generation 与 clip 两条状态 update 都保留（clip 也要标 failed，否则项目状态收敛不对）。
   */
  async markGenerationExpiredWithoutRefund(input: {
    generationId: string;
    clipId: string;
    status: VideoGenStatus;
    externalStatus: string;
    error: string;
    /** 恒为 stage=POLL：排水由轮询 cron 触发。 */
    failure: GenerationFailure;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await claimVideoTerminal(tx, input.generationId, {
        status: input.status,
        externalStatus: input.externalStatus,
        error: input.error,
        callbackReceivedAt: new Date(),
      });
      // 输家立即退出：真终态（多半是刚落的 completed）已由赢家写好，
      // 这里再标 clip failed 会把成功的分镜打成失败。
      if (!claimed) return false;

      await this.failTaskWithinTx(tx, input.generationId, input.failure, input.status);

      // 本路径**不退款**（退款交积分侧孤儿回收），故不写 billingStatus ——
      // 写 REFUNDED 会是谎报，写 REFUND_FAILED 也不对：这里根本没试过退款。

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });
      return true;
    });
  }

  /**
   * @param billing 本次退款的**结局**，由调用方显式给 —— 本方法**不得**自行断言
   * 「退了就是成功了」。两条调用路径的退款位置不同：
   *
   *  - 终态对账路径（flow :695）在 `refundHold` 里真的于本事务内退款，成功即提交，
   *    故传 `{ status: REFUNDED }`；
   *  - storyboard createTask 失败路径（flow :1146）的退款早在**事务之外**由
   *    `safeRefund` 完成了，这里传进来的是个 no-op `refundHold`。仓储层无从得知那次
   *    退款成没成，若照旧无条件写 REFUNDED，则 safeRefund 失败时会出现
   *    `billingStatus=REFUNDED` 但 hold 仍是 PENDING —— 钱不会丢（60min 孤儿回收兜底），
   *    但运维查「这笔到底退没退」时那个字段在说谎。故由调用方按 `safeRefund` 的返回值
   *    传 `REFUNDED` / `REFUND_FAILED`。
   *
   * 传 `null` = 本路径根本没试过退款（如压根没有 hold），一个 billing 字段都不写 ——
   * 同 `markGenerationExpiredWithoutRefund` 的理由：写 REFUNDED 是谎报，写
   * REFUND_FAILED 也不对。
   *
   * @returns true = 本次抢到终态并已写完所有副作用；false = 已被并发的另一路径写成终态，
   * 本次整体放弃（未把分镜/项目打成 failed、未退款）。
   */
  async markProjectGenerationFailedAndRefund(
    input: {
      generationId: string;
      projectId: string;
      status: VideoGenStatus;
      externalStatus: string;
      error: string;
      /** stage 由调用方显式给（SUBMIT / POLL / CALLBACK / PERSIST）。 */
      failure: GenerationFailure;
    },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
    billing: { status: GenerationBillingStatus; error?: string } | null,
  ): Promise<boolean> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const won = await claimVideoTerminal(tx, input.generationId, {
        status: input.status,
        externalStatus: input.externalStatus,
        error: input.error,
        callbackReceivedAt: new Date(),
      });
      // 输家立即退出：真终态多半是赢家刚落的 completed，这里再走下去会把整个项目
      // 连同所有分镜打成 failed，并且重复退款（凭空发积分）。
      if (!won) return null;

      const taskRowExists = await this.failTaskWithinTx(
        tx,
        input.generationId,
        input.failure,
        input.status,
      );

      await tx.video_clips.updateMany({
        where: { projectId: input.projectId },
        data: { status: VideoClipStatus.failed },
      });

      await tx.video_projects.update({
        where: { id: input.projectId },
        data: { status: VideoProjectStatus.failed },
      });

      await refundHold(tx);
      return { taskRowExists };
    });
    if (!outcome) return false;
    if (billing && outcome.taskRowExists) {
      await this.taskRecorder.recordBilling(input.generationId, billing.status, billing.error);
    }
    return true;
  }

  updateGenerationExternalStatus(generationId: string, externalStatus: string) {
    return this.prisma.video_clip_generations.update({
      where: { id: generationId },
      data: { externalStatus },
    });
  }

  findGenerationByProviderTaskId(protocolKey: string, taskId: string) {
    return this.prisma.video_clip_generations.findFirst({
      where: { protocolKey, providerTaskId: taskId },
    });
  }

  findOwnedGeneration(input: {
    generationId: string;
    projectId: string;
    userId: string;
  }) {
    return this.prisma.video_clip_generations.findFirst({
      where: {
        id: input.generationId,
        projectId: input.projectId,
        userId: input.userId,
      },
    });
  }

  findGenerationById(generationId: string) {
    return this.prisma.video_clip_generations.findUnique({
      where: { id: generationId },
    });
  }

  findProjectOwner(projectId: string) {
    return this.prisma.video_projects.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    });
  }

  findProjectClipsOrdered(projectId: string) {
    return this.prisma.video_clips.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      include: { materials: true },
    });
  }

  async createDirectPendingGeneration(input: {
    generationId: string;
    userId: string;
    model: string;
    resolvedPrompt: string;
    params: Prisma.InputJsonValue;
    protocolKey: string;
    modelConfigId: string;
    task: VideoGenerationTaskSeed;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.video_clip_generations.create({
        data: {
          id: input.generationId,
          clipId: null,
          projectId: null,
          userId: input.userId,
          model: input.model,
          resolvedPrompt: input.resolvedPrompt,
          params: input.params,
          status: VideoGenStatus.pending,
          protocolKey: input.protocolKey,
          modelConfigId: input.modelConfigId,
        },
      });

      // 与 create 同事务（同 createPendingGenerationAndMarkRunning）。
      await this.startTaskWithinTx(tx, input);
      // 直连无父 clip/project——不做任何父行 update（与 createPendingGenerationAndMarkRunning 的关键区别）
    });
  }

  /**
   * 三条 create 路径共用的 `start()` 调用。**必须由调用方在 create 所在事务内调用** ——
   * `start` 不是 best-effort，抛出即让整条生成不启动（recorder 的契约）。
   *
   * `videoGenerationId` 在此就写：视频行与任务行同事务创建，反向指针在 start 时即已成立
   * （与图片的 `imageGenerationId` 只在成功终态才写形成对照）。
   */
  private startTaskWithinTx(
    tx: Prisma.TransactionClient,
    input: {
      generationId: string;
      userId: string;
      model: string;
      resolvedPrompt: string;
      params: Prisma.InputJsonValue;
      protocolKey: string;
      modelConfigId: string;
      task: VideoGenerationTaskSeed;
    },
  ) {
    return this.taskRecorder.start(
      {
        id: input.generationId,
        kind: GenerationKind.VIDEO,
        userId: input.userId,
        model: input.model,
        modelConfigId: input.modelConfigId,
        provider: input.task.provider,
        protocolKey: input.protocolKey,
        prompt: input.resolvedPrompt,
        paramsSnapshot: input.params,
        materialCount: input.task.materialCount,
        holdId: input.task.holdId,
        videoGenerationId: input.generationId,
      },
      tx,
    );
  }

  /**
   * 直连生成提交失败（上游明确拒绝）时标记终态。只 update generation 行本身——
   * 与 markGenerationCreateTaskFailedAndRefund 的关键区别：直连行没有父 clip，
   * 不做任何父行 update，也不在这里退款（退款由调用方经 holdReconciliation.safeRefund
   * 单独完成，两者不共享事务，任一失败不影响另一个）。
   *
   * **改为开事务**（原先刻意不开）：接入 generation_tasks 后本方法有两张表的 CAS，
   * 必须同事务原子化 —— 否则视频行已 failed 而任务行还停在 QUEUED，观测数据永久失真。
   *
   * @returns true = 本次抢到 failed；false = 已是终态，不得覆盖。调用方据此决定是否退款。
   */
  markDirectGenerationFailed(
    generationId: string,
    error: string,
    failure: GenerationFailure,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await claimVideoTerminal(tx, generationId, {
        status: VideoGenStatus.failed,
        error,
      });
      if (!claimed) return false;
      await this.failTaskWithinTx(tx, generationId, failure, VideoGenStatus.failed);
      return true;
    });
    // 退款不在本方法内（由调用方经 safeRefund 单独完成），故 billingStatus 也由调用方记。
  }

  /**
   * 直连终态写入器（三件套）—— 与 markGenerationCompletedAndConfirmHold /
   * markGenerationFailedAndRefund / markGenerationExpiredWithoutRefund 的关键区别：
   * 直连行没有父 clip/project，只 update generation 行本身，不做任何
   * tx.video_clips.update —— 那个 where: { id: clipId } 在 clipId 为 null 时会抛。
   */
  /**
   * @returns true = 本次抢到终态并已确认扣费/落素材；false = 已被并发的另一路径写成终态，
   * 本次整体放弃（未确认 hold、未落素材）。
   */
  async markDirectGenerationCompletedAndConfirmHold(
    input: {
      generationId: string;
      externalStatus: string;
      videoUrl: string;
      lastFrameUrl: string | null;
      durationSec: number | null;
    },
    confirmHold: (tx: Prisma.TransactionClient) => Promise<{ userId: string }>,
  ): Promise<boolean> {
    let pendingAsset: Parameters<typeof this.persistGeneratedVideoAsset>[0] | null = null;
    const outcome = await this.prisma.$transaction(async (tx) => {
      // CAS 必须排在 confirmHold 之前：抢不到就不能确认扣费，否则并发下同一 hold
      // 被确认两次。原实现先 confirmHold 再无条件 update，正是这个缺陷的来源。
      const won = await claimVideoTerminal(tx, input.generationId, {
        status: VideoGenStatus.completed,
        externalStatus: input.externalStatus,
        videoUrl: input.videoUrl,
        lastFrameUrl: input.lastFrameUrl,
        durationSec: input.durationSec,
        callbackReceivedAt: new Date(),
        completedAt: new Date(),
      });
      // 输家整体放弃：不确认 hold、不落素材。
      if (!won) return null;

      // updateMany 不回行，落素材要的 userId/prompt/model/createdAt 在同一事务里重读。
      const generation = await tx.video_clip_generations.findUnique({
        where: { id: input.generationId },
      });

      const taskRowExists = await this.succeedTaskWithinTx(
        tx,
        input.generationId,
        generation?.createdAt,
      );

      await confirmHold(tx);

      // 素材同步挪到事务外（见 persistGeneratedVideoAsset 注释）：这里只留取数据。
      // userId 取生成记录本身而非 confirmation——素材归属该跟着生成走，
      // 而不是跟着谁付的款。
      if (generation) {
        pendingAsset = {
          userId: generation.userId,
          generationId: input.generationId,
          videoUrl: input.videoUrl,
          lastFrameUrl: input.lastFrameUrl,
          durationSec: input.durationSec,
          prompt: generation.resolvedPrompt,
          model: generation.model,
          createdAt: generation.createdAt,
        };
      }
      return { taskRowExists };
    });
    if (!outcome) return false;
    // 计费记录与主事务正交，提交之后再写。
    if (outcome.taskRowExists) {
      await this.taskRecorder.recordBilling(input.generationId, GenerationBillingStatus.CONFIRMED);
    }
    // 事务已提交：扣费确认与生成状态已经落定，素材同步失败不再影响它们。
    if (pendingAsset) await this.persistGeneratedVideoAsset(pendingAsset);
    return true;
  }

  /**
   * @returns true = 本次抢到终态并已退款；false = 已被并发的另一路径写成终态，本次整体
   * 放弃（未退款 —— 重复退款会凭空发积分）。
   */
  async markDirectGenerationFailedAndRefund(
    input: {
      generationId: string;
      status: VideoGenStatus;
      externalStatus: string;
      error: string;
      /** stage 由调用方显式给（POLL / CALLBACK / PERSIST）。 */
      failure: GenerationFailure;
    },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<boolean> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const won = await claimVideoTerminal(tx, input.generationId, {
        status: input.status,
        externalStatus: input.externalStatus,
        error: input.error,
        callbackReceivedAt: new Date(),
      });
      // 输家立即退出：真终态多半是赢家刚落的 completed，重复退款会凭空发积分。
      if (!won) return null;

      const taskRowExists = await this.failTaskWithinTx(
        tx,
        input.generationId,
        input.failure,
        input.status,
      );

      await refundHold(tx);
      return { taskRowExists };
    });
    if (!outcome) return false;
    if (outcome.taskRowExists) {
      await this.taskRecorder.recordBilling(input.generationId, GenerationBillingStatus.REFUNDED);
    }
    return true;
  }

  /**
   * 直连超时排水（不退款，退款交积分侧孤儿回收）。
   *
   * **改为开事务**（原先刻意不开）：接入 generation_tasks 后本方法有两张表的 CAS，
   * 必须同事务原子化，理由同 markDirectGenerationFailed。
   *
   * @returns true = 本次抢到 expired；false = 已是终态（多半是赢家刚落的 completed），
   * 不得覆盖。
   */
  markDirectGenerationExpiredWithoutRefund(input: {
    generationId: string;
    externalStatus: string;
    error: string;
    /** 恒为 stage=POLL：排水由轮询 cron 触发。 */
    failure: GenerationFailure;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await claimVideoTerminal(tx, input.generationId, {
        status: VideoGenStatus.expired,
        externalStatus: input.externalStatus,
        error: input.error,
        callbackReceivedAt: new Date(),
      });
      if (!claimed) return false;
      await this.failTaskWithinTx(tx, input.generationId, input.failure, VideoGenStatus.expired);
      // 同 markGenerationExpiredWithoutRefund：本路径不退款，故不写 billingStatus。
      return true;
    });
  }

  async findUserDirectGenerations(input: { userId: string; page: number; pageSize: number }) {
    const skip = (input.page - 1) * input.pageSize;
    const where: Prisma.video_clip_generationsWhereInput = { userId: input.userId, clipId: null };
    const [generations, total] = await Promise.all([
      this.prisma.video_clip_generations.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: input.pageSize,
      }),
      this.prisma.video_clip_generations.count({ where }),
    ]);
    return { generations, total };
  }

  findOwnedDirectGeneration(input: { id: string; userId: string }) {
    return this.prisma.video_clip_generations.findFirst({
      where: { id: input.id, userId: input.userId, clipId: null },
    });
  }

  async deleteOwnedDirectGeneration(input: { id: string; userId: string }): Promise<'deleted' | 'not_found' | 'not_terminal'> {
    const row = await this.prisma.video_clip_generations.findFirst({
      where: { id: input.id, userId: input.userId, clipId: null },
      select: { id: true, status: true },
    });
    if (!row) return 'not_found';
    const terminal: VideoGenStatus[] = [VideoGenStatus.completed, VideoGenStatus.failed, VideoGenStatus.expired];
    if (!terminal.includes(row.status)) return 'not_terminal';
    await this.prisma.video_clip_generations.delete({ where: { id: input.id } });
    return 'deleted';
  }

  createVideoResultMessage(input: {
    conversationId: string;
    generationId: string;
    videoUrl: string;
    prompt: string;
  }) {
    return this.prisma.messages.create({
      data: {
        conversationId: input.conversationId,
        role: MessageRole.ASSISTANT,
        content: `视频已生成: ${input.videoUrl}`,
        metadata: {
          messageType: 'video_result',
          generationId: input.generationId,
          videoUrl: input.videoUrl,
          prompt: input.prompt,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
