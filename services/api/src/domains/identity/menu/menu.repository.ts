import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Injectable()
export class MenuRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMenuDto) {
    return this.prisma.menu.create({ data: dto });
  }

  findManyWithSystem(where: Prisma.MenuWhereInput) {
    return this.prisma.menu.findMany({
      where,
      orderBy: { sort: 'asc' },
      include: {
        system: true,
      },
    });
  }

  findUserWithRoleMenus(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                system: true,
                menus: { include: { menu: true } },
              },
            },
          },
        },
      },
    });
  }

  findVisibleMenus(systemId?: string) {
    const where: Prisma.MenuWhereInput = { visible: true };
    if (systemId) where.systemId = systemId;
    return this.prisma.menu.findMany({ where, orderBy: { sort: 'asc' } });
  }

  findWithPermissions(menuId: string) {
    return this.prisma.menu.findUnique({
      where: { id: menuId },
      include: {
        permissions: {
          orderBy: [{ type: 'asc' }, { code: 'asc' }],
        },
      },
    });
  }

  findById(id: string) {
    return this.prisma.menu.findUnique({ where: { id } });
  }

  update(id: string, dto: UpdateMenuDto) {
    return this.prisma.menu.update({ where: { id }, data: dto });
  }

  findChildByParentId(id: string) {
    return this.prisma.menu.findFirst({ where: { parentId: id } });
  }

  delete(id: string) {
    return this.prisma.menu.delete({ where: { id } });
  }
}
