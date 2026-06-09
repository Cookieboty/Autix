import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  PointsSource,
} from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { CloudflareR2Service } from '../storage/cloudflare-r2.service';
import { PointsService } from '../points/points.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { BaseResourceService, type ReviewDto } from '../common/base-resource.service';

export interface CreateImageTemplateDto {
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
  exampleImages?: string[];
  modelHint?: string;
  tags?: string[];
  pointsCost?: number;
}

export type UpdateImageTemplateDto = Partial<CreateImageTemplateDto>;

@Injectable()
export class ImageTemplatesService extends BaseResourceService {
  private readonly logger = new Logger(ImageTemplatesService.name);

  constructor(
    prisma: PrismaService,
    private readonly r2: CloudflareR2Service,
    private readonly pointsService: PointsService,
    private readonly modelConfigService: ModelConfigService,
  ) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.image_templates as unknown as {
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
    return ResourceType.IMAGE_TEMPLATE;
  }

  protected override get additionalFindAllWhere(): Record<string, unknown> {
    return {
      OR: [
        { externalId: null },
        { externalId: { not: 'system:image-workbench' } },
      ],
    };
  }

  // ── Review override: 审核通过后奖励积分 ─────────────────────────────────
  async review(id: string, dto: ReviewDto) {
    const result = await super.review(id, dto);

    if (dto.action === 'approve') {
      await this.tryRewardAuthor(id);
    }

    return result;
  }

  private async tryRewardAuthor(templateId: string) {
    try {
      const tpl = await this.prisma.image_templates.findUnique({
        where: { id: templateId },
      });
      if (!tpl) return;

      const author = await this.prisma.user.findUnique({
        where: { id: tpl.authorId },
        select: {
          isSuperAdmin: true,
          roles: { select: { role: { select: { code: true } } } },
        },
      });
      const isAdmin =
        author?.isSuperAdmin ||
        author?.roles.some((ur) => ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(ur.role.code));
      if (isAdmin) return;

      const existing = await this.prisma.points_records.findFirst({
        where: { source: PointsSource.CONTRIBUTION, sourceId: templateId },
      });
      if (existing) return;

      const taskCost = await this.prisma.task_point_costs.findUnique({
        where: { taskType: 'template_publish_reward' },
      });
      if (!taskCost || !taskCost.isActive || taskCost.cost <= 0) return;

      await this.pointsService.addPoints(
        tpl.authorId,
        taskCost.cost,
        PointsSource.CONTRIBUTION,
        templateId,
        `模板审核通过奖励: ${tpl.title}`,
      );
    } catch (err) {
      this.logger.warn(`模板奖励积分发放失败 templateId=${templateId}`, err);
    }
  }

  // 图片模板 runtime 恒定 CLOUD（生成走云端模型 API）
  async create(authorId: string, dto: CreateImageTemplateDto) {
    return this.prisma.image_templates.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        prompt: dto.prompt,
        variables: dto.variables as object,
        coverImage: dto.coverImage,
        exampleImages: dto.exampleImages ?? [],
        modelHint: dto.modelHint,
        tags: dto.tags ?? [],
        pointsCost: dto.pointsCost ?? 0,
        runtimeRequirement: RuntimeReq.CLOUD,
        runtimeDetectedBy: DetectionSrc.AUTO,
        runtimeReason: '图片模板恒定云端运行',
        authorId,
        status: TemplateStatus.PENDING,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateImageTemplateDto) {
    const tpl = (await this.findById(id)) as { authorId: string };
    if (tpl.authorId !== userId) throw new ForbiddenException('无权修改此模板');

    return this.prisma.image_templates.update({
      where: { id },
      data: {
        ...dto,
        variables: dto.variables ? (dto.variables as object) : undefined,
        status: TemplateStatus.PENDING,
      },
    });
  }

  // ── Generation: 创建一次图片生成（先扣分,余额不足直接抛错） ──────────────
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
    };
    const resolvedPrompt = this.resolvePrompt(tpl.prompt, data.variables);

    const isOwnModel = data.modelConfigId
      ? await this.modelConfigService
          .getConfigForOrchestrator(data.modelConfigId)
          .then((c) => c.createdBy === userId)
          .catch(() => false)
      : false;

    if (!isOwnModel) {
      const taskCost = await this.prisma.task_point_costs.findUnique({
        where: { taskType: 'image_generation' },
      });
      const cost = taskCost?.cost ?? 0;

      if (cost > 0) {
        await this.pointsService.deductPoints(
          userId,
          cost,
          PointsSource.TASK,
          undefined,
          `image-generation: ${tpl.title ?? templateId}`,
        );
      }
    }

    const gen = await this.prisma.image_generations.create({
      data: {
        templateId,
        userId,
        modelUsed: data.modelUsed,
        resolvedPrompt,
        variables: data.variables as object,
        referenceImage: data.referenceImage,
        status: 'pending',
      },
    });

    await this.prisma.image_templates.update({
      where: { id: templateId },
      data: { useCount: { increment: 1 } },
    });

    return gen;
  }

  async findGeneration(id: string, userId: string) {
    const gen = await this.prisma.image_generations.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!gen) throw new ForbiddenException('生成记录不存在');
    if (gen.userId !== userId) throw new ForbiddenException('无权访问');

    const turns = await this.prisma.generation_turns.findMany({
      where: {
        generationType: ResourceType.IMAGE_TEMPLATE,
        generationId: id,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { ...gen, turns };
  }

  async updateGeneration(
    id: string,
    data: {
      generatedImages?: string[];
      status?: string;
      error?: string;
      durationMs?: number;
    },
  ) {
    return this.prisma.image_generations.update({ where: { id }, data });
  }

  async addTurn(
    generationId: string,
    data: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) {
    return this.prisma.generation_turns.create({
      data: {
        generationType: ResourceType.IMAGE_TEMPLATE,
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

  async uploadBase64Image(base64: string, folder: string): Promise<string> {
    const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) throw new Error('Invalid base64 image');
    const [, ext, payload] = match;
    const buffer = Buffer.from(payload, 'base64');
    const result = await this.r2.uploadBuffer(buffer, {
      contentType: `image/${ext}`,
      folder,
      ext,
    });
    return result.publicUrl;
  }
}
