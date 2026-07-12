import { Injectable } from '@nestjs/common';
import { TemplateStatus } from '../../platform/prisma/generated';
import { ImageWorkbenchRepository } from './image-workbench.repository';

@Injectable()
export class ImageWorkbenchService {
  constructor(private readonly imageWorkbenchRepository: ImageWorkbenchRepository) {}

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

    return {
      items: items.map((item) => {
        const meta = this.workbenchMeta(item.variables);
        const sourceImages = Array.isArray(meta?.sourceImages) ? meta.sourceImages : [];
        const referenceImages = Array.isArray(meta?.referenceImages) ? meta.referenceImages : [];

        return {
          ...item,
          mode: meta?.mode,
          modelConfigId: typeof meta?.modelConfigId === 'string' ? meta.modelConfigId : null,
          chatModelId: typeof meta?.chatModelId === 'string' ? meta.chatModelId : null,
          settings: this.asRecord(meta?.settings) ?? {},
          sourceImages,
          referenceImages,
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

  async deleteHistoryItem(userId: string, id: string) {
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
