import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudflareR2Service } from '../storage/cloudflare-r2.service';

export interface ImageGenerationItem {
  generationId: string;
  url: string;
  prompt: string;
  templateTitle: string | null;
  conversationId: string | null;
  createdAt: Date;
}

export interface VideoGenerationItem {
  generationId: string;
  videoUrl: string;
  lastFrameUrl: string | null;
  prompt: string;
  projectTitle: string;
  createdAt: Date;
}

@Injectable()
export class VideoMaterialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: CloudflareR2Service,
  ) {}

  async getImageGenerationProducts(
    userId: string,
    opts: { page?: number; pageSize?: number; conversationId?: string },
  ) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      userId,
      status: 'completed',
    };

    if (opts.conversationId) {
      const messages = await this.prisma.messages.findMany({
        where: { conversationId: opts.conversationId },
        select: { metadata: true },
      });
      const genIds = messages
        .map((m) => {
          const meta = m.metadata as Record<string, unknown> | null;
          return meta?.generationId as string | undefined;
        })
        .filter(Boolean) as string[];

      if (genIds.length > 0) {
        where.id = { in: genIds };
      } else {
        return { items: [], total: 0, page, pageSize, hasMore: false };
      }
    }

    const [generations, total] = await Promise.all([
      this.prisma.image_generations.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          template: { select: { title: true } },
        },
      }),
      this.prisma.image_generations.count({ where }),
    ]);

    const items: ImageGenerationItem[] = [];
    for (const gen of generations) {
      for (const url of gen.generatedImages) {
        items.push({
          generationId: gen.id,
          url,
          prompt: gen.resolvedPrompt,
          templateTitle: gen.template.title,
          conversationId: null,
          createdAt: gen.createdAt,
        });
      }
    }

    return { items, total, page, pageSize, hasMore: skip + generations.length < total };
  }

  async getVideoGenerationProducts(
    userId: string,
    opts: { page?: number; pageSize?: number },
  ) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [generations, total] = await Promise.all([
      this.prisma.video_clip_generations.findMany({
        where: { userId, status: 'completed', videoUrl: { not: null } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          clip: { include: { project: { select: { title: true } } } },
        },
      }),
      this.prisma.video_clip_generations.count({
        where: { userId, status: 'completed', videoUrl: { not: null } },
      }),
    ]);

    const items: VideoGenerationItem[] = generations.map((gen) => ({
      generationId: gen.id,
      videoUrl: gen.videoUrl!,
      lastFrameUrl: gen.lastFrameUrl,
      prompt: gen.resolvedPrompt,
      projectTitle: gen.clip.project.title,
      createdAt: gen.createdAt,
    }));

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async createPresignedUpload(opts: {
    fileName: string;
    contentType: string;
    folder?: string;
  }) {
    return this.r2Service.createPresignedUpload({
      fileName: opts.fileName,
      contentType: opts.contentType,
      folder: opts.folder ?? 'amux-studio/video-materials',
    });
  }
}
