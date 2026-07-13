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

  async countAssetsGroupedByFolder(userId: string) {
    const rows = await this.prisma.material_assets.groupBy({
      by: ['folderId'],
      where: { userId, deletedAt: null },
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

  create(data: { userId: string; name: string; sortOrder: number }) {
    return this.prisma.material_folders.create({ data });
  }

  update(id: string, data: Prisma.material_foldersUpdateInput) {
    return this.prisma.material_folders.update({ where: { id }, data });
  }
}
