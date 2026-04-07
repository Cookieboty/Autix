'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Key, CheckCircle2, ChevronRight, ChevronDown, Layers, Menu as MenuIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import api from '@/lib/api';

interface Permission {
  id: string;
  name: string;
  code: string;
  action: string;
  type: 'FRONTEND' | 'BACKEND';
}

interface Menu {
  id: string;
  name: string;
  code: string;
  icon?: string;
  children: Menu[];
  permissions: Permission[];
}

interface System {
  id: string;
  name: string;
  code: string;
  menus: Menu[];
}

interface Role {
  id: string;
  name: string;
}

interface PermissionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
  onSuccess: () => void;
}

const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  CREATE: { label: '新增', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  READ:   { label: '查看', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  UPDATE: { label: '编辑', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DELETE: { label: '删除', className: 'bg-red-50 text-red-700 border-red-200' },
  EXPORT: { label: '导出', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  IMPORT: { label: '导入', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

export function PermissionDrawer({ open, onOpenChange, role, onSuccess }: PermissionDrawerProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [selectedMenus, setSelectedMenus] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const { data: systems = [] } = useQuery<System[]>({
    queryKey: ['permission-tree'],
    queryFn: async () => {
      const { data } = await api.get('/permission-tree');
      return data;
    },
    enabled: open,
  });

  const { data: rolePermissions = [] } = useQuery<Permission[]>({
    queryKey: ['role-permissions', role.id],
    queryFn: async () => {
      const { data } = await api.get(`/roles/${role.id}/permissions`);
      return data;
    },
    enabled: open,
  });

  const { data: roleMenus = [] } = useQuery<{ id: string }[]>({
    queryKey: ['role-menus', role.id],
    queryFn: async () => {
      const { data } = await api.get(`/roles/${role.id}/menus`);
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSelectedPermissions(new Set(rolePermissions.map((p) => p.id)));
      setSelectedMenus(new Set(roleMenus.map((m) => m.id)));
    }
  }, [open, role.id]); // 只依赖 open 和 role.id，避免无限循环

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getAllMenuPermissions = (menu: Menu): string[] => {
    const permIds = menu.permissions.map(p => p.id);
    menu.children.forEach(child => {
      permIds.push(...getAllMenuPermissions(child));
    });
    return permIds;
  };

  const getAllSystemPermissions = (system: System): string[] => {
    let permIds: string[] = [];
    system.menus.forEach(menu => {
      permIds.push(...getAllMenuPermissions(menu));
    });
    return permIds;
  };

  const getAllSystemMenus = (system: System): string[] => {
    let menuIds: string[] = [];
    const collectMenuIds = (menu: Menu) => {
      menuIds.push(menu.id);
      menu.children.forEach(child => collectMenuIds(child));
    };
    system.menus.forEach(menu => collectMenuIds(menu));
    return menuIds;
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const toggleMenu = (menu: Menu) => {
    const menuPermIds = getAllMenuPermissions(menu);
    const allSelected = menuPermIds.every((id) => selectedPermissions.has(id));

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        menuPermIds.forEach((id) => next.delete(id));
        setSelectedMenus((m) => {
          const nextMenus = new Set(m);
          nextMenus.delete(menu.id);
          menu.children.forEach(child => nextMenus.delete(child.id));
          return nextMenus;
        });
      } else {
        menuPermIds.forEach((id) => next.add(id));
        setSelectedMenus((m) => {
          const nextMenus = new Set(m);
          nextMenus.add(menu.id);
          const addChildMenus = (m: Menu) => {
            m.children.forEach(child => {
              nextMenus.add(child.id);
              addChildMenus(child);
            });
          };
          addChildMenus(menu);
          return nextMenus;
        });
      }
      return next;
    });
  };

  const toggleSystem = (system: System) => {
    const systemPermIds = getAllSystemPermissions(system);
    const allSelected = systemPermIds.every((id) => selectedPermissions.has(id));

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        systemPermIds.forEach((id) => next.delete(id));
      } else {
        systemPermIds.forEach((id) => next.add(id));
      }
      return next;
    });

    const systemMenuIds = getAllSystemMenus(system);
    setSelectedMenus((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        systemMenuIds.forEach((id) => next.delete(id));
      } else {
        systemMenuIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/roles/${role.id}/menus-and-permissions`, {
        menuIds: Array.from(selectedMenus),
        permissionIds: Array.from(selectedPermissions),
      });
      onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const renderMenu = (menu: Menu, level = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(menu.id);
    const menuPermIds = getAllMenuPermissions(menu);
    const allSelected = menuPermIds.every((id) => selectedPermissions.has(id));
    const someSelected = menuPermIds.some((id) => selectedPermissions.has(id));
    const selectedCount = menuPermIds.filter((id) => selectedPermissions.has(id)).length;
    const indent = level * 20;

    const IconComponent = menu.icon && (LucideIcons as any)[menu.icon] 
      ? (LucideIcons as any)[menu.icon] 
      : MenuIcon;

    return (
      <div key={menu.id} className="select-none">
        {/* Menu Header */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {/* Expand Icon */}
          {(menu.children.length > 0 || menu.permissions.length > 0) && (
            <button
              onClick={() => toggleNode(menu.id)}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>
          )}

          {/* Checkbox */}
          <Checkbox
            checked={allSelected}
            data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
            onCheckedChange={() => toggleMenu(menu)}
            className="cursor-pointer data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
          />

          {/* Icon */}
          <div className="p-1 rounded bg-teal-100">
            <IconComponent className="h-3.5 w-3.5 text-teal-600" />
          </div>

          {/* Name */}
          <Label className="flex-1 text-sm font-medium cursor-pointer">
            {menu.name}
          </Label>

          {/* Count Badge */}
          <Badge
            variant="outline"
            className={`text-xs ${
              allSelected
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : someSelected
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            {selectedCount}/{menuPermIds.length}
          </Badge>
        </div>

        {/* Permissions and Submenus */}
        {isExpanded && (
          <div className="mt-1 space-y-1">
            {/* Permissions */}
            {menu.permissions.map((perm) => {
              const isChecked = selectedPermissions.has(perm.id);
              const actionCfg = ACTION_CONFIG[perm.action] ?? {
                label: perm.action,
                className: 'bg-gray-50 text-gray-600 border-gray-200',
              };

              return (
                <div
                  key={perm.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-blue-50/50 border-blue-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  style={{ paddingLeft: `${32 + indent + 20}px` }}
                  onClick={() => togglePermission(perm.id)}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => togglePermission(perm.id)}
                    className="cursor-pointer data-[state=checked]:bg-blue-600"
                  />
                  <Key className="h-3 w-3 text-blue-600" />
                  <span className="flex-1 text-sm">{perm.name}</span>
                  <Badge className={`text-xs border ${actionCfg.className}`}>
                    {actionCfg.label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      perm.type === 'FRONTEND'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}
                  >
                    {perm.type === 'FRONTEND' ? '前端' : '后端'}
                  </Badge>
                </div>
              );
            })}

            {/* Child Menus */}
            {menu.children.map((child) => renderMenu(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[640px] sm:max-w-[640px] flex flex-col p-0 h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Key className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-gray-900">分配权限</div>
                <div className="text-sm font-normal text-gray-500 mt-0.5">{role.name}</div>
              </div>
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4">
          <div className="space-y-3">
            {systems.map((system) => {
              const systemPermIds = getAllSystemPermissions(system);
              const allSelected = systemPermIds.every((id) => selectedPermissions.has(id));
              const someSelected = systemPermIds.some((id) => selectedPermissions.has(id));
              const selectedCount = systemPermIds.filter((id) => selectedPermissions.has(id)).length;
              const isExpanded = expandedNodes.has(system.id);

              return (
                <div
                  key={system.id}
                  className="rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* System Header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b rounded-t-xl">
                    <button
                      onClick={() => toggleNode(system.id)}
                      className="p-0.5 hover:bg-white/50 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-700" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-700" />
                      )}
                    </button>
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
                      onCheckedChange={() => toggleSystem(system)}
                      className="cursor-pointer data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                    <Layers className="h-4 w-4 text-emerald-600" />
                    <Label className="flex-1 text-sm font-bold text-gray-900 cursor-pointer">
                      {system.name}
                    </Label>
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium ${
                        allSelected
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : someSelected
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {selectedCount}/{systemPermIds.length}
                    </Badge>
                  </div>

                  {/* Menus */}
                  {isExpanded && (
                    <div className="p-3 space-y-1">
                      {system.menus.map((menu) => renderMenu(menu))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 cursor-pointer h-11 text-base font-medium shadow-sm bg-primary text-primary-foreground"
            >
              {loading ? (
                '保存中...'
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  保存 ({selectedPermissions.size} 权限, {selectedMenus.size} 菜单)
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 cursor-pointer h-11 text-base font-medium"
            >
              取消
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
