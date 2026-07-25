import { Injectable } from '@nestjs/common';
import { TemplateStatus } from '../../platform/prisma/generated';
import { ImageWorkbenchRepository } from './image-workbench.repository';
import { GalleryService } from '../gallery/gallery.service';

@Injectable()
export class ImageWorkbenchService {
  constructor(
    private readonly imageWorkbenchRepository: ImageWorkbenchRepository,
    private readonly galleryService: GalleryService,
  ) {}

  async ensureWorkbenchTemplate(userId: string): Promise<string> {
    const template = await this.imageWorkbenchRepository.ensureWorkbenchTemplate(userId);
    if (template.status !== TemplateStatus.ARCHIVED) {
      await this.imageWorkbenchRepository.archiveTemplate(template.id);
    }
    return template.id;
  }

  async getHistory(userId: string, page?: string, pageSize?: string) {
    const templateId = await this.ensureWorkbenchTemplate(userId);
    const safePage = Math.max(1, page ? Number(page) || 1 : 1);
    const safePageSize = Math.min(60, Math.max(1, pageSize ? Number(pageSize) || 30 : 30));
    const skip = (safePage - 1) * safePageSize;

    const [items, total] = await this.imageWorkbenchRepository.findHistoryItems({
      userId,
      templateId,
      skip,
      pageSize: safePageSize,
    });

    // 整页一次批量查（不逐条），与 gallery feed 的 findLikedIds 防 N+1 同源。
    const galleryPosts = await this.galleryService.findActivePostsByGenerationIds(
      userId,
      items.map((item) => item.id),
    );

    return {
      items: items.map((item) => {
        const meta = this.workbenchMeta(item.variables);
        const sourceImages = Array.isArray(meta?.sourceImages) ? meta.sourceImages : [];
        const referenceImages = Array.isArray(meta?.referenceImages) ? meta.referenceImages : [];
        const galleryPost = galleryPosts.get(item.id);

        return {
          ...item,
          mode: meta?.mode,
          modelConfigId: typeof meta?.modelConfigId === 'string' ? meta.modelConfigId : null,
          chatModelId: typeof meta?.chatModelId === 'string' ? meta.chatModelId : null,
          settings: this.asRecord(meta?.settings) ?? {},
          sourceImages,
          referenceImages,
          ...(galleryPost ? { galleryPost } : {}),
          images: (item.generatedImages ?? []).map((url, index) => ({
            url,
            index,
            generationId: item.id,
            prompt: item.resolvedPrompt,
            sourceImages,
            referenceImages,
          })),
        };
      }),
      total,
      page: safePage,
      pageSize: safePageSize,
      hasMore: skip + items.length < total,
    };
  }

  /**
   * 删除一条生成记录。
   *
   * 产品口径：作者随时可删自己的图片。若该生成还挂着活着的广场帖，先级联 removePost
   * 把帖子归档（走 gallery.helpers 的 assertTransition，author 从任何非 HIDDEN→REMOVED 都合法；
   * HIDDEN→REMOVED 也允许），再删生成记录 —— 避免留下「历史里没了、广场还挂着」的孤儿帖。
   *
   * removePost 会走 removeAndArchiveTemplate 同事务归档关联模板，
   * PUBLISHED 作品若已 convertToTemplate，也会一并处理，不会留悬空模板。
   */
  async deleteHistoryItem(userId: string, id: string) {
    const activePosts = await this.galleryService.findActivePostsByGenerationIds(userId, [id]);
    const galleryPost = activePosts.get(id);
    if (galleryPost) {
      await this.galleryService.removePost(userId, galleryPost.id);
    }

    const templateId = await this.ensureWorkbenchTemplate(userId);
    await this.imageWorkbenchRepository.deleteHistoryItem(userId, templateId, id);
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private workbenchMeta(variables: unknown) {
    return this.asRecord(this.asRecord(variables)?.__workbench);
  }
}
