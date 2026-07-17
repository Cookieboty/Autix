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
