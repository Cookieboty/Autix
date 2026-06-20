import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySystemAndCode(systemId: string, code: string) {
    return this.prisma.role.findUnique({
      where: { systemId_code: { systemId, code } },
    });
  }

  create(dto: CreateRoleDto) {
    return this.prisma.role.create({ data: dto });
  }

  findMany(where: Prisma.RoleWhereInput) {
    return this.prisma.role.findMany({
      where,
      orderBy: { sort: 'asc' },
      include: {
        system: true,
        _count: { select: { users: true, permissions: true, menus: true } },
      },
    });
  }

  findWithPermissions(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  }

  findNameOrCodeConflict(id: string, dto: UpdateRoleDto) {
    return this.prisma.role.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          { OR: [dto.name ? { name: dto.name } : {}, dto.code ? { code: dto.code } : {}] },
        ],
      },
    });
  }

  update(id: string, dto: UpdateRoleDto) {
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  delete(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }

  async replacePermissions(roleId: string, permissionIds: string[]) {
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      });
    }
  }

  replaceMenusAndPermissions(
    roleId: string,
    menuIds: string[],
    permissionIds: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.roleMenu.deleteMany({ where: { roleId } });
      await tx.rolePermission.deleteMany({ where: { roleId } });

      if (menuIds.length > 0) {
        await tx.roleMenu.createMany({
          data: menuIds.map((menuId) => ({ roleId, menuId })),
        });
      }

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
    });
  }

  findWithMenus(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
      include: {
        menus: { include: { menu: true } },
      },
    });
  }

  async replaceMenus(roleId: string, menuIds: string[]) {
    await this.prisma.roleMenu.deleteMany({ where: { roleId } });
    if (menuIds.length > 0) {
      await this.prisma.roleMenu.createMany({
        data: menuIds.map((menuId) => ({ roleId, menuId })),
      });
    }
  }
}
