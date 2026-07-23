import { Injectable } from '@nestjs/common';
import { AppLogger } from '../platform/common/app-logger';
import { ResourceType, type Prisma } from '../platform/prisma/generated';
import { PrismaService } from '../platform/prisma/prisma.service';
import { ResourceMetricsService } from '../platform/resource-metrics/resource-metrics.service';

interface CreateImageGenerationInput {
  id: string;
  templateId: string;
  userId: string;
  modelUsed: string;
  resolvedPrompt: string;
  variables: Prisma.InputJsonValue;
  referenceImage?: string;
}

interface UpdateImageGenerationInput {
  generatedImages?: string[];
  status?: string;
  error?: string;
  durationMs?: number;
}

interface AddTurnInput {
  role: 'USER' | 'ASSISTANT';
  content: string;
  images?: string[];
}

type TemplateResourceType = Extract<
  ResourceType,
  'IMAGE_TEMPLATE' | 'VIDEO_TEMPLATE'
>;

@Injectable()
export class TemplateGenerationRepository {
  private readonly logger = new AppLogger(TemplateGenerationRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceMetrics: ResourceMetricsService,
  ) {}

  async createImageGeneration(input: CreateImageGenerationInput) {
    const created = await this.prisma.$transaction(async (tx) => {
      const created = await tx.image_generations.create({
        data: {
          id: input.id,
          templateId: input.templateId,
          userId: input.userId,
          modelUsed: input.modelUsed,
          resolvedPrompt: input.resolvedPrompt,
          variables: input.variables,
          referenceImage: input.referenceImage,
          status: 'pending',
        },
      });

      await tx.image_templates.update({
        where: { id: input.templateId },
        data: { useCount: { increment: 1 } },
      });

      return created;
    });

    await this.syncUseCountMetric(
      ResourceType.IMAGE_TEMPLATE,
      input.templateId,
      input.userId,
    );

    return created;
  }

    /**
   * P0-1 dual-write：template useCount 之外，向 resource_metrics 补一条 'use_template'
   * 引用事件（referenceCount+1），使新表不再随旧列漂移。best-effort——失败只记日志，
   * 不影响已提交的生成记录。
   */
  private async syncUseCountMetric(
    type: Extract<ResourceType, 'IMAGE_TEMPLATE' | 'VIDEO_TEMPLATE'>,
    templateId: string,
    userId?: string,
  ) {
    try {
      await this.resourceMetrics.recordReference(
        type,
        templateId,
        'use_template',
        userId,
      );
    } catch (err) {
      this.logger.warn(
        `resource_metrics use_template reference sync failed type=${type} templateId=${templateId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  findImageGeneration(id: string) {
    return this.prisma.image_generations.findUnique({
      where: { id },
      include: { template: true },
    });
  }

    findTurns(type: TemplateResourceType, id: string) {
    return this.prisma.generation_turns.findMany({
      where: {
        generationType: type,
        generationId: id,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  updateImageGeneration(id: string, data: UpdateImageGenerationInput) {
    return this.prisma.image_generations.update({ where: { id }, data });
  }

  addTurn(
    type: TemplateResourceType,
    generationId: string,
    data: AddTurnInput,
  ) {
    return this.prisma.generation_turns.create({
      data: {
        generationType: type,
        generationId,
        role: data.role,
        content: data.content,
        images: data.images ?? [],
      },
    });
  }

  async findImageGenerationsByUser(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.image_generations.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          template: {
            select: { title: true, coverImage: true, category: true },
          },
        },
      }),
      this.prisma.image_generations.count({ where: { userId } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  }
