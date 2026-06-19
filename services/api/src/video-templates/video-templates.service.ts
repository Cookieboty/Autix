import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  type Prisma,
} from '../prisma/generated';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { BaseResourceService } from '../common/base-resource.service';

export interface CreateVideoTemplateDto {
  title: string;
  description?: string;
  category: string;
  prompt: string;
  variables: Array<{
    key: string;
    label: string;
    type: string;
    default?: string;
    options?: string[];
  }>;
  coverImage?: string;
  exampleMedia?: string[];
  modelHint?: string;
  durationSec?: number;
  defaultParams?: Record<string, unknown>;
  materialSlots?: Array<{
    role: string;
    label: string;
    required: boolean;
  }>;
  tags?: string[];
  pointsCost?: number;
}

export type UpdateVideoTemplateDto = Partial<CreateVideoTemplateDto>;

@Injectable()
export class VideoTemplatesService extends BaseResourceService {
  private readonly logger = new Logger(VideoTemplatesService.name);

  constructor(
    prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly modelConfigService: ModelConfigService,
  ) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.video_templates as unknown as {
      findMany: (args?: unknown) => Promise<unknown[]>;
      findUnique: (args: { where: { id: string } }) => Promise<unknown>;
      create: (args: { data: unknown }) => Promise<unknown>;
      update: (args: {
        where: { id: string };
        data: unknown;
      }) => Promise<unknown>;
      delete: (args: { where: { id: string } }) => Promise<unknown>;
      count: (args?: unknown) => Promise<number>;
    };
  }

  protected get resourceType(): ResourceType {
    return ResourceType.VIDEO_TEMPLATE;
  }

  async exportForAdmin(where: Prisma.video_templatesWhereInput) {
    return this.prisma.video_templates.findMany({ where });
  }

  async create(authorId: string, dto: CreateVideoTemplateDto) {
    return this.prisma.video_templates.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        prompt: dto.prompt,
        variables: dto.variables as object,
        coverImage: dto.coverImage,
        exampleMedia: dto.exampleMedia ?? [],
        modelHint: dto.modelHint,
        durationSec: dto.durationSec,
        defaultParams: dto.defaultParams as Prisma.InputJsonValue | undefined,
        materialSlots: dto.materialSlots as Prisma.InputJsonValue | undefined,
        tags: dto.tags ?? [],
        pointsCost: dto.pointsCost ?? 0,
        runtimeRequirement: RuntimeReq.CLOUD,
        runtimeDetectedBy: DetectionSrc.AUTO,
        runtimeReason: '视频模板恒定云端运行',
        authorId,
        status: TemplateStatus.PENDING,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateVideoTemplateDto) {
    const tpl = (await this.findById(id)) as { authorId: string };
    if (tpl.authorId !== userId) throw new ForbiddenException('无权修改此模板');

    const { variables, defaultParams, materialSlots, ...rest } = dto;

    return this.prisma.video_templates.update({
      where: { id },
      data: {
        ...rest,
        variables: variables ? (variables as Prisma.InputJsonValue) : undefined,
        defaultParams: defaultParams as Prisma.InputJsonValue | undefined,
        materialSlots: materialSlots as Prisma.InputJsonValue | undefined,
        status: TemplateStatus.PENDING,
      },
    });
  }

  async createGeneration(
    templateId: string,
    userId: string,
    data: {
      modelUsed: string;
      variables: Record<string, string>;
      referenceImage?: string;
      modelConfigId?: string;
    },
  ) {
    const tpl = (await this.findById(templateId)) as {
      prompt: string;
      title?: string;
      durationSec?: number | null;
    };
    const resolvedPrompt = this.resolvePrompt(tpl.prompt, data.variables);
    const generationId = randomUUID();

    const isOwnModel = data.modelConfigId
      ? await this.modelConfigService
          .getConfigForOrchestrator(data.modelConfigId)
          .then((c) => c.createdBy === userId)
          .catch(() => false)
      : false;

    let holdId: string | null = null;
    if (!isOwnModel) {
      const estimate = await this.estimateTemplateGenerationCost({
        taskType: 'video_generation',
        modelName: data.modelUsed,
        seconds: tpl.durationSec ?? undefined,
        referenceImages: data.referenceImage ? 1 : 0,
      });

      if (estimate.amount > 0) {
        const { hold } = await this.pointsService.createHold(userId, {
          taskType: estimate.taskType,
          taskId: generationId,
          amount: estimate.amount,
          pricingSnapshot: estimate.pricingSnapshot,
          refundPolicySnapshot: estimate.refundPolicySnapshot,
          metadata: this.toJson({
            templateId,
            modelUsed: data.modelUsed,
            variables: data.variables,
            durationSec: tpl.durationSec ?? null,
            referenceImage: data.referenceImage ?? null,
          }),
          remark: `video-template-generation: ${tpl.title ?? templateId}`,
        });
        holdId = hold.id;
      }
    }

    try {
      const gen = await this.prisma.$transaction(async (tx) => {
        const created = await tx.video_generations.create({
          data: {
            id: generationId,
            templateId,
            userId,
            modelUsed: data.modelUsed,
            resolvedPrompt,
            variables: data.variables as object,
            referenceImage: data.referenceImage,
            status: 'pending',
          },
        });

        await tx.video_templates.update({
          where: { id: templateId },
          data: { useCount: { increment: 1 } },
        });

        return created;
      });

      if (holdId) {
        await this.pointsService.confirmHold(holdId);
      }
      return gen;
    } catch (err) {
      if (holdId) {
        try {
          await this.pointsService.refundHold(
            holdId,
            'video template generation creation failed',
          );
        } catch (refundErr) {
          this.logger.warn(
            `视频模板生成冻结退回失败 hold=${holdId}: ${String(
              refundErr instanceof Error ? refundErr.message : refundErr,
            )}`,
          );
        }
      }
      throw err;
    }
  }

  async findGeneration(id: string, userId: string) {
    const gen = await this.prisma.video_generations.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!gen) throw new ForbiddenException('生成记录不存在');
    if (gen.userId !== userId) throw new ForbiddenException('无权访问');

    const turns = await this.prisma.generation_turns.findMany({
      where: {
        generationType: ResourceType.VIDEO_TEMPLATE,
        generationId: id,
      },
      orderBy: { createdAt: 'asc' },
    });
    return { ...gen, turns };
  }

  async addTurn(
    generationId: string,
    data: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) {
    return this.prisma.generation_turns.create({
      data: {
        generationType: ResourceType.VIDEO_TEMPLATE,
        generationId,
        role: data.role,
        content: data.content,
        images: data.images ?? [],
      },
    });
  }

  async findMyGenerations(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.video_generations.findMany({
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
      this.prisma.video_generations.count({ where: { userId } }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  resolvePrompt(
    promptTemplate: string,
    variables: Record<string, string>,
  ): string {
    let resolved = promptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      resolved = resolved.replaceAll(`{{${key}}}`, value);
    }
    return resolved;
  }

  private async estimateTemplateGenerationCost(input: {
    taskType: string;
    modelName?: string;
    seconds?: number;
    referenceImages?: number;
  }): Promise<{
    taskType: string;
    amount: number;
    pricingSnapshot?: Prisma.InputJsonValue;
    refundPolicySnapshot?: Prisma.InputJsonValue;
  }> {
    const estimate = await this.pointsService.estimateCost({
      taskType: input.taskType,
      modelName: input.modelName,
      seconds: input.seconds,
      referenceImages: input.referenceImages,
    });
    return {
      taskType: estimate.taskType,
      amount: estimate.estimatedCost,
      pricingSnapshot: this.toJson(estimate.pricingSnapshot),
      refundPolicySnapshot: this.toJson(estimate.refundPolicy),
    };
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
