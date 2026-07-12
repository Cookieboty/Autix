import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  ImageTemplateSource,
  type Prisma,
} from '../../platform/prisma/generated';
import { randomUUID } from 'crypto';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
import { PointsService } from '../../billing/points/points.service';
import { MembershipService } from '../../billing/membership/membership.service';
import { ModelConfigService } from '../../creation/model-config/model-config.service';
import { assertInStationMediaUrls } from '../../creation/gallery/gallery.helpers';
import { BaseResourceService } from '../../platform/common/base-resource.service';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { ResourceMetricsService } from '../../platform/resource-metrics/resource-metrics.service';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';
import { TemplateGenerationRepository } from '../template-generation.repository';

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
    resourceInteractions: ResourceInteractionRepository,
    private readonly resources: MarketplaceResourceCrudRepository,
    private readonly r2: CloudflareR2Service,
    private readonly pointsService: PointsService,
    private readonly modelConfigService: ModelConfigService,
    private readonly generations: TemplateGenerationRepository,
    private readonly membershipService: MembershipService,
    resourceMetrics: ResourceMetricsService,
  ) {
    super(resourceInteractions, resourceMetrics);
  }

  protected get delegate() {
    return this.resources.delegateFor(ResourceType.IMAGE_TEMPLATE);
  }

  protected get resourceType(): ResourceType {
    return ResourceType.IMAGE_TEMPLATE;
  }

  protected override get additionalFindAllWhere(): Record<string, unknown> {
    return { sourceType: { not: ImageTemplateSource.SYSTEM } };
  }

  // ── 公开可见交互(点赞/收藏/浏览):先经公开可见守卫,不可见 → 404 ──────
  override async like(userId: string, id: string) {
    await this.requirePublicVisible(id);
    return super.like(userId, id);
  }

  override async favorite(userId: string, id: string) {
    await this.requirePublicVisible(id);
    return super.favorite(userId, id);
  }

  override async recordView(userId: string | undefined, id: string) {
    await this.requirePublicVisible(id);
    return super.recordView(userId, id);
  }

  /**
   * Task 4.5/4.6 站内来源写入守卫：coverImage/exampleImages 必须命中站内存储域名，
   * 拒绝任意公网 URL。create 与 update 共用（update 此前 `{...dto}` 透传未守）。
   */
  private async assertTemplateMediaInStation(media: {
    coverImage?: string;
    exampleImages?: string[];
  }): Promise<void> {
    const urls = [media.coverImage, ...(media.exampleImages ?? [])].filter(
      (url): url is string => !!url,
    );
    if (urls.length === 0) return;
    const r2Base = await this.r2.getPublicBaseUrl();
    assertInStationMediaUrls(urls, [r2Base], '封面图/示例图必须来自站内存储');
  }

  // 图片模板 runtime 恒定 CLOUD（生成走云端模型 API）
  async create(authorId: string, dto: CreateImageTemplateDto) {
    await this.assertTemplateMediaInStation(dto);

    return this.resources.createImageTemplate({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      prompt: dto.prompt,
      variables: this.toJson(dto.variables),
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
      createdById: authorId,
      sourceType: ImageTemplateSource.ADMIN_CREATED,
    });
  }

  async update(id: string, userId: string, dto: UpdateImageTemplateDto) {
    const tpl = (await this.findById(id)) as { authorId: string };
    if (tpl.authorId !== userId) throw new ForbiddenException('无权修改此模板');
    await this.assertTemplateMediaInStation(dto);

    return this.resources.updateImageTemplate(id, {
      ...dto,
      variables: dto.variables ? this.toJson(dto.variables) : undefined,
      status: TemplateStatus.PENDING,
    });
  }

  // ── Generation: 创建一次图片生成（先冻结积分,成功后确认） ──────────────
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
    const tpl = (await this.requirePublicVisible(templateId)) as {
      prompt: string;
      title?: string;
    };
    const resolvedPrompt = this.resolvePrompt(tpl.prompt, data.variables);
    const generationId = randomUUID();

    // 自有模型不再免费：模板生图一律计费。
    let holdId: string | null = null;
    {
      const membershipLevel = await this.membershipService.resolveActiveMembershipLevel(userId);
      const estimate = await this.estimateTemplateGenerationCost({
        taskType: 'image_generation',
        modelConfigId: data.modelConfigId,
        referenceImages: data.referenceImage ? 1 : 0,
        membershipLevel,
      });

      if (estimate.amount > 0) {
        const { hold } = await this.pointsService.createHold(userId, {
          taskType: estimate.taskType,
          taskId: generationId,
          amount: estimate.amount,
          pricingSnapshot: estimate.pricingSnapshot,
          metadata: this.toJson({
            templateId,
            modelUsed: data.modelUsed,
            variables: data.variables,
            referenceImage: data.referenceImage ?? null,
          }),
          remark: `image-template-generation: ${tpl.title ?? templateId}`,
        });
        holdId = hold.id;
      }
    }

    try {
      const gen = await this.generations.createImageGeneration({
        id: generationId,
        templateId,
        userId,
        modelUsed: data.modelUsed,
        resolvedPrompt,
        variables: this.toJson(data.variables),
        referenceImage: data.referenceImage,
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
            'image template generation creation failed',
          );
        } catch (refundErr) {
          this.logger.warn(
            `图片模板生成冻结退回失败 hold=${holdId}: ${String(
              refundErr instanceof Error ? refundErr.message : refundErr,
            )}`,
          );
        }
      }
      throw err;
    }
  }

  async findGeneration(id: string, userId: string) {
    const gen = await this.generations.findImageGeneration(id);
    if (!gen) throw new ForbiddenException('生成记录不存在');
    if (gen.userId !== userId) throw new ForbiddenException('无权访问');

    const turns = await this.generations.findTurns(ResourceType.IMAGE_TEMPLATE, id);

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
    return this.generations.updateImageGeneration(id, data);
  }

  async addTurn(
    generationId: string,
    data: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) {
    return this.generations.addTurn(
      ResourceType.IMAGE_TEMPLATE,
      generationId,
      data,
    );
  }

  async findMyGenerations(userId: string, page = 1, pageSize = 20) {
    return this.generations.findImageGenerationsByUser(userId, page, pageSize);
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
    modelConfigId?: string;
    referenceImages?: number;
    membershipLevel?: number;
  }): Promise<{
    taskType: string;
    amount: number;
    pricingSnapshot?: Prisma.InputJsonValue;
  }> {
    const estimate = await this.pointsService.estimateCost({
      taskType: input.taskType,
      ...(input.modelConfigId ? { modelConfigId: input.modelConfigId } : {}),
      params: { referenceImages: input.referenceImages ?? 0 },
      membershipLevel: input.membershipLevel,
    });
    return {
      taskType: estimate.taskType,
      amount: estimate.estimatedCost,
      pricingSnapshot: this.toJson(estimate.pricingSnapshot),
    };
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
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
