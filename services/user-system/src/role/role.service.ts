import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRoleDto): Promise<any> {
    const existing = await this.prisma.role.findUnique({
      where: { systemId_code: { systemId: dto.systemId, code: dto.code } },
    });
    if (existing) throw new ConflictException('该系统中角色编码已存在');
    return this.prisma.role.create({ data: dto });
  }

  async findAll(systemId?: string): Promise<any> {
    const where = systemId ? { systemId } : {};
    return this.prisma.role.findMany({
      where,
      orderBy: { sort: 'asc' },
      include: {
        system: true,
        _count: { select: { users: true, permissions: true, menus: true } },
      },
    });
  }

  async findOne(id: string): Promise<any> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('角色不存在');
    return role;
  }

  async update(id: string, dto: UpdateRoleDto): Promise<any> {
    await this.findOne(id);
    if (dto.name || dto.code) {
      const existing = await this.prisma.role.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: [dto.name ? { name: dto.name } : {}, dto.code ? { code: dto.code } : {}] },
          ],
        },
      });
      if (existing) throw new ConflictException('角色名称或编码已存在');
    }
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<any> {
    const role = await this.findOne(id);
    if (role._count.users > 0) throw new ConflictException('角色下还有用户，无法删除');
    await this.prisma.role.delete({ where: { id } });
    return { message: '删除成功' };
  }

  async getPermissions(id: string): Promise<any> {
    const role = await this.findOne(id);
    return role.permissions.map((rp: any) => rp.permission);
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto): Promise<any> {
    await this.findOne(id);
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    if (dto.permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      });
    }
    return { message: '权限分配成功' };
  }

  async assignMenusAndPermissions(
    id: string,
    menuIds: string[],
    permissionIds: string[],
  ): Promise<any> {
    await this.findOne(id);

    // 使用事务同时更新菜单和权限关联
    await this.prisma.$transaction(async (tx) => {
      // 清除旧的关联
      await tx.roleMenu.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });

      // 创建新的菜单关联
      if (menuIds.length > 0) {
        await tx.roleMenu.createMany({
          data: menuIds.map((menuId) => ({ roleId: id, menuId })),
        });
      }

      // 创建新的权限关联
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
    });

    return { message: '菜单和权限分配成功' };
  }

  async getMenus(id: string): Promise<any> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        menus: { include: { menu: true } },
      },
    });
    if (!role) throw new NotFoundException('角色不存在');
    return role.menus.map((rm: any) => rm.menu);
  }

  async assignMenus(id: string, menuIds: string[]): Promise<any> {
    await this.findOne(id);
    await this.prisma.roleMenu.deleteMany({ where: { roleId: id } });
    if (menuIds.length > 0) {
      await this.prisma.roleMenu.createMany({
        data: menuIds.map((menuId) => ({ roleId: id, menuId })),
      });
    }
    return { message: '菜单分配成功' };
  }
}
