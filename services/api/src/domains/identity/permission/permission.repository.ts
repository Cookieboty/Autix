import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string) {
    return this.prisma.permission.findUnique({ where: { code } });
  }

  create(dto: CreatePermissionDto) {
    return this.prisma.permission.create({ data: dto });
  }

  findMany(where: Prisma.PermissionWhereInput) {
    return this.prisma.permission.findMany({
      where,
      include: {
        menu: {
          include: {
            system: true,
          },
        },
      },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  findById(id: string) {
    return this.prisma.permission.findUnique({ where: { id } });
  }

  findCodeConflict(id: string, code: string) {
    return this.prisma.permission.findFirst({
      where: { code, id: { not: id } },
    });
  }

  update(id: string, dto: UpdatePermissionDto) {
    return this.prisma.permission.update({ where: { id }, data: dto });
  }

  delete(id: string) {
    return this.prisma.permission.delete({ where: { id } });
  }
}
