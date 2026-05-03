import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ResourceType,
  TemplateStatus,
  RuntimeReq,
  DetectionSrc,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(protected readonly prisma: PrismaService) {}

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

  async findAll(query: ListResourceQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (query.category) where.category = query.category;
    where.status = query.status ?? TemplateStatus.APPROVED;
    if (query.authorId) where.authorId = query.authorId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' };
    if (query.sort === 'popular') orderBy = { useCount: 'desc' };
    if (query.sort === 'likes') orderBy = { likeCount: 'desc' };

    const [items, total] = await Promise.all([
      this.delegate.findMany({ where, orderBy, skip, take: pageSize }),
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

  async findById(id: string) {
    const row = await this.delegate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('资源不存在');
    return row;
  }

  async remove(id: string, userId: string) {
    const row = (await this.findById(id)) as { authorId: string };
    if (row.authorId !== userId) throw new ForbiddenException('无权删除此资源');
    return this.delegate.delete({ where: { id } });
  }

  async like(id: string) {
    await this.findById(id);
    return this.delegate.update({
      where: { id },
      data: { likeCount: { increment: 1 } } as unknown,
    });
  }

  async favorite(userId: string, id: string) {
    await this.findById(id);
    const existing = await this.prisma.resource_favorites.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId,
          resourceType: this.resourceType,
          resourceId: id,
        },
      },
    });
    if (existing) {
      // 已收藏 → 取消
      await this.prisma.resource_favorites.delete({
        where: { id: existing.id },
      });
      await this.delegate.update({
        where: { id },
        data: { favoriteCount: { decrement: 1 } } as unknown,
      });
      return { favorited: false };
    }
    await this.prisma.resource_favorites.create({
      data: { userId, resourceType: this.resourceType, resourceId: id },
    });
    await this.delegate.update({
      where: { id },
      data: { favoriteCount: { increment: 1 } } as unknown,
    });
    return { favorited: true };
  }

  async recordView(userId: string, id: string) {
    await this.prisma.resource_views.create({
      data: { userId, resourceType: this.resourceType, resourceId: id },
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
}
