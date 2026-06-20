import { Injectable } from '@nestjs/common';
import { TemplateStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

const IMAGE_WORKBENCH_TEMPLATE_EXTERNAL_ID = 'system:image-workbench';

@Injectable()
export class ImageWorkbenchService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureWorkbenchTemplate(userId: string): Promise<string> {
    const existing = await this.prisma.image_templates.findFirst({
      where: {
        authorId: userId,
        externalId: IMAGE_WORKBENCH_TEMPLATE_EXTERNAL_ID,
      },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status !== TemplateStatus.ARCHIVED) {
        await this.prisma.image_templates.update({
          where: { id: existing.id },
          data: { status: TemplateStatus.ARCHIVED },
        });
      }
      return existing.id;
    }

    const template = await this.prisma.image_templates.create({
      data: {
        title: '专业图片工作台',
        description: '工作台直接提示词生成归档模板',
        category: 'workbench',
        prompt: '{{prompt}}',
        variables: [{ key: 'prompt', label: 'Prompt', type: 'textarea', default: '' }],
        tags: ['workbench'],
        authorId: userId,
        status: TemplateStatus.ARCHIVED,
        externalId: IMAGE_WORKBENCH_TEMPLATE_EXTERNAL_ID,
        externalMetadata: {
          internal: true,
          workbench: 'image',
        },
        runtimeReason: '专业图片工作台内部归档模板',
      },
    });
    return template.id;
  }

  async getHistory(userId: string, page?: string, pageSize?: string) {
    const templateId = await this.ensureWorkbenchTemplate(userId);
    const safePage = Math.max(1, page ? Number(page) || 1 : 1);
    const safePageSize = Math.min(60, Math.max(1, pageSize ? Number(pageSize) || 30 : 30));
    const skip = (safePage - 1) * safePageSize;

    const [items, total] = await Promise.all([
      this.prisma.image_generations.findMany({
        where: { userId, templateId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safePageSize,
        select: {
          id: true,
          resolvedPrompt: true,
          generatedImages: true,
          referenceImage: true,
          variables: true,
          modelUsed: true,
          status: true,
          durationMs: true,
          createdAt: true,
        },
      }),
      this.prisma.image_generations.count({ where: { userId, templateId } }),
    ]);

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
    await this.prisma.image_generations.deleteMany({
      where: { id, userId, templateId },
    });
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
