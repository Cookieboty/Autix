import { Injectable } from '@nestjs/common';
import { ResourceType } from '../platform/prisma/generated';
import { PrismaService } from '../platform/prisma/prisma.service';

/** listHistory 三元稳定游标：(viewedAt, resourceId, resourceType)，与外层 ORDER BY 完全对齐。 */
export interface HistoryCursor {
  viewedAt: Date;
  resourceType: ResourceType;
  resourceId: string;
}

export interface HistoryItem {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  viewedAt: Date;
}

@Injectable()
export class MarketplaceActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  listFavorites(userId: string, skip: number, take: number) {
    return this.prisma.resource_favorites.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countFavorites(userId: string) {
    return this.prisma.resource_favorites.count({
      where: { userId },
    });
  }

  listViews(userId: string, skip: number, take: number) {
    return this.prisma.resource_views.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
      skip,
      take,
    });
  }

  countViews(userId: string) {
    return this.prisma.resource_views.count({
      where: { userId },
    });
  }

  /**
   * Plan C Task 11：该用户是否真的浏览过这条资源——`saveFromHistory` 的反伪造前置校验
   * （防止用户绕过"确实看过"直接伪造历史保存）。命中即真，不关心具体哪一条/哪个时间。
   */
  async hasViewed(userId: string, resourceType: ResourceType, resourceId: string): Promise<boolean> {
    const row = await this.prisma.resource_views.findFirst({
      where: { userId, resourceType, resourceId },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * 浏览历史按 (resourceType, resourceId) 去重，保留 viewedAt 最新一条。Prisma 的 `groupBy`
   * 既不支持 cursor 分页也不返回整行，因此改走原生 SQL：
   *   1. `DISTINCT ON ("resourceType", "resourceId")` 配合 `ORDER BY ..., "viewedAt" DESC`
   *      在数据库侧一次性去重取最新一条（DISTINCT ON 要求 ORDER BY 以其表达式开头）；
   *   2. 外层再按 `viewedAt DESC, resourceId DESC, resourceType DESC` 排序做 keyset 游标翻页
   *      （三个字段方向一致，行构造器 `<` 比较可直接对应该排序，天然稳定、无重复/漏页）。
   * 全程通过 `$queryRaw` 标签模板把 userId / cursor 三元组 / limit 作为参数传入——
   * 这些值永远落在 Prisma 生成的 `$N` 占位符里，绝不会以字符串拼接的形式进入 SQL 文本，
   * 从根上堵住 SQL 注入（哪怕 resourceId/游标来自用户输入）。
   */
  async listHistory(
    userId: string,
    cursor: HistoryCursor | undefined,
    take: number,
  ): Promise<{ items: HistoryItem[]; nextCursor: HistoryCursor | null }> {
    const limit = Math.max(1, Math.min(100, take));

    // 分两个完整的 tagged template 分支（而不是拼接一个可选的 Prisma.sql 子片段进主查询），
    // 让每条路径的插值参数位置都固定、显式——`$queryRaw` 的每个 `${}` 都是一个独立占位符
    // 参数，userId / cursor 三元组 / limit 只会以参数形式传给驱动，永不进入 SQL 文本本身。
    const rows = cursor
      ? await this.prisma.$queryRaw<HistoryItem[]>`
          WITH deduped AS (
            SELECT DISTINCT ON ("resourceType", "resourceId")
              "id", "resourceType", "resourceId", "viewedAt"
            FROM "resource_views"
            WHERE "userId" = ${userId}
            ORDER BY "resourceType", "resourceId", "viewedAt" DESC, "id" DESC
          )
          SELECT "id", "resourceType", "resourceId", "viewedAt"
          FROM deduped
          WHERE ("viewedAt", "resourceId", "resourceType")
            < (${cursor.viewedAt}::timestamp(3), ${cursor.resourceId}, ${cursor.resourceType}::"ResourceType")
          ORDER BY "viewedAt" DESC, "resourceId" DESC, "resourceType" DESC
          LIMIT ${limit + 1}
        `
      : await this.prisma.$queryRaw<HistoryItem[]>`
          WITH deduped AS (
            SELECT DISTINCT ON ("resourceType", "resourceId")
              "id", "resourceType", "resourceId", "viewedAt"
            FROM "resource_views"
            WHERE "userId" = ${userId}
            ORDER BY "resourceType", "resourceId", "viewedAt" DESC, "id" DESC
          )
          SELECT "id", "resourceType", "resourceId", "viewedAt"
          FROM deduped
          ORDER BY "viewedAt" DESC, "resourceId" DESC, "resourceType" DESC
          LIMIT ${limit + 1}
        `;

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor: HistoryCursor | null =
      hasMore && last
        ? { viewedAt: last.viewedAt, resourceType: last.resourceType, resourceId: last.resourceId }
        : null;

    return { items, nextCursor };
  }
}
