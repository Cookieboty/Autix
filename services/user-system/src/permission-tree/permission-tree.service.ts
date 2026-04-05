import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

interface PermissionNode {
  id: string;
  name: string;
  code: string;
  type: 'FRONTEND' | 'BACKEND';
  action: string;
  description?: string;
}

interface MenuNode {
  id: string;
  name: string;
  code: string;
  path: string;
  icon?: string;
  sort: number;
  visible: boolean;
  parentId?: string | null;
  children: MenuNode[];
  permissions: PermissionNode[];
}

interface SystemNode {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: string;
  sort: number;
  menus: MenuNode[];
}

@Injectable()
export class PermissionTreeService {
  constructor(private prisma: PrismaService) {}

  async getPermissionTree() {
    // 获取所有系统及其关联的菜单和权限
    const systems = await this.prisma.system.findMany({
      include: {
        menus: {
          include: {
            permissions: {
              orderBy: { action: 'asc' },
            },
          },
          orderBy: { sort: 'asc' },
        },
      },
      orderBy: { sort: 'asc' },
    });

    // 构建树状结构
    return systems.map((system) => this.buildSystemNode(system));
  }

  private buildSystemNode(system: any): SystemNode {
    const menus = system.menus.map((menu: any) => ({
      id: menu.id,
      name: menu.name,
      code: menu.code,
      path: menu.path || '',
      icon: menu.icon,
      sort: menu.sort,
      visible: menu.visible,
      parentId: menu.parentId,
      children: [],
      permissions: menu.permissions.map((perm: any) => ({
        id: perm.id,
        name: perm.name,
        code: perm.code,
        type: perm.type,
        action: perm.action,
        description: perm.description,
      })),
    }));

    // 构建菜单树状结构
    const menuTree = this.buildMenuTree(menus);

    return {
      id: system.id,
      name: system.name,
      code: system.code,
      description: system.description,
      status: system.status,
      sort: system.sort,
      menus: menuTree,
    };
  }

  private buildMenuTree(menus: MenuNode[]): MenuNode[] {
    const menuMap = new Map<string, MenuNode>();
    const rootMenus: MenuNode[] = [];

    // 先创建所有菜单节点
    menus.forEach((menu) => {
      menuMap.set(menu.id, { ...menu, children: [] });
    });

    // 构建树形关系
    menus.forEach((menu) => {
      const node = menuMap.get(menu.id)!;
      if (menu.parentId) {
        const parent = menuMap.get(menu.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          rootMenus.push(node);
        }
      } else {
        rootMenus.push(node);
      }
    });

    // 递归排序子菜单
    const sortMenus = (menuList: MenuNode[]) => {
      menuList.sort((a, b) => a.sort - b.sort);
      menuList.forEach((menu) => {
        if (menu.children.length > 0) {
          sortMenus(menu.children);
        }
      });
    };

    sortMenus(rootMenus);
    return rootMenus;
  }

  async getSystemTree(systemId: string) {
    const system = await this.prisma.system.findUnique({
      where: { id: systemId },
      include: {
        menus: {
          include: {
            permissions: {
              orderBy: { action: 'asc' },
            },
          },
          orderBy: { sort: 'asc' },
        },
      },
    });

    if (!system) {
      throw new Error('System not found');
    }

    return this.buildSystemNode(system);
  }
}
