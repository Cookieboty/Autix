import { Injectable } from '@nestjs/common';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
import { VideoMaterialRepository } from './video-material.repository';

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
    private readonly repository: VideoMaterialRepository,
    private readonly r2Service: CloudflareR2Service,
  ) {}

  async getImageGenerationProducts(
    userId: string,
    opts: { page?: number; pageSize?: number; conversationId?: string },
  ) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    let generationIds: string[] | undefined;
    if (opts.conversationId) {
      generationIds =
        await this.repository.findGenerationIdsFromConversation(
          opts.conversationId,
        );
      if (generationIds.length === 0) {
        return { items: [], total: 0, page, pageSize, hasMore: false };
      }
    }

    const { generations, total } =
      await this.repository.findCompletedImageGenerations({
        userId,
        page,
        pageSize,
        generationIds,
      });

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

    const { generations, total } =
      await this.repository.findCompletedVideoGenerations({
        userId,
        page,
        pageSize,
      });

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
    userId?: string;
  }) {
    return this.r2Service.createPresignedUpload({
      fileName: opts.fileName,
      contentType: opts.contentType,
      folder: opts.folder ?? 'amux-studio/video-materials',
      userId: opts.userId,
    });
  }
}
