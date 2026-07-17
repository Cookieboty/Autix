import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class MaterialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(input: {
    where: Prisma.material_assetsWhereInput;
    skip: number;
    pageSize: number;
  }) {
    return Promise.all([
      this.prisma.material_assets.findMany({
        where: input.where,
        orderBy: { createdAt: 'desc' },
        skip: input.skip,
        take: input.pageSize,
      }),
      this.prisma.material_assets.count({ where: input.where }),
    ]);
  }

  /**
   * /asset 导航角标：按 type 分组计数 + 收藏数 + 总数，一趟并发算完。
   *
   * 「按类型」与「总数」都排除收藏——收藏的是别人的作品，只在收藏分桶里出现，
   * 角标必须与分桶实际能看到的条数一致。
   */
  countBuckets(where: Prisma.material_assetsWhereInput) {
    const own: Prisma.material_assetsWhereInput = {
      ...where,
      librarySource: { not: 'FAVORITE' },
    };
    return Promise.all([
      this.prisma.material_assets.groupBy({
        by: ['type'],
        where: own,
        _count: { _all: true },
      }),
      this.prisma.material_assets.count({
        where: { ...where, librarySource: 'FAVORITE' },
      }),
      this.prisma.material_assets.count({ where: own }),
    ]);
  }

  create(data: Prisma.material_assetsUncheckedCreateInput) {
    return this.prisma.material_assets.create({ data });
  }

  update(id: string, data: Prisma.material_assetsUpdateInput) {
    return this.prisma.material_assets.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.material_assets.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  softDeleteMany(userId: string, ids: string[]) {
    return this.prisma.material_assets.updateMany({
      where: { userId, id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  findOwned(userId: string, id: string) {
    return this.prisma.material_assets.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  moveMany(userId: string, ids: string[], folderId: string | null) {
    return this.prisma.material_assets.updateMany({
      where: { userId, id: { in: ids }, deletedAt: null },
      data: { folderId },
    });
  }
}
