import { HttpStatus, Injectable } from '@nestjs/common';
import { TemplateStatus } from '../../platform/prisma/generated';
import { ImageWorkbenchRepository } from './image-workbench.repository';
import { GalleryService } from '../gallery/gallery.service';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

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
   * 守卫：该生成若还有活着的广场帖（status <> REMOVED）→ 409，要求用户先处理掉帖子
   * （PENDING 撤回 / PUBLISHED 先下架再删帖）。gallery_posts.imageGenerationId 没有外键，
   * DB 不会拦，放行就会留下「本人历史里没了、广场里还挂着」的孤儿帖。
   *
   * 刻意不做「删生成记录时级联撤帖」：删图这个动作不该隐含一个用户没明确要求的副作用
   * （把作品从广场撤下）。fail-closed，把决定权交回用户。
   */
  async deleteHistoryItem(userId: string, id: string) {
    const activePosts = await this.galleryService.findActivePostsByGenerationIds(userId, [id]);
    const galleryPost = activePosts.get(id);
    if (galleryPost) {
      throw new I18nHttpException(HttpStatus.CONFLICT, 'creation.image_gen.already_posted', undefined, {
        data: { galleryPost: { id: galleryPost.id, status: galleryPost.status } },
      });
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
