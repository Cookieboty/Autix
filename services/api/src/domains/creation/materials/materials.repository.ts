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
}
