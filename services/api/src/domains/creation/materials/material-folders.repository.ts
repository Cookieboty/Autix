import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class MaterialFoldersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByUser(userId: string) {
    return this.prisma.material_folders.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * 侧栏文件夹角标计数。
   *
   * 必须排除收藏：收藏的是别人的作品，/asset 的所有非收藏视图（含文件夹视图，它按
   * bucket=all 渲染 → excludeFavorites）都看不到它们。若这里照数，就会出现
   * 「文件夹角标写着 1、点进去却是空的」——与 MaterialsService.counts 排除收藏是同一条理由。
   */
  async countAssetsGroupedByFolder(userId: string) {
    const rows = await this.prisma.material_assets.groupBy({
      by: ['folderId'],
      where: { userId, deletedAt: null, librarySource: { not: 'FAVORITE' } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ folderId: r.folderId, count: r._count._all }));
  }

  findOwned(userId: string, id: string) {
    return this.prisma.material_folders.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  findActiveByName(userId: string, name: string) {
    return this.prisma.material_folders.findFirst({
      where: { userId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
    });
  }

  create(data: { userId: string; name: string; icon?: string | null; sortOrder: number }) {
    return this.prisma.material_folders.create({ data });
  }

  update(id: string, data: Prisma.material_foldersUpdateInput) {
    return this.prisma.material_folders.update({ where: { id }, data });
  }
}
