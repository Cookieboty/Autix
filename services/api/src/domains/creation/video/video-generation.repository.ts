import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import {
  MessageRole,
  VideoClipStatus,
  VideoGenStatus,
  VideoProjectStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { buildGenerationMaterialRows } from '../materials/generation-library';
import { claimVideoTerminal } from './video-generation-terminal-cas';

@Injectable()
export class VideoGenerationRepository {
  private readonly logger = new AppLogger(VideoGenerationRepository.name);

  constructor(private readonly prisma: PrismaService) {}

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
    input: { generationId: string; clipId: string; error: string },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await claimVideoTerminal(tx, input.generationId, {
        status: VideoGenStatus.failed,
        error: input.error,
      });
      // 输家立即退出：不标 clip failed，更不退款——否则并发下同一 hold 会被退两次。
      if (!claimed) return false;

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });
      await refundHold(tx);
      return true;
    });
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
    const claimed = await this.prisma.$transaction(async (tx) => {
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
      if (!won) return false;

      // updateMany 不回行，落素材要的 userId/prompt/model/createdAt 在同一事务里重读。
      const generation = await tx.video_clip_generations.findUnique({
        where: { id: input.generationId },
      });

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
      return true;
    });
    if (!claimed) return false;
    // 事务已提交：扣费确认与生成状态已经落定，素材同步失败不再影响它们。
    if (pendingAsset) await this.persistGeneratedVideoAsset(pendingAsset);
    return true;
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
    const claimed = await this.prisma.$transaction(async (tx) => {
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
      if (!won) return false;

      // updateMany 不回行，落素材要的 userId/prompt/model/createdAt 在同一事务里重读。
      const generation = await tx.video_clip_generations.findUnique({
        where: { id: input.generationId },
      });

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
      return true;
    });
    if (!claimed) return false;
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
    },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await claimVideoTerminal(tx, input.generationId, {
        status: input.status,
        externalStatus: input.externalStatus,
        error: input.error,
        callbackReceivedAt: new Date(),
      });
      // 输家立即退出：不标 clip failed，更不退款——重复退款会凭空发积分。
      if (!claimed) return false;

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });

      await refundHold(tx);
      return true;
    });
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

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });
      return true;
    });
  }

  /**
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
    },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await claimVideoTerminal(tx, input.generationId, {
        status: input.status,
        externalStatus: input.externalStatus,
        error: input.error,
        callbackReceivedAt: new Date(),
      });
      // 输家立即退出：真终态多半是赢家刚落的 completed，这里再走下去会把整个项目
      // 连同所有分镜打成 failed，并且重复退款（凭空发积分）。
      if (!claimed) return false;

      await tx.video_clips.updateMany({
        where: { projectId: input.projectId },
        data: { status: VideoClipStatus.failed },
      });

      await tx.video_projects.update({
        where: { id: input.projectId },
        data: { status: VideoProjectStatus.failed },
      });

      await refundHold(tx);
      return true;
    });
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
      // 直连无父 clip/project——不做任何父行 update（与 createPendingGenerationAndMarkRunning 的关键区别）
    });
  }

  /**
   * 直连生成提交失败（上游明确拒绝）时标记终态。只 update generation 行本身——
   * 与 markGenerationCreateTaskFailedAndRefund 的关键区别：直连行没有父 clip，
   * 不做任何父行 update，也不在这里退款（退款由调用方经 holdReconciliation.safeRefund
   * 单独完成，两者不共享事务，任一失败不影响另一个）。
   *
   * **刻意不开事务**：同 markDirectGenerationExpiredWithoutRefund —— CAS 是唯一写操作。
   *
   * @returns true = 本次抢到 failed；false = 已是终态，不得覆盖。调用方据此决定是否退款。
   */
  markDirectGenerationFailed(generationId: string, error: string): Promise<boolean> {
    return claimVideoTerminal(this.prisma, generationId, {
      status: VideoGenStatus.failed,
      error,
    });
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
    const claimed = await this.prisma.$transaction(async (tx) => {
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
      if (!won) return false;

      // updateMany 不回行，落素材要的 userId/prompt/model/createdAt 在同一事务里重读。
      const generation = await tx.video_clip_generations.findUnique({
        where: { id: input.generationId },
      });

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
      return true;
    });
    if (!claimed) return false;
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
    },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await claimVideoTerminal(tx, input.generationId, {
        status: input.status,
        externalStatus: input.externalStatus,
        error: input.error,
        callbackReceivedAt: new Date(),
      });
      // 输家立即退出：真终态多半是赢家刚落的 completed，重复退款会凭空发积分。
      if (!claimed) return false;

      await refundHold(tx);
      return true;
    });
  }

  /**
   * 直连超时排水（不退款，退款交积分侧孤儿回收）。
   *
   * **刻意不开事务**：CAS 是本方法唯一的写操作，单条 updateMany 自身即原子，
   * 包一层 $transaction 只是多一次往返。claimVideoTerminal 的形参类型
   * `Prisma.TransactionClient` 是 PrismaClient 的结构子集，直接传 this.prisma 合法。
   *
   * @returns true = 本次抢到 expired；false = 已是终态（多半是赢家刚落的 completed），
   * 不得覆盖。
   */
  markDirectGenerationExpiredWithoutRefund(input: {
    generationId: string;
    externalStatus: string;
    error: string;
  }): Promise<boolean> {
    return claimVideoTerminal(this.prisma, input.generationId, {
      status: VideoGenStatus.expired,
      externalStatus: input.externalStatus,
      error: input.error,
      callbackReceivedAt: new Date(),
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
