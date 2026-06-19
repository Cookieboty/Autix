import { Injectable } from '@nestjs/common';
import { Prisma } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';

interface PermissionNode {
  id: string;
  name: string;
  code: string;
  type: 'FRONTEND' | 'BACKEND';
  action: string;
  description?: string | null;
}

interface MenuNode {
  id: string;
  name: string;
  code: string;
  path: string;
  icon?: string | null;
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
  description?: string | null;
  status: string;
  sort: number;
  autoApprove: boolean;
  menus: MenuNode[];
}

type SystemWithMenusAndPermissions = Prisma.SystemGetPayload<{
  include: {
    menus: {
      include: {
        permissions: true;
      };
    };
  };
}>;
type MenuWithPermissions = SystemWithMenusAndPermissions['menus'][number];
type PermissionTree = SystemNode[];

@Injectable()
export class PermissionTreeService {
  constructor(private prisma: PrismaService) {}

  async getPermissionTree(): Promise<PermissionTree> {
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

  private buildSystemNode(system: SystemWithMenusAndPermissions): SystemNode {
    const menus = system.menus.map((menu: MenuWithPermissions) => ({
      id: menu.id,
      name: menu.name,
      code: menu.code,
      path: menu.path || '',
      icon: menu.icon,
      sort: menu.sort,
      visible: menu.visible,
      parentId: menu.parentId,
      children: [],
      permissions: menu.permissions.map((perm) => ({
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
      autoApprove: system.autoApprove,
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

  async getSystemTree(systemId: string): Promise<SystemNode> {
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
