import { Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';

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
}
