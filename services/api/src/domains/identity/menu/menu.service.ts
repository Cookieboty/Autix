import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { Prisma } from '../../platform/prisma/generated';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import type { MessageResponse } from '@autix/domain';
import { MenuRepository } from './menu.repository';

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
  constructor(private readonly menuRepository: MenuRepository) { }

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
    return this.menuRepository.create(dto);
  }

  async findAll(systemId?: string): Promise<MenuTree<MenuWithSystem>> {
    const where: Prisma.MenuWhereInput = systemId ? { systemId } : {};
    const menus = await this.menuRepository.findManyWithSystem(where);
    return this.buildTree(menus);
  }

  private async findUserWithRoleMenus(userId: string) {
    return this.menuRepository.findUserWithRoleMenus(userId);
  }

  async findUserMenus(userId: string, systemId?: string) {
    const user = await this.findUserWithRoleMenus(userId);
    if (!user) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'user.not_found');

    let menus: Prisma.MenuGetPayload<object>[];
    if (user.isSuperAdmin) {
      menus = await this.menuRepository.findVisibleMenus(systemId);
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
    const menu = await this.menuRepository.findWithPermissions(menuId);

    if (!menu) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'menu.not_found');
    return menu.permissions;
  }

  async findOne(id: string) {
    const menu = await this.menuRepository.findById(id);
    if (!menu) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'menu.not_found');
    return menu;
  }

  async update(id: string, dto: UpdateMenuDto) {
    await this.findOne(id);
    return this.menuRepository.update(id, dto);
  }

  async remove(id: string): Promise<MessageResponse> {
    await this.findOne(id);
    const hasChildren = await this.menuRepository.findChildByParentId(id);
    if (hasChildren) throw new Error('请先删除子菜单');
    await this.menuRepository.delete(id);
    return { message: '删除成功' };
  }
}
