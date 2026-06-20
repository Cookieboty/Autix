'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@autix/shared-ui/ui';
import {
  AdminDialogShell,
  AdminDialogHero,
  AdminDialogFooterRow,
} from '@autix/shared-ui/shells';
import {
  DetailPanel,
  MenuDrawer,
  PermissionTreePermissionDrawer as PermissionDrawer,
  SystemDrawer,
  TreeProvider,
  TreeView,
  type MenuNodeData,
  type PermissionNodeData,
  type SystemNodeData,
} from '@autix/shared-ui/admin';
import { toast } from 'sonner';
import {
  useAdminPermissionTreeQuery,
  useCreateAdminMenuMutation,
  useCreateAdminPermissionMutation,
  useCreateAdminSystemMutation,
  useDeleteAdminMenuMutation,
  useDeleteAdminPermissionMutation,
  useDeleteAdminSystemMutation,
  useUpdateAdminMenuMutation,
  useUpdateAdminPermissionMutation,
  useUpdateAdminSystemMutation,
  type AdminMenuFormInput,
  type AdminPermissionFormInput,
  type AdminSystemFormInput,
} from '@autix/shared-store';

type SystemFormData = AdminSystemFormInput;
type MenuFormData = AdminMenuFormInput;
type PermissionFormData = AdminPermissionFormInput;

type SystemNode = SystemNodeData;
type MenuNode = MenuNodeData;
type PermissionNode = PermissionNodeData;

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
  const [systemDrawerOpen, setSystemDrawerOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [permissionDrawerOpen, setPermissionDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SystemNode | MenuNode | PermissionNode | null>(null);
  const [contextSystemId, setContextSystemId] = useState('');
  const [contextMenuId, setContextMenuId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  const { data: systems = [], isLoading, refetch } = useAdminPermissionTreeQuery();

  const allMenus: FlatMenu[] = systems.flatMap((sys) =>
    (sys.menus || []).map((menu) => ({ ...menu, systemId: sys.id })),
  );

  const createSystemMutation = useCreateAdminSystemMutation({
    onSuccess: () => {
      toast.success(t('toastSystemCreateSuccess'));
    },
    onError: () => toast.error(t('toastSystemCreateFailed')),
  });

  const updateSystemMutation = useUpdateAdminSystemMutation({
    onSuccess: () => {
      toast.success(t('toastSystemUpdateSuccess'));
    },
    onError: () => toast.error(t('toastSystemUpdateFailed')),
  });

  const deleteSystemMutation = useDeleteAdminSystemMutation({
    onSuccess: () => {
      toast.success(t('toastSystemDeleteSuccess'));
    },
    onError: () => toast.error(t('toastSystemDeleteFailed')),
  });

  const createMenuMutation = useCreateAdminMenuMutation({
    onSuccess: () => {
      toast.success(t('toastMenuCreateSuccess'));
    },
    onError: () => toast.error(t('toastMenuCreateFailed')),
  });

  const updateMenuMutation = useUpdateAdminMenuMutation({
    onSuccess: () => {
      toast.success(t('toastMenuUpdateSuccess'));
    },
    onError: () => toast.error(t('toastMenuUpdateFailed')),
  });

  const deleteMenuMutation = useDeleteAdminMenuMutation({
    onSuccess: () => {
      toast.success(t('toastMenuDeleteSuccess'));
    },
    onError: () => toast.error(t('toastMenuDeleteFailed')),
  });

  const createPermissionMutation = useCreateAdminPermissionMutation({
    onSuccess: () => {
      toast.success(t('toastPermCreateSuccess'));
    },
    onError: () => toast.error(t('toastPermCreateFailed')),
  });

  const updatePermissionMutation = useUpdateAdminPermissionMutation({
    onSuccess: () => {
      toast.success(t('toastPermUpdateSuccess'));
    },
    onError: () => toast.error(t('toastPermUpdateFailed')),
  });

  const deletePermissionMutation = useDeleteAdminPermissionMutation({
    onSuccess: () => {
      toast.success(t('toastPermDeleteSuccess'));
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
      await updateSystemMutation.mutateAsync({ id: editingItem.id, data });
    } else {
      await createSystemMutation.mutateAsync(data);
    }
    setSystemDrawerOpen(false);
    setEditingItem(null);
  };

  const handleMenuSubmit = async (data: MenuFormData) => {
    if (editingItem && 'id' in editingItem) {
      await updateMenuMutation.mutateAsync({ id: editingItem.id, data });
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
      await updatePermissionMutation.mutateAsync({ id: editingItem.id, data });
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
            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
              {t('centerEyebrow')}
            </p>
            <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-[-0.04em]">
              {t('centerTitle')}
            </h1>
          </div>
          <Button onClick={handleAddSystem} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t('addSystem')}
          </Button>
        </div>

        <div className="grid min-h-[calc(100vh-16rem)] grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="bg-card border-border overflow-hidden rounded-lg border">
            <PageShell>
              <div className="border-border border-b px-6 py-5">
                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                  {t('treeEyebrow')}
                </p>
                <h2 className="text-foreground mt-2 text-lg font-semibold">
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

          <section className="bg-card border-border overflow-hidden rounded-lg border">
            <PageShell>
              <div className="border-border border-b px-6 py-5">
                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                  {t('detailEyebrow')}
                </p>
                <h2 className="text-foreground mt-2 text-lg font-semibold">
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
        <p className="text-foreground text-sm leading-7">
          {t('targetObject')}
          <span className="bg-secondary border-border ml-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[13px]">
            {deleteConfirm?.name}
          </span>
        </p>
      </AdminDialogShell>
    </TreeProvider>
  );
}
