import { Injectable } from '@nestjs/common';
import {
  MessageRole,
  VideoClipStatus,
  VideoGenStatus,
  VideoProjectStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class VideoGenerationRepository {
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

  async markGenerationCreateTaskFailedAndRefund(
    input: { generationId: string; clipId: string; error: string },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.video_clip_generations.update({
        where: { id: input.generationId },
        data: {
          status: VideoGenStatus.failed,
          error: input.error,
        },
      });
      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });
      await refundHold(tx);
    });
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
  ): Promise<string | null> {
    let confirmedUserId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const confirmation = await confirmHold(tx);
      confirmedUserId = confirmation.userId;

      await tx.video_clip_generations.update({
        where: { id: input.generationId },
        data: {
          status: VideoGenStatus.completed,
          externalStatus: input.externalStatus,
          videoUrl: input.videoUrl,
          lastFrameUrl: input.lastFrameUrl,
          durationSec: input.durationSec,
          callbackReceivedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.completed },
      });
    });
    return confirmedUserId;
  }

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
  ): Promise<string | null> {
    let confirmedUserId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const confirmation = await confirmHold(tx);
      confirmedUserId = confirmation.userId;

      await tx.video_clip_generations.update({
        where: { id: input.generationId },
        data: {
          status: VideoGenStatus.completed,
          externalStatus: input.externalStatus,
          videoUrl: input.videoUrl,
          lastFrameUrl: input.lastFrameUrl,
          durationSec: input.durationSec,
          callbackReceivedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await tx.video_clips.updateMany({
        where: { projectId: input.projectId },
        data: { status: VideoClipStatus.completed },
      });

      await tx.video_projects.update({
        where: { id: input.projectId },
        data: { status: VideoProjectStatus.completed },
      });
    });
    return confirmedUserId;
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
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.video_clip_generations.update({
        where: { id: input.generationId },
        data: {
          status: input.status,
          externalStatus: input.externalStatus,
          error: input.error,
          callbackReceivedAt: new Date(),
        },
      });

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });

      await refundHold(tx);
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
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.video_clip_generations.update({
        where: { id: input.generationId },
        data: {
          status: input.status,
          externalStatus: input.externalStatus,
          error: input.error,
          callbackReceivedAt: new Date(),
        },
      });

      await tx.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });
    });
  }

  async markProjectGenerationFailedAndRefund(
    input: {
      generationId: string;
      projectId: string;
      status: VideoGenStatus;
      externalStatus: string;
      error: string;
    },
    refundHold: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.video_clip_generations.update({
        where: { id: input.generationId },
        data: {
          status: input.status,
          externalStatus: input.externalStatus,
          error: input.error,
          callbackReceivedAt: new Date(),
        },
      });

      await tx.video_clips.updateMany({
        where: { projectId: input.projectId },
        data: { status: VideoClipStatus.failed },
      });

      await tx.video_projects.update({
        where: { id: input.projectId },
        data: { status: VideoProjectStatus.failed },
      });

      await refundHold(tx);
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
