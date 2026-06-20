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
}
