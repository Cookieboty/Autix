import { Injectable } from '@nestjs/common';
import {
  ImageTemplateSource,
  Prisma,
  TemplateStatus,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

const IMAGE_WORKBENCH_SYSTEM_KEY = 'image-workbench';

const WORKBENCH_TEMPLATE_SELECT = {
  id: true,
  status: true,
  sourceType: true,
  systemKey: true,
} satisfies Prisma.image_templatesSelect;

type WorkbenchTemplate = {
  id: string;
  status: TemplateStatus;
  sourceType: ImageTemplateSource;
  systemKey: string | null;
};

@Injectable()
export class ImageWorkbenchRepository {
  constructor(private readonly prisma: PrismaService) {}

  findWorkbenchTemplate(userId: string): Promise<WorkbenchTemplate | null> {
    return this.prisma.image_templates.findFirst({
      where: {
        authorId: userId,
        systemKey: IMAGE_WORKBENCH_SYSTEM_KEY,
      },
      select: WORKBENCH_TEMPLATE_SELECT,
    });
  }

  archiveTemplate(id: string) {
    return this.prisma.image_templates.update({
      where: { id },
      data: { status: TemplateStatus.ARCHIVED },
    });
  }

  createWorkbenchTemplate(userId: string): Promise<WorkbenchTemplate> {
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
        systemKey: IMAGE_WORKBENCH_SYSTEM_KEY,
        runtimeReason: '专业图片工作台内部归档模板',
      },
      select: WORKBENCH_TEMPLATE_SELECT,
    });
  }

  /**
   * find-or-create：并发首次访问时,DB 唯一约束 @@unique([authorId, systemKey]) 是唯一性的
   * 保证——抢输的一方命中 P2002 后重查,返回抢赢方那条,而不是把异常冒泡成 500。
   */
  async ensureWorkbenchTemplate(userId: string): Promise<WorkbenchTemplate> {
    const existing = await this.findWorkbenchTemplate(userId);
    if (existing) return existing;
    try {
      return await this.createWorkbenchTemplate(userId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.findWorkbenchTemplate(userId);
        if (raced) return raced;
      }
      throw err;
    }
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
