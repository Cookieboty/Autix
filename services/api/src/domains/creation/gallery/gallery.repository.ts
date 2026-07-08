import { Injectable } from '@nestjs/common';
import { Prisma, GalleryKind, GalleryStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

/** gallery_posts / gallery_reports 的数据访问层。所有状态迁移由 service 层用 assertTransition 校验后再调用这里。 */
@Injectable()
export class GalleryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.gallery_posts.findUnique({ where: { id } });
  }

  /**
   * 媒体迁移 worker 取一批待迁移作品：mediaMigrated=false 且尝试次数未达上限。
   * 只取迁移所需字段，按 id 升序稳定分页。
   */
  findPostsPendingMediaMigration(maxAttempts: number, take: number) {
    return this.prisma.gallery_posts.findMany({
      where: { mediaMigrated: false, mediaMigrationAttempts: { lt: maxAttempts } },
      orderBy: { id: 'asc' },
      take,
      select: { id: true, coverImage: true, mediaUrls: true, mediaMigrationAttempts: true },
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

  findImageGenerationOwner(id: string) {
    return this.prisma.image_generations.findUnique({
      where: { id },
      select: { userId: true },
    });
  }

  findVideoGenerationOwner(id: string) {
    return this.prisma.video_generations.findUnique({
      where: { id },
      select: { userId: true },
    });
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
