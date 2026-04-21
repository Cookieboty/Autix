'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Network, AlertTriangle } from 'lucide-react';
import { Button } from '@heroui/react';
import {
  AdminDialogShell,
  AdminDialogHero,
  AdminDialogFooterRow,
} from '@/components/dialog-shell';
import { TreeView } from '@/components/permission-tree/tree-view';
import { DetailPanel } from '@/components/permission-tree/detail-panel';
import { TreeProvider, SystemNode, MenuNode, PermissionNode } from '@/components/permission-tree/tree-context';
import { SystemDrawer } from '@/components/permission-tree/system-drawer';
import { MenuDrawer } from '@/components/permission-tree/menu-drawer';
import { PermissionDrawer } from '@/components/permission-tree/permission-drawer';
import { toast } from 'sonner';
import api from '@/lib/api';

interface SystemFormData {
  name: string;
  code: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  sort: number;
}

interface MenuFormData {
  systemId: string;
  name: string;
  code: string;
  path: string;
  icon?: string;
  parentId?: string;
  sort: number;
  visible: boolean;
}

interface PermissionFormData {
  menuId: string;
  name: string;
  code: string;
  type: 'FRONTEND' | 'BACKEND';
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT';
  description?: string;
}

interface PermissionTreeSystem extends SystemNode {
  menus: (MenuNode & { permissions: PermissionNode[] })[];
}

interface FlatMenu extends MenuNode {
  systemId: string;
}

type DeleteConfirm = {
  type: 'system' | 'menu' | 'permission';
  id: string;
  name: string;
};

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="h-full">{children}</div>;
}

export default function PermissionCenterPage() {
  const queryClient = useQueryClient();
  const [systemDrawerOpen, setSystemDrawerOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [permissionDrawerOpen, setPermissionDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SystemNode | MenuNode | PermissionNode | null>(null);
  const [contextSystemId, setContextSystemId] = useState('');
  const [contextMenuId, setContextMenuId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  const { data: systems = [], isLoading, refetch } = useQuery<PermissionTreeSystem[]>({
    queryKey: ['permission-tree'],
    queryFn: async () => {
      const res = await api.get('/permission-tree');
      return res.data;
    },
  });

  const allMenus: FlatMenu[] = systems.flatMap((sys) =>
    (sys.menus || []).map((menu) => ({ ...menu, systemId: sys.id })),
  );

  const createSystemMutation = useMutation({
    mutationFn: (data: SystemFormData) => api.post('/systems', data),
    onSuccess: () => {
      toast.success('系统创建成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('系统创建失败'),
  });

  const updateSystemMutation = useMutation({
    mutationFn: ({ id, ...data }: SystemFormData & { id: string }) => api.put(`/systems/${id}`, data),
    onSuccess: () => {
      toast.success('系统更新成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('系统更新失败'),
  });

  const deleteSystemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/systems/${id}`),
    onSuccess: () => {
      toast.success('系统删除成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('系统删除失败'),
  });

  const createMenuMutation = useMutation({
    mutationFn: (data: MenuFormData) => api.post('/menus', data),
    onSuccess: () => {
      toast.success('菜单创建成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('菜单创建失败'),
  });

  const updateMenuMutation = useMutation({
    mutationFn: ({ id, ...data }: MenuFormData & { id: string }) => api.put(`/menus/${id}`, data),
    onSuccess: () => {
      toast.success('菜单更新成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('菜单更新失败'),
  });

  const deleteMenuMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menus/${id}`),
    onSuccess: () => {
      toast.success('菜单删除成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('菜单删除失败'),
  });

  const createPermissionMutation = useMutation({
    mutationFn: (data: PermissionFormData) => api.post('/permissions', data),
    onSuccess: () => {
      toast.success('权限创建成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('权限创建失败'),
  });

  const updatePermissionMutation = useMutation({
    mutationFn: ({ id, ...data }: PermissionFormData & { id: string }) => api.put(`/permissions/${id}`, data),
    onSuccess: () => {
      toast.success('权限更新成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('权限更新失败'),
  });

  const deletePermissionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/permissions/${id}`),
    onSuccess: () => {
      toast.success('权限删除成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('权限删除失败'),
  });

  const handleAddSystem = () => {
    setEditingItem(null);
    setSystemDrawerOpen(true);
  };

  const handleEditSystem = (system: SystemNode) => {
    setEditingItem(system);
    setSystemDrawerOpen(true);
  };

  const handleDeleteSystem = (systemId: string) => {
    const sys = systems.find((item) => item.id === systemId);
    setDeleteConfirm({ type: 'system', id: systemId, name: sys?.name || systemId });
  };

  const handleAddMenu = (systemId: string) => {
    setContextSystemId(systemId);
    setContextMenuId('');
    setEditingItem(null);
    setMenuDrawerOpen(true);
  };

  const handleAddSubMenu = (systemId: string, parentMenuId: string) => {
    setContextSystemId(systemId);
    setContextMenuId(parentMenuId);
    setEditingItem(null);
    setMenuDrawerOpen(true);
  };

  const handleEditMenu = (menu: MenuNode) => {
    setContextSystemId('');
    setContextMenuId('');
    setEditingItem(menu);
    setMenuDrawerOpen(true);
  };

  const handleDeleteMenu = (menuId: string) => {
    const menu = allMenus.find((item) => item.id === menuId);
    setDeleteConfirm({ type: 'menu', id: menuId, name: menu?.name || menuId });
  };

  const handleAddPermission = (menuId: string) => {
    setContextMenuId(menuId);
    setEditingItem(null);
    setPermissionDrawerOpen(true);
  };

  const handleEditPermission = (permission: PermissionNode) => {
    setContextMenuId('');
    setEditingItem(permission);
    setPermissionDrawerOpen(true);
  };

  const handleDeletePermission = (permissionId: string) => {
    setDeleteConfirm({ type: 'permission', id: permissionId, name: '此权限' });
  };

  const handleSystemSubmit = async (data: SystemFormData) => {
    if (editingItem && 'id' in editingItem) {
      await updateSystemMutation.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createSystemMutation.mutateAsync(data);
    }
    setSystemDrawerOpen(false);
    setEditingItem(null);
  };

  const handleMenuSubmit = async (data: MenuFormData) => {
    if (editingItem && 'id' in editingItem) {
      await updateMenuMutation.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createMenuMutation.mutateAsync(data);
    }
    setMenuDrawerOpen(false);
    setEditingItem(null);
    setContextSystemId('');
    setContextMenuId('');
  };

  const handlePermissionSubmit = async (data: PermissionFormData) => {
    if (editingItem && 'id' in editingItem) {
      await updatePermissionMutation.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createPermissionMutation.mutateAsync(data);
    }
    setPermissionDrawerOpen(false);
    setEditingItem(null);
    setContextMenuId('');
  };

  return (
    <TreeProvider>
      <div className="space-y-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
              Permission architecture
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--foreground)' }}>
              权限配置中心
            </h1>
          </div>
          <Button
            onClick={handleAddSystem}
            className="h-9 rounded-md px-3"
            style={{ backgroundColor: 'var(--foreground)', color: 'var(--panel)' }}
          >
            <Plus className="mr-2 h-4 w-4" />
            新增系统
          </Button>
        </div>

        <div className="grid min-h-[calc(100vh-16rem)] grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--border)',
            }}
          >
            <PageShell>
              <div className="border-b px-6 py-5" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
                  Structure tree
                </p>
                <h2 className="mt-2 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  系统 / 菜单 / 权限
                </h2>
              </div>
              <div className="min-h-0" style={{ height: 'calc(100% - 86px)' }}>
                <TreeView
                  systems={systems}
                  loading={isLoading}
                  onRefresh={() => refetch()}
                  onEditSystem={handleEditSystem}
                  onDeleteSystem={handleDeleteSystem}
                  onAddMenu={handleAddMenu}
                  onAddSubMenu={handleAddSubMenu}
                  onEditMenu={handleEditMenu}
                  onDeleteMenu={handleDeleteMenu}
                  onAddPermission={handleAddPermission}
                  onEditPermission={handleEditPermission}
                  onDeletePermission={handleDeletePermission}
                />
              </div>
            </PageShell>
          </section>

          <section
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--border)',
            }}
          >
            <PageShell>
              <div className="border-b px-6 py-5" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
                  Detail panel
                </p>
                <h2 className="mt-2 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  当前节点详情
                </h2>
              </div>
              <div className="min-h-0" style={{ height: 'calc(100% - 86px)' }}>
                <DetailPanel />
              </div>
            </PageShell>
          </section>
        </div>
      </div>

      <SystemDrawer
        open={systemDrawerOpen}
        onClose={() => {
          setSystemDrawerOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSystemSubmit}
        initialData={editingItem}
        isEdit={!!editingItem}
      />

      <MenuDrawer
        open={menuDrawerOpen}
        onClose={() => {
          setMenuDrawerOpen(false);
          setEditingItem(null);
          setContextSystemId('');
          setContextMenuId('');
        }}
        onSubmit={handleMenuSubmit}
        initialData={editingItem}
        isEdit={!!editingItem}
        systemId={contextSystemId}
        parentMenuId={contextMenuId}
        systems={systems}
        menus={allMenus}
      />

      <PermissionDrawer
        open={permissionDrawerOpen}
        onClose={() => {
          setPermissionDrawerOpen(false);
          setEditingItem(null);
          setContextMenuId('');
        }}
        onSubmit={handlePermissionSubmit}
        initialData={editingItem}
        isEdit={!!editingItem}
        menuId={contextMenuId}
        systemMenus={allMenus}
      />

      <AdminDialogShell
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        width="sm"
        header={
          <AdminDialogHero
            icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.75} />}
            tone="danger"
            title={
              deleteConfirm?.type === 'system'
                ? '确认删除系统'
                : deleteConfirm?.type === 'menu'
                  ? '确认删除菜单'
                  : '确认删除权限'
            }
            description={
              deleteConfirm?.type === 'system'
                ? '该系统下所有菜单与权限也会一并删除。'
                : deleteConfirm?.type === 'menu'
                  ? '该菜单下所有子菜单与权限也会一并删除。'
                  : '关联角色的权限关系会立即失效。'
            }
          />
        }
        footer={
          <AdminDialogFooterRow
            aside="此操作不可撤销"
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  className="min-w-[80px] cursor-pointer text-sm"
                >
                  取消
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (!deleteConfirm) return;
                    if (deleteConfirm.type === 'system') deleteSystemMutation.mutate(deleteConfirm.id);
                    if (deleteConfirm.type === 'menu') deleteMenuMutation.mutate(deleteConfirm.id);
                    if (deleteConfirm.type === 'permission') deletePermissionMutation.mutate(deleteConfirm.id);
                    setDeleteConfirm(null);
                  }}
                  className="min-w-[104px] cursor-pointer text-sm font-medium"
                >
                  确认删除
                </Button>
              </>
            }
          />
        }
      >
        <p className="text-sm leading-7" style={{ color: 'var(--foreground)' }}>
          目标对象：
          <span
            className="ml-1.5 rounded-md px-1.5 py-0.5 font-mono text-[13px]"
            style={{
              backgroundColor: 'var(--panel-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {deleteConfirm?.name}
          </span>
        </p>
      </AdminDialogShell>
    </TreeProvider>
  );
}
