import { Injectable } from '@nestjs/common';
import { ResourceType } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResourceInteractionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLike(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.resource_likes.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId,
          resourceType,
          resourceId,
        },
      },
    });
  }

  createLike(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.resource_likes.create({
      data: { userId, resourceType, resourceId },
    });
  }

  deleteLike(id: string) {
    return this.prisma.resource_likes.delete({
      where: { id },
    });
  }

  findFavorite(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.resource_favorites.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId,
          resourceType,
          resourceId,
        },
      },
    });
  }

  createFavorite(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.resource_favorites.create({
      data: { userId, resourceType, resourceId },
    });
  }

  deleteFavorite(id: string) {
    return this.prisma.resource_favorites.delete({
      where: { id },
    });
  }

  createView(userId: string | undefined, resourceType: ResourceType, resourceId: string) {
    return this.prisma.resource_views.create({
      data: {
        userId: userId ?? null,
        resourceType,
        resourceId,
      },
    });
  }

  countViews(resourceType: ResourceType, resourceId: string): Promise<number> {
    return this.prisma.resource_views.count({
      where: {
        resourceType,
        resourceId,
      },
    });
  }

  async countViewsByResourceIds(
    resourceType: ResourceType,
    resourceIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.resource_views.groupBy({
      by: ['resourceId'],
      where: {
        resourceType,
        resourceId: { in: resourceIds },
      },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.resourceId, row._count._all]));
  }

  /**
   * 批量成员查询（Plan C Task 7 建、Task 8 feed overlay 复用）：返回给定 ids 中
   * 该用户已点赞的子集。刻意做成批量形态——详情单条也传 [id]，避免 feed 场景退化成 N+1。
   * 一次 findMany 只 select resourceId，命中 @@unique([userId, resourceType, resourceId])。
   */
  async findLikedIds(
    userId: string,
    resourceType: ResourceType,
    resourceIds: string[],
  ): Promise<Set<string>> {
    if (resourceIds.length === 0) return new Set();
    const rows = await this.prisma.resource_likes.findMany({
      where: { userId, resourceType, resourceId: { in: resourceIds } },
      select: { resourceId: true },
    });
    return new Set(rows.map((row) => row.resourceId));
  }

  /** findLikedIds 的收藏版：返回 ids 中该用户已收藏的子集（同批量语义，Task 8 复用）。 */
  async findFavoritedIds(
    userId: string,
    resourceType: ResourceType,
    resourceIds: string[],
  ): Promise<Set<string>> {
    if (resourceIds.length === 0) return new Set();
    const rows = await this.prisma.resource_favorites.findMany({
      where: { userId, resourceType, resourceId: { in: resourceIds } },
      select: { resourceId: true },
    });
    return new Set(rows.map((row) => row.resourceId));
  }
}
