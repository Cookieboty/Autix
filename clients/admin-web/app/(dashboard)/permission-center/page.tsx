'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TreeView } from '@/components/permission-tree/tree-view';
import { DetailPanel } from '@/components/permission-tree/detail-panel';
import { TreeProvider, SystemNode, MenuNode } from '@/components/permission-tree/tree-context';
import { SystemDrawer } from '@/components/permission-tree/system-drawer';
import { MenuDrawer } from '@/components/permission-tree/menu-drawer';
import { PermissionDrawer } from '@/components/permission-tree/permission-drawer';
import { toast } from 'sonner';
import api from '@/lib/api';

export default function PermissionCenterPage() {
  const queryClient = useQueryClient();
  const [systemDrawerOpen, setSystemDrawerOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [permissionDrawerOpen, setPermissionDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [contextSystemId, setContextSystemId] = useState<string>('');
  const [contextMenuId, setContextMenuId] = useState<string>('');

  const { data: systems = [], isLoading, refetch } = useQuery({
    queryKey: ['permission-tree'],
    queryFn: async () => {
      const res = await api.get('/permission-tree');
      return res.data;
    },
  });

  // Flatten all menus for menu drawer
  const allMenus = systems.flatMap((sys: any) => 
    (sys.menus || []).map((menu: any) => ({ ...menu, systemId: sys.id }))
  );

  // System Mutations
  const createSystemMutation = useMutation({
    mutationFn: (data: any) => api.post('/systems', data),
    onSuccess: () => {
      toast.success('系统创建成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('系统创建失败'),
  });

  const updateSystemMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/systems/${id}`, data),
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

  // Menu Mutations
  const createMenuMutation = useMutation({
    mutationFn: (data: any) => api.post('/menus', data),
    onSuccess: () => {
      toast.success('菜单创建成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('菜单创建失败'),
  });

  const updateMenuMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/menus/${id}`, data),
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

  // Permission Mutations
  const createPermissionMutation = useMutation({
    mutationFn: (data: any) => api.post('/permissions', data),
    onSuccess: () => {
      toast.success('权限创建成功');
      queryClient.invalidateQueries({ queryKey: ['permission-tree'] });
    },
    onError: () => toast.error('权限创建失败'),
  });

  const updatePermissionMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/permissions/${id}`, data),
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

  // Handlers
  const handleAddSystem = () => {
    setEditingItem(null);
    setSystemDrawerOpen(true);
  };

  const handleEditSystem = (system: SystemNode) => {
    setEditingItem(system);
    setSystemDrawerOpen(true);
  };

  const handleDeleteSystem = (systemId: string) => {
    if (confirm('确认删除此系统？此操作将同时删除该系统下的所有菜单和权限。')) {
      deleteSystemMutation.mutate(systemId);
    }
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
    if (confirm('确认删除此菜单？此操作将同时删除该菜单下的所有子菜单和权限。')) {
      deleteMenuMutation.mutate(menuId);
    }
  };

  const handleAddPermission = (menuId: string) => {
    setContextMenuId(menuId);
    setEditingItem(null);
    setPermissionDrawerOpen(true);
  };

  const handleEditPermission = (permission: any) => {
    setContextMenuId('');
    setEditingItem(permission);
    setPermissionDrawerOpen(true);
  };

  const handleDeletePermission = (permissionId: string) => {
    if (confirm('确认删除此权限？')) {
      deletePermissionMutation.mutate(permissionId);
    }
  };

  const handleSystemSubmit = async (data: any) => {
    if (editingItem) {
      await updateSystemMutation.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createSystemMutation.mutateAsync(data);
    }
    setSystemDrawerOpen(false);
    setEditingItem(null);
  };

  const handleMenuSubmit = async (data: any) => {
    if (editingItem) {
      await updateMenuMutation.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createMenuMutation.mutateAsync(data);
    }
    setMenuDrawerOpen(false);
    setEditingItem(null);
    setContextSystemId('');
    setContextMenuId('');
  };

  const handlePermissionSubmit = async (data: any) => {
    if (editingItem) {
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
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">权限配置中心</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                统一管理系统、菜单和权限的树状结构配置
              </p>
            </div>
          </div>
          <Button
            className="cursor-pointer gap-2 h-9 text-sm bg-[var(--color-system)] text-white"
            onClick={handleAddSystem}
          >
            <Plus className="h-3.5 w-3.5" />
            新增系统
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">
          {/* Left: Tree View */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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

          {/* Right: Detail Panel */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <DetailPanel />
          </div>
        </div>
      </div>

      {/* Drawers */}
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
    </TreeProvider>
  );
}
