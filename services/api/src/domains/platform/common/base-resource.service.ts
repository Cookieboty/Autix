import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AppLogger } from './app-logger';
import {
  ResourceType,
  TemplateStatus,
  RuntimeReq,
  DetectionSrc,
} from '../prisma/generated';
import { ResourceInteractionRepository } from './resource-interaction.repository';
import { ResourceMetricsService } from '../resource-metrics/resource-metrics.service';

export interface BaseResourceDto {
  title: string;
  description?: string;
  category: string;
  coverImage?: string;
  exampleMedia?: string[];
  tags?: string[];
  pointsCost?: number;
  // 作者发布时可显式指定 runtime,覆盖检测器结果(runtimeDetectedBy=AUTHOR)
  runtimeRequirement?: RuntimeReq;
}

export interface ListResourceQuery {
  category?: string;
  status?: TemplateStatus;
  authorId?: string;
  search?: string;
  sort?: 'newest' | 'popular' | 'likes';
  page?: number;
  pageSize?: number;
}

export interface ReviewDto {
  action: 'approve' | 'reject' | 'revise';
  reason?: string;
}

export interface RuntimeOverrideDto {
  runtimeRequirement: RuntimeReq;
  runtimeReason?: string;
}

/**
 * 5 类资源(skills/mcp_servers/agents/image_templates/video_templates) CRUD/审核/收藏/喜欢
 * 共用基类。子类需提供 delegate(Prisma model accessor) 与 resourceType。
 */
export abstract class BaseResourceService {
  protected readonly resourceInteractions: ResourceInteractionRepository;
  private readonly baseResourceLogger = new AppLogger(BaseResourceService.name);

  /**
   * resourceMetrics 是可选的（未注入时 dual-write 静默跳过）：这样手写 new
   * Xxx(resourceInteractions) 的单测（见 base-resource.service.spec.ts）不必跟着改。
   * 生产环境各具体 ResourceService 均通过 DI 注入真实 ResourceMetricsService。
   */
  constructor(
    resourceInteractions: ResourceInteractionRepository,
    private readonly resourceMetrics?: ResourceMetricsService,
  ) {
    this.resourceInteractions = resourceInteractions;
  }

  protected abstract get delegate(): {
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

  protected abstract get resourceType(): ResourceType;

  protected get additionalFindAllWhere(): Record<string, unknown> {
    return {};
  }

  async findAll(query: ListResourceQuery): Promise<{
    items: unknown[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    const additionalWhere = this.additionalFindAllWhere;
    if (Object.keys(additionalWhere).length > 0) {
      where.AND = [additionalWhere];
    }
    if (query.category) where.category = query.category;
    where.status = query.status ?? TemplateStatus.APPROVED;
    if (query.authorId) where.authorId = query.authorId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[] = { createdAt: 'desc' };
    if (query.sort === 'popular') {
      const isHotResource =
        this.resourceType === ResourceType.IMAGE_TEMPLATE ||
        this.resourceType === ResourceType.VIDEO_TEMPLATE;
      orderBy = isHotResource
        ? [{ isHot: 'desc' }, { useCount: 'desc' }, { createdAt: 'desc' }]
        : { useCount: 'desc' };
    }
    if (query.sort === 'likes') orderBy = { likeCount: 'desc' };

    const [items, total] = await Promise.all([
      this.delegate.findMany({ where, orderBy, skip, take: pageSize }),
      this.delegate.count({ where }),
    ]);

    const itemsWithViewCounts = await this.attachViewCounts(items);

    return {
      items: itemsWithViewCounts,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  async findById(id: string): Promise<unknown> {
    const row = await this.delegate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('资源不存在');
    return this.attachViewCount(row);
  }

  /**
   * 统一公开可见谓词：APPROVED && 子类附加条件(如 sourceType != SYSTEM)。
   * 复用 additionalFindAllWhere，与公开列表(findAll)的过滤条件保持一致。
   */
  protected get publicVisibleWhere(): Record<string, unknown> {
    return { status: TemplateStatus.APPROVED, ...this.additionalFindAllWhere };
  }

  /**
   * 公开入口(详情/点赞/收藏/浏览/生成)统一走这里；命中不可见(不存在/未过审/被过滤的来源)返回 null。
   * Controller/子类负责把 null 转换为 404。管理员/内部 workbench 路径请继续用 findById，不要改用本方法。
   */
  async findPublicVisibleById(id: string): Promise<unknown | null> {
    const rows = await this.delegate.findMany({
      where: { id, ...this.publicVisibleWhere },
      take: 1,
    });
    const row = rows[0];
    if (!row) return null;
    return this.attachViewCount(row);
  }

  /** findPublicVisibleById 的“找不到就抛 404”便捷封装,供公开交互动作(like/favorite/recordView/generation)前置校验用。 */
  protected async requirePublicVisible(id: string): Promise<unknown> {
    const row = await this.findPublicVisibleById(id);
    if (!row) throw new NotFoundException('资源不存在或不可公开访问');
    return row;
  }

  async remove(id: string, userId: string) {
    const row = (await this.findById(id)) as { authorId: string };
    if (row.authorId !== userId) throw new ForbiddenException('无权删除此资源');
    return this.delegate.delete({ where: { id } });
  }

  async like(userId: string, id: string) {
    await this.findById(id);
    const existing = await this.resourceInteractions.findLike(
      userId,
      this.resourceType,
      id,
    );
    if (existing) {
      await this.resourceInteractions.deleteLike(existing.id);
      await this.delegate.update({
        where: { id },
        data: { likeCount: { decrement: 1 } } as unknown,
      });
      await this.syncMetrics((m) => m.unlike(userId, this.resourceType, id));
      return { liked: false };
    }
    await this.resourceInteractions.createLike(userId, this.resourceType, id);
    await this.delegate.update({
      where: { id },
      data: { likeCount: { increment: 1 } } as unknown,
    });
    await this.syncMetrics((m) => m.like(userId, this.resourceType, id));
    return { liked: true };
  }

  async favorite(userId: string, id: string) {
    await this.findById(id);
    const existing = await this.resourceInteractions.findFavorite(
      userId,
      this.resourceType,
      id,
    );
    if (existing) {
      // 已收藏 → 取消
      await this.resourceInteractions.deleteFavorite(existing.id);
      await this.delegate.update({
        where: { id },
        data: { favoriteCount: { decrement: 1 } } as unknown,
      });
      await this.syncMetrics((m) => m.unfavorite(userId, this.resourceType, id));
      return { favorited: false };
    }
    await this.resourceInteractions.createFavorite(userId, this.resourceType, id);
    await this.delegate.update({
      where: { id },
      data: { favoriteCount: { increment: 1 } } as unknown,
    });
    await this.syncMetrics((m) => m.favorite(userId, this.resourceType, id));
    return { favorited: true };
  }

  async recordView(userId: string | undefined, id: string) {
    await this.resourceInteractions.createView(userId, this.resourceType, id);
  }

  /**
   * P0-1 dual-write：把 likeCount/favoriteCount 的旧列写入同步一份到 resource_metrics，
   * 避免它相对新表持续漂移。best-effort——resourceMetrics 未注入或调用失败都只记日志，
   * 绝不影响上面已经落地的旧列写入 / 交互记录。
   */
  private async syncMetrics(
    op: (metrics: ResourceMetricsService) => Promise<unknown>,
  ): Promise<void> {
    if (!this.resourceMetrics) return;
    try {
      await op(this.resourceMetrics);
    } catch (err) {
      this.baseResourceLogger.warn(
        `resource_metrics 同步失败 resourceType=${this.resourceType}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async attachViewCount<T>(row: T): Promise<T & { viewCount: number }> {
    const resourceId = (row as { id?: unknown }).id;
    if (typeof resourceId !== 'string') {
      return { ...(row as object), viewCount: 0 } as T & { viewCount: number };
    }

    const viewCount = await this.resourceInteractions.countViews(
      this.resourceType,
      resourceId,
    );
    return { ...(row as object), viewCount } as T & { viewCount: number };
  }

  private async attachViewCounts<T>(items: T[]): Promise<Array<T & { viewCount: number }>> {
    const ids = items
      .map((item) => (item as { id?: unknown }).id)
      .filter((id): id is string => typeof id === 'string');
    if (ids.length === 0) {
      return items.map((item) => ({ ...(item as object), viewCount: 0 }) as T & { viewCount: number });
    }

    const counts = await this.resourceInteractions.countViewsByResourceIds(
      this.resourceType,
      ids,
    );

    return items.map((item) => {
      const id = (item as { id?: unknown }).id;
      const viewCount = typeof id === 'string' ? (counts.get(id) ?? 0) : 0;
      return { ...(item as object), viewCount } as T & { viewCount: number };
    });
  }

  // ── Review (admin) ────────────────────────────────────────────────────
  async findForReview(query: {
    status?: TemplateStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.delegate.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  async review(id: string, dto: ReviewDto) {
    await this.findById(id);

    const data: Record<string, unknown> = {};
    switch (dto.action) {
      case 'approve':
        data.status = TemplateStatus.APPROVED;
        data.publishedAt = new Date();
        data.rejectReason = null;
        break;
      case 'reject':
        data.status = TemplateStatus.REJECTED;
        data.rejectReason = dto.reason ?? null;
        break;
      case 'revise':
        data.status = TemplateStatus.PENDING;
        data.rejectReason = dto.reason ?? null;
        break;
    }

    return this.delegate.update({ where: { id }, data });
  }

  // ── Runtime override (admin) ──────────────────────────────────────────
  async overrideRuntime(id: string, dto: RuntimeOverrideDto) {
    await this.findById(id);
    return this.delegate.update({
      where: { id },
      data: {
        runtimeRequirement: dto.runtimeRequirement,
        runtimeDetectedBy: DetectionSrc.ADMIN,
        runtimeReason:
          dto.runtimeReason ?? `管理员手动覆盖为 ${dto.runtimeRequirement}`,
      } as unknown,
    });
  }

  // ── Hot toggle (admin, image/video only) ───────────────────────────────
  async setHot(id: string, isHot: boolean) {
    await this.findById(id);
    return this.delegate.update({
      where: { id },
      data: { isHot } as unknown,
    });
  }
}
