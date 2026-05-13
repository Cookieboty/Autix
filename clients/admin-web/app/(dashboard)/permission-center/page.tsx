'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Network, AlertTriangle } from 'lucide-react';
import { Button } from '@autix/shared-ui/ui';
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
  autoApprove: boolean;
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
  const t = useTranslations('permission');
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
      toast.success(t('toastSystemCreateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error(t('toastSystemCreateFailed')),
  });

  const updateSystemMutation = useMutation({
    mutationFn: ({ id, ...data }: SystemFormData & { id: string }) => api.patch(`/systems/${id}`, data),
    onSuccess: () => {
      toast.success(t('toastSystemUpdateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error(t('toastSystemUpdateFailed')),
  });

  const deleteSystemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/systems/${id}`),
    onSuccess: () => {
      toast.success(t('toastSystemDeleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error(t('toastSystemDeleteFailed')),
  });

  const createMenuMutation = useMutation({
    mutationFn: (data: MenuFormData) => api.post('/menus', data),
    onSuccess: () => {
      toast.success(t('toastMenuCreateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error(t('toastMenuCreateFailed')),
  });

  const updateMenuMutation = useMutation({
    mutationFn: ({ id, ...data }: MenuFormData & { id: string }) => api.put(`/menus/${id}`, data),
    onSuccess: () => {
      toast.success(t('toastMenuUpdateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error(t('toastMenuUpdateFailed')),
  });

  const deleteMenuMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menus/${id}`),
    onSuccess: () => {
      toast.success(t('toastMenuDeleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error(t('toastMenuDeleteFailed')),
  });

  const createPermissionMutation = useMutation({
    mutationFn: (data: PermissionFormData) => api.post('/permissions', data),
    onSuccess: () => {
      toast.success(t('toastPermCreateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error(t('toastPermCreateFailed')),
  });

  const updatePermissionMutation = useMutation({
    mutationFn: ({ id, ...data }: PermissionFormData & { id: string }) => api.put(`/permissions/${id}`, data),
    onSuccess: () => {
      toast.success(t('toastPermUpdateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error(t('toastPermUpdateFailed')),
  });

  const deletePermissionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/permissions/${id}`),
    onSuccess: () => {
      toast.success(t('toastPermDeleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error(t('toastPermDeleteFailed')),
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
    setDeleteConfirm({ type: 'permission', id: permissionId, name: t('thisPermission') });
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
              {t('centerEyebrow')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--foreground)' }}>
              {t('centerTitle')}
            </h1>
          </div>
          <Button
            onClick={handleAddSystem}
            className="h-9 rounded-md px-3"
            style={{ backgroundColor: 'var(--foreground)', color: 'var(--panel)' }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('addSystem')}
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
                  {t('treeEyebrow')}
                </p>
                <h2 className="mt-2 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t('treeTitle')}
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
                  {t('detailEyebrow')}
                </p>
                <h2 className="mt-2 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t('detailTitle')}
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
                ? t('deleteSystemTitle')
                : deleteConfirm?.type === 'menu'
                  ? t('deleteMenuTitle')
                  : t('deletePermTitle')
            }
            description={
              deleteConfirm?.type === 'system'
                ? t('deleteSystemDesc')
                : deleteConfirm?.type === 'menu'
                  ? t('deleteMenuDesc')
                  : t('deletePermDesc')
            }
          />
        }
        footer={
          <AdminDialogFooterRow
            aside={t('irreversible')}
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  className="min-w-[80px] cursor-pointer text-sm"
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!deleteConfirm) return;
                    if (deleteConfirm.type === 'system') deleteSystemMutation.mutate(deleteConfirm.id);
                    if (deleteConfirm.type === 'menu') deleteMenuMutation.mutate(deleteConfirm.id);
                    if (deleteConfirm.type === 'permission') deletePermissionMutation.mutate(deleteConfirm.id);
                    setDeleteConfirm(null);
                  }}
                  className="min-w-[104px] cursor-pointer text-sm font-medium"
                >
                  {t('confirmDelete')}
                </Button>
              </>
            }
          />
        }
      >
        <p className="text-sm leading-7" style={{ color: 'var(--foreground)' }}>
          {t('targetObject')}
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
