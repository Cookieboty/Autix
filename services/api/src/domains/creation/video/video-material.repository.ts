import { Injectable } from '@nestjs/common';
import {
  VideoGenStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class VideoMaterialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findGenerationIdsFromConversation(conversationId: string) {
    const messages = await this.prisma.messages.findMany({
      where: { conversationId },
      select: { metadata: true },
    });
    return messages
      .map((m) => {
        const meta = m.metadata as Record<string, unknown> | null;
        return meta?.generationId as string | undefined;
      })
      .filter((id): id is string => !!id);
  }

  async findCompletedImageGenerations(input: {
    userId: string;
    page: number;
    pageSize: number;
    generationIds?: string[];
  }) {
    const skip = (input.page - 1) * input.pageSize;
    const where: Prisma.image_generationsWhereInput = {
      userId: input.userId,
      status: 'completed',
    };
    if (input.generationIds) {
      where.id = { in: input.generationIds };
    }

    const [generations, total] = await Promise.all([
      this.prisma.image_generations.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: input.pageSize,
        include: {
          template: { select: { title: true } },
        },
      }),
      this.prisma.image_generations.count({ where }),
    ]);

    return {
      generations,
      total,
      page: input.page,
      pageSize: input.pageSize,
      skip,
    };
  }

  async findCompletedVideoGenerations(input: {
    userId: string;
    page: number;
    pageSize: number;
  }) {
    const skip = (input.page - 1) * input.pageSize;
    const where: Prisma.video_clip_generationsWhereInput = {
      userId: input.userId,
      status: VideoGenStatus.completed,
      videoUrl: { not: null },
      clipId: { not: null },
    };

    const [generations, total] = await Promise.all([
      this.prisma.video_clip_generations.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: input.pageSize,
        include: {
          clip: { include: { project: { select: { title: true } } } },
        },
      }),
      this.prisma.video_clip_generations.count({ where }),
    ]);

    return {
      generations,
      total,
      page: input.page,
      pageSize: input.pageSize,
      skip,
    };
  }
}
