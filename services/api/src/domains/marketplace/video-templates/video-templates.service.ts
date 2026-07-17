import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  VideoTemplateSource,
  type Prisma,
} from '../../platform/prisma/generated';
import { randomUUID } from 'crypto';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
import { PointsService } from '../../billing/points/points.service';
import { MembershipService } from '../../billing/membership/membership.service';
import { ModelConfigService } from '../../creation/model-config/model-config.service';
import { assertInStationMediaUrls } from '../../creation/gallery/gallery.helpers';
import { BaseResourceService, type ListResourceQuery } from '../../platform/common/base-resource.service';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { ResourceMetricsService } from '../../platform/resource-metrics/resource-metrics.service';
import { FavoriteLibraryService } from '../../creation/materials/favorite-library.service';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';
import { TemplateGenerationRepository } from '../template-generation.repository';

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
    resourceInteractions: ResourceInteractionRepository,
    private readonly resources: MarketplaceResourceCrudRepository,
    private readonly r2: CloudflareR2Service,
    private readonly pointsService: PointsService,
    private readonly modelConfigService: ModelConfigService,
    private readonly generations: TemplateGenerationRepository,
    private readonly membershipService: MembershipService,
    private readonly metrics: ResourceMetricsService,
    private readonly favoriteLibrary: FavoriteLibraryService,
  ) {
    super(resourceInteractions, metrics);
  }

  protected get delegate() {
    return this.resources.delegateFor(ResourceType.VIDEO_TEMPLATE);
  }

  protected get resourceType(): ResourceType {
    return ResourceType.VIDEO_TEMPLATE;
  }

  protected override get additionalFindAllWhere(): Record<string, unknown> {
    return { sourceType: { not: VideoTemplateSource.SYSTEM } };
  }

  // ── 公开可见交互(点赞/收藏/浏览):先经公开可见守卫,不可见 → 404 ──────
  override async like(userId: string, id: string) {
    await this.requirePublicVisible(id);
    return super.like(userId, id);
  }

  /**
   * Plan C Task 10：favorite 改走 FavoriteLibraryService（单事务收藏耦合，落 FAVORITE 素材）。
   * 保留 Plan B Task 5 的公开可见守卫——非公开可见模板不可收藏。
   */
  override async favorite(userId: string, id: string) {
    await this.requirePublicVisible(id);
    return this.favoriteLibrary.favorite(userId, ResourceType.VIDEO_TEMPLATE, id);
  }

  /**
   * Plan C Task 10：新增 DELETE 语义的取消收藏（此前模板收藏是单个 POST toggle，
   * 现与 Gallery 的 POST/DELETE 对齐）。不复用 requirePublicVisible 门禁——用户应始终
   * 能取消自己的收藏，即便模板之后被下架/归档。
   */
  async unfavorite(userId: string, id: string) {
    return this.favoriteLibrary.unfavorite(userId, ResourceType.VIDEO_TEMPLATE, id);
  }

  override async recordView(userId: string | undefined, id: string) {
    await this.requirePublicVisible(id);
    return super.recordView(userId, id);
  }

  /**
   * Plan C Task 10：favoriteCount 列已从 video_templates 删除（收藏改走
   * FavoriteLibraryService + resource_metrics 单一来源），列表/详情展示改读 resource_metrics。
   */
  // 返回类型刻意保持跟基类一致的 unknown/unknown[]——下游在拿到结果后各自做窄化 cast，
  // 收紧成具体对象类型会让那些 cast 因"类型不重叠"编译失败（见 image-templates.service.ts 同名注释）。
  override async findAll(query: ListResourceQuery): Promise<{
    items: unknown[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const res = await super.findAll(query);
    const items = await this.attachFavoriteCounts(res.items);
    return { ...res, items };
  }

  override async findById(id: string): Promise<unknown> {
    const row = await super.findById(id);
    return this.attachFavoriteCount(row);
  }

  override async findPublicVisibleById(id: string): Promise<unknown | null> {
    const row = await super.findPublicVisibleById(id);
    if (!row) return null;
    return this.attachFavoriteCount(row);
  }

  private async attachFavoriteCount(row: unknown): Promise<unknown> {
    const id = (row as { id?: unknown }).id;
    if (typeof id !== 'string') return row;
    const metrics = await this.metrics.getMetrics(ResourceType.VIDEO_TEMPLATE, id);
    return { ...(row as object), favoriteCount: metrics.favoriteCount };
  }

  private async attachFavoriteCounts(items: unknown[]): Promise<unknown[]> {
    const ids = items
      .map((item) => (item as { id?: unknown }).id)
      .filter((id): id is string => typeof id === 'string');
    if (ids.length === 0) return items;
    const metricsMap = await this.metrics.getMetricsMap(ResourceType.VIDEO_TEMPLATE, ids);
    return items.map((item) => {
      const id = (item as { id?: unknown }).id;
      const favoriteCount = typeof id === 'string' ? (metricsMap.get(id)?.favoriteCount ?? 0) : 0;
      return { ...(item as object), favoriteCount };
    });
  }

  /**
   * Task 4.5/4.6 站内来源写入守卫：coverImage/exampleMedia 必须命中站内存储域名，
   * 拒绝任意公网 URL。create 与 update 共用（update 此前 `{...rest}` 透传未守）。
   */
  private async assertTemplateMediaInStation(media: {
    coverImage?: string;
    exampleMedia?: string[];
  }): Promise<void> {
    const urls = [media.coverImage, ...(media.exampleMedia ?? [])].filter(
      (url): url is string => !!url,
    );
    if (urls.length === 0) return;
    const r2Base = await this.r2.getPublicBaseUrl();
    assertInStationMediaUrls(urls, [r2Base], '封面图/示例素材必须来自站内存储');
  }

  async create(authorId: string, dto: CreateVideoTemplateDto) {
    await this.assertTemplateMediaInStation(dto);

    return this.resources.createVideoTemplate({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      prompt: dto.prompt,
      variables: this.toJson(dto.variables),
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
      createdById: authorId,
      sourceType: VideoTemplateSource.ADMIN_CREATED,
    });
  }

  async update(id: string, userId: string, dto: UpdateVideoTemplateDto) {
    const tpl = (await this.findById(id)) as { authorId: string };
    if (tpl.authorId !== userId) throw new ForbiddenException('无权修改此模板');
    await this.assertTemplateMediaInStation(dto);

    const { variables, defaultParams, materialSlots, ...rest } = dto;

    return this.resources.updateVideoTemplate(id, {
      ...rest,
      variables: variables ? this.toJson(variables) : undefined,
      defaultParams: defaultParams ? this.toJson(defaultParams) : undefined,
      materialSlots: materialSlots ? this.toJson(materialSlots) : undefined,
      status: TemplateStatus.PENDING,
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
    const tpl = (await this.requirePublicVisible(templateId)) as {
      prompt: string;
      title?: string;
      durationSec?: number | null;
      defaultParams?: Record<string, unknown> | null;
    };
    const resolvedPrompt = this.resolvePrompt(tpl.prompt, data.variables);
    const generationId = randomUUID();

    // 自有模型不再免费：模板生成视频一律计费。
    let holdId: string | null = null;
    {
      const membershipLevel = await this.membershipService.resolveActiveMembershipLevel(userId);
      const estimate = await this.estimateTemplateGenerationCost({
        taskType: 'video_generation',
        modelConfigId: data.modelConfigId,
        duration: tpl.durationSec ?? undefined,
        resolution: typeof tpl.defaultParams?.resolution === 'string'
          ? tpl.defaultParams.resolution
          : undefined,
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
            durationSec: tpl.durationSec ?? null,
            referenceImage: data.referenceImage ?? null,
          }),
          remark: `video-template-generation: ${tpl.title ?? templateId}`,
        });
        holdId = hold.id;
      }
    }

    try {
      const gen = await this.generations.createVideoGeneration({
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
    const gen = await this.generations.findVideoGeneration(id);
    if (!gen) throw new ForbiddenException('生成记录不存在');
    if (gen.userId !== userId) throw new ForbiddenException('无权访问');

    const turns = await this.generations.findTurns(ResourceType.VIDEO_TEMPLATE, id);
    return { ...gen, turns };
  }

  async addTurn(
    generationId: string,
    data: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) {
    return this.generations.addTurn(
      ResourceType.VIDEO_TEMPLATE,
      generationId,
      data,
    );
  }

  async findMyGenerations(userId: string, page = 1, pageSize = 20) {
    return this.generations.findVideoGenerationsByUser(userId, page, pageSize);
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
    duration?: number;
    resolution?: string;
    referenceImages?: number;
    membershipLevel?: number;
  }): Promise<{
    taskType: string;
    amount: number;
    pricingSnapshot?: Prisma.InputJsonValue;
  }> {
    // 原生化后视频计价参数即火山原生名 duration（perUnit duration）。旧写 seconds →
    // estimateCost 取不到值 → 模板视频每秒费归零、少收费。
    const params: Record<string, unknown> = { referenceImages: input.referenceImages ?? 0 };
    if (input.duration !== undefined) params.duration = input.duration;
    if (input.resolution !== undefined) params.resolution = input.resolution;

    const estimate = await this.pointsService.estimateCost({
      taskType: input.taskType,
      ...(input.modelConfigId ? { modelConfigId: input.modelConfigId } : {}),
      params,
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
}
