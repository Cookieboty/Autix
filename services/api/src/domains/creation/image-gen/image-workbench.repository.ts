import { Injectable } from '@nestjs/common';
import {
  ImageTemplateSource,
  Prisma,
  TemplateStatus,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

const IMAGE_WORKBENCH_TEMPLATE_EXTERNAL_ID = 'system:image-workbench';

@Injectable()
export class ImageWorkbenchRepository {
  constructor(private readonly prisma: PrismaService) {}

  findWorkbenchTemplate(userId: string) {
    return this.prisma.image_templates.findFirst({
      where: {
        authorId: userId,
        externalId: IMAGE_WORKBENCH_TEMPLATE_EXTERNAL_ID,
      },
      select: { id: true, status: true },
    });
  }

  archiveTemplate(id: string) {
    return this.prisma.image_templates.update({
      where: { id },
      data: { status: TemplateStatus.ARCHIVED },
    });
  }

  createWorkbenchTemplate(userId: string) {
    return this.prisma.image_templates.create({
      data: {
        title: '专业图片工作台',
        description: '工作台直接提示词生成归档模板',
        category: 'workbench',
        prompt: '{{prompt}}',
        variables: [{ key: 'prompt', label: 'Prompt', type: 'textarea', default: '' }],
        tags: ['workbench'],
        authorId: userId,
        status: TemplateStatus.ARCHIVED,
        createdById: userId,
        sourceType: ImageTemplateSource.SYSTEM,
        systemKey: 'image-workbench',
        externalId: IMAGE_WORKBENCH_TEMPLATE_EXTERNAL_ID,
        externalMetadata: {
          internal: true,
          workbench: 'image',
        },
        runtimeReason: '专业图片工作台内部归档模板',
      },
    });
  }

  findHistoryItems(input: {
    userId: string;
    templateId: string;
    skip: number;
    pageSize: number;
  }) {
    const where: Prisma.image_generationsWhereInput = {
      userId: input.userId,
      templateId: input.templateId,
    };

    return Promise.all([
      this.prisma.image_generations.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.skip,
        take: input.pageSize,
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
      this.prisma.image_generations.count({ where }),
    ]);
  }

  async deleteHistoryItem(userId: string, templateId: string, id: string) {
    await this.prisma.image_generations.deleteMany({
      where: { id, userId, templateId },
    });
  }
}
