import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import type { MessageResponse } from '@autix/types';

type MenuWithOptionalChildren<TMenu> = TMenu & {
  children: MenuWithOptionalChildren<TMenu>[];
};
type MenuTree<TMenu> = MenuWithOptionalChildren<TMenu>[];
type MenuWithSystem = Prisma.MenuGetPayload<{ include: { system: true } }>;
type UserWithRoleMenus = NonNullable<
  Awaited<ReturnType<MenuService['findUserWithRoleMenus']>>
>;
type RoleMenuLink = UserWithRoleMenus['roles'][number]['role']['menus'][number];

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  private buildTree<TMenu extends { id: string; parentId: string | null; sort: number }>(
    items: TMenu[],
    parentId: string | null = null,
  ): MenuTree<TMenu> {
    return items
      .filter((i) => i.parentId === parentId)
      .sort((a, b) => a.sort - b.sort)
      .map((i) => ({ ...i, children: this.buildTree(items, i.id) }));
  }

  async create(dto: CreateMenuDto) {
    return this.prisma.menu.create({ data: dto });
  }

  async findAll(systemId?: string): Promise<MenuTree<MenuWithSystem>> {
    const where: Prisma.MenuWhereInput = systemId ? { systemId } : {};
    const menus = await this.prisma.menu.findMany({ 
      where,
      orderBy: { sort: 'asc' },
      include: {
        system: true,
      },
    });
    return this.buildTree(menus);
  }

  private async findUserWithRoleMenus(userId: string) {
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

  async findUserMenus(userId: string, systemId?: string) {
    const user = await this.findUserWithRoleMenus(userId);
    if (!user) throw new NotFoundException('用户不存在');

    let menus: Prisma.MenuGetPayload<object>[];
    if (user.isSuperAdmin) {
      const where: Prisma.MenuWhereInput = { visible: true };
      if (systemId) where.systemId = systemId;
      menus = await this.prisma.menu.findMany({ where, orderBy: { sort: 'asc' } });
    } else {
      const menuSet = new Map<string, Prisma.MenuGetPayload<object>>();
      for (const ur of user.roles) {
        if (systemId && ur.role.systemId !== systemId) continue;
        for (const rm of ur.role.menus as RoleMenuLink[]) {
          if (rm.menu.visible) {
            menuSet.set(rm.menu.id, rm.menu);
          }
        }
      }
      menus = Array.from(menuSet.values());
    }

    return this.buildTree(menus);
  }

  async getMenuPermissions(menuId: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id: menuId },
      include: {
        permissions: {
          orderBy: [{ type: 'asc' }, { code: 'asc' }],
        },
      },
    });

    if (!menu) throw new NotFoundException('菜单不存在');
    return menu.permissions;
  }

  async findOne(id: string) {
    const menu = await this.prisma.menu.findUnique({ where: { id } });
    if (!menu) throw new NotFoundException('菜单不存在');
    return menu;
  }

  async update(id: string, dto: UpdateMenuDto) {
    await this.findOne(id);
    return this.prisma.menu.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<MessageResponse> {
    await this.findOne(id);
    const hasChildren = await this.prisma.menu.findFirst({ where: { parentId: id } });
    if (hasChildren) throw new Error('请先删除子菜单');
    await this.prisma.menu.delete({ where: { id } });
    return { message: '删除成功' };
  }
}
