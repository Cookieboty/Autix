import { Injectable } from '@nestjs/common';
import { Prisma, GalleryKind, GalleryStatus, TemplateStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

/** gallery_posts / gallery_reports 的数据访问层。所有状态迁移由 service 层用 assertTransition 校验后再调用这里。 */
@Injectable()
export class GalleryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.gallery_posts.findUnique({ where: { id } });
  }

  /**
   * Plan C Task 7：详情聚合用——一次取回帖子 + 作者身份字段（供 gallery-author.presenter 展示）。
   * 只 select presenter 需要的字段（displayName←realName 现阶段；status/username/avatar），
   * 不外泄 email/phone 等 PII。account 分支合入后把 realName 换成 nickname ?? realName。
   */
  findByIdWithAuthor(id: string) {
    return this.prisma.gallery_posts.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, status: true, realName: true, username: true, avatar: true },
        },
      },
    });
  }

  create(data: Prisma.gallery_postsUncheckedCreateInput) {
    return this.prisma.gallery_posts.create({ data });
  }

  update(id: string, data: Prisma.gallery_postsUncheckedUpdateInput) {
    return this.prisma.gallery_posts.update({ where: { id }, data });
  }

  /** 待审列表（PENDING，createdAt 升序，游标为上一页最后一条的 id）。 */
  async findPendingPage(cursor: string | undefined, take: number) {
    return this.findByStatusPage(GalleryStatus.PENDING, cursor, take);
  }

  /**
   * 公开热度 Feed：PUBLISHED + kind，publishedAt 倒序（最新发布优先），游标为上一页最后一条的 id。
   * 命中 @@index([status, kind, publishedAt Desc, id Desc])。
   */
  async findPublishedFeed(kind: GalleryKind, cursor: string | undefined, take: number) {
    const rows = await this.prisma.gallery_posts.findMany({
      where: { status: GalleryStatus.PUBLISHED, kind },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  /** 管理端页码分页 + 筛选：返回当前页 items 与匹配总数（同一 where）。 */
  async findAdminPage(where: Prisma.gallery_postsWhereInput, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.gallery_posts.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.gallery_posts.count({ where }),
    ]);
    return { items, total };
  }

  /** 管理端分类下拉：现存作品去重后的 category 列表（排除空串与已删除）。 */
  async listDistinctCategories(): Promise<string[]> {
    const rows = await this.prisma.gallery_posts.findMany({
      where: { category: { not: '' }, status: { not: GalleryStatus.REMOVED } },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((row) => row.category).filter(Boolean);
  }

  /** 按状态分页（createdAt 升序，游标为上一页最后一条的 id）。管理端待审/已审列表复用。 */
  async findByStatusPage(status: GalleryStatus, cursor: string | undefined, take: number) {
    const rows = await this.prisma.gallery_posts.findMany({
      where: { status },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  findReportById(id: string) {
    return this.prisma.gallery_reports.findUnique({ where: { id } });
  }

  createReport(data: Prisma.gallery_reportsUncheckedCreateInput) {
    return this.prisma.gallery_reports.create({ data });
  }

  updateReport(id: string, data: Prisma.gallery_reportsUncheckedUpdateInput) {
    return this.prisma.gallery_reports.update({ where: { id }, data });
  }

  /**
   * 归属校验 + 元数据快照共用的查询：一次查询同时拿到 userId（归属判定）与
   * resolvedPrompt/modelUsed/width/height/referenceImage（快照来源），避免重复查库。
   */
  findImageGenerationOwner(id: string) {
    return this.prisma.image_generations.findUnique({
      where: { id },
      select: {
        userId: true,
        resolvedPrompt: true,
        modelUsed: true,
        width: true,
        height: true,
        referenceImage: true,
        // Task 4.5：FROM_GENERATION 投稿的 mediaUrls 从这里派生，不采信 DTO。
        generatedImages: true,
      },
    });
  }

  findVideoGenerationOwner(id: string) {
    return this.prisma.video_generations.findUnique({
      where: { id },
      select: {
        userId: true,
        resolvedPrompt: true,
        modelUsed: true,
        referenceImage: true,
        // Task 4.5：FROM_GENERATION 投稿的 mediaUrls 从这里派生，不采信 DTO。
        generatedVideos: true,
      },
    });
  }

  /**
   * 参考图授权判定用：参考图 URL 是否命中"公开可复用站内资源"——
   * 用户自有素材 / 已发布(PUBLISHED)画廊作品 / 已通过(APPROVED)模板 三者之一即视为可复用。
   * 均为按 URL 精确匹配的直接查询（非模糊启发式）；未命中任何一项时由调用方按 allowPublicReference 兜底。
   */
  async isReferenceImagePubliclyReusable(url: string, authorId: string): Promise<boolean> {
    const [ownMaterial, publishedPost, approvedTemplate] = await Promise.all([
      this.prisma.material_assets.findFirst({
        where: {
          userId: authorId,
          deletedAt: null,
          OR: [{ url }, { thumbnailUrl: url }],
        },
        select: { id: true },
      }),
      this.prisma.gallery_posts.findFirst({
        where: {
          status: GalleryStatus.PUBLISHED,
          OR: [{ coverImage: url }, { mediaUrls: { has: url } }],
        },
        select: { id: true },
      }),
      this.prisma.image_templates.findFirst({
        where: {
          status: TemplateStatus.APPROVED,
          OR: [{ coverImage: url }, { exampleImages: { has: url } }],
        },
        select: { id: true },
      }),
    ]);
    return !!(ownMaterial || publishedPost || approvedTemplate);
  }

  writeAuditLog(action: string, actorId: string, payload: Record<string, unknown>) {
    return this.prisma.admin_audit_logs.create({
      data: {
        action,
        actorId,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
