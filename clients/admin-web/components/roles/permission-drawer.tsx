'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Checkbox, Label } from '@heroui/react';
import {
  Key,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Layers,
  Menu as MenuIcon,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import api from '@/lib/api';
import {
  AdminDrawerShell,
  AdminDrawerHero,
  AdminDrawerFooter,
  AdminDrawerMeta,
} from '@/components/drawer-shell';

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

const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    color: 'success' | 'warning' | 'danger' | 'accent' | 'default';
  }
> = {
  CREATE: { label: '新增', color: 'success' },
  READ: { label: '查看', color: 'accent' },
  UPDATE: { label: '编辑', color: 'warning' },
  DELETE: { label: '删除', color: 'danger' },
  EXPORT: { label: '导出', color: 'default' },
  IMPORT: { label: '导入', color: 'default' },
};

export function PermissionDrawer({
  open,
  onOpenChange,
  role,
  onSuccess,
}: PermissionDrawerProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );
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
  }, [open, role.id]);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getAllMenuPermissions = (menu: Menu): string[] => {
    const permIds = menu.permissions.map((p) => p.id);
    menu.children.forEach((child) => {
      permIds.push(...getAllMenuPermissions(child));
    });
    return permIds;
  };

  const getAllSystemPermissions = (system: System): string[] => {
    let permIds: string[] = [];
    system.menus.forEach((menu) => {
      permIds.push(...getAllMenuPermissions(menu));
    });
    return permIds;
  };

  const getAllSystemMenus = (system: System): string[] => {
    const menuIds: string[] = [];
    const collectMenuIds = (menu: Menu) => {
      menuIds.push(menu.id);
      menu.children.forEach((child) => collectMenuIds(child));
    };
    system.menus.forEach((menu) => collectMenuIds(menu));
    return menuIds;
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
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
        setSelectedMenus((currentMenus) => {
          const nextMenus = new Set(currentMenus);
          nextMenus.delete(menu.id);
          menu.children.forEach((child) => nextMenus.delete(child.id));
          return nextMenus;
        });
      } else {
        menuPermIds.forEach((id) => next.add(id));
        setSelectedMenus((currentMenus) => {
          const nextMenus = new Set(currentMenus);
          nextMenus.add(menu.id);
          const addChildMenus = (currentMenu: Menu) => {
            currentMenu.children.forEach((child) => {
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
    const allSelected = systemPermIds.every((id) =>
      selectedPermissions.has(id),
    );

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) systemPermIds.forEach((id) => next.delete(id));
      else systemPermIds.forEach((id) => next.add(id));
      return next;
    });

    const systemMenuIds = getAllSystemMenus(system);
    setSelectedMenus((prev) => {
      const next = new Set(prev);
      if (allSelected) systemMenuIds.forEach((id) => next.delete(id));
      else systemMenuIds.forEach((id) => next.add(id));
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
    const selectedCount = menuPermIds.filter((id) =>
      selectedPermissions.has(id),
    ).length;
    const indent = level * 20;

    const IconComponent =
      menu.icon && (LucideIcons as any)[menu.icon]
        ? (LucideIcons as any)[menu.icon]
        : MenuIcon;

    return (
      <div key={menu.id} className="select-none">
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 transition-colors"
          style={{
            paddingLeft: `${12 + indent}px`,
            borderBottom: '1px solid var(--border)',
            backgroundColor: someSelected
              ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
              : 'transparent',
          }}
        >
          {(menu.children.length > 0 || menu.permissions.length > 0) ? (
            <button
              type="button"
              onClick={() => toggleNode(menu.id)}
              className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronDown
                  className="h-4 w-4"
                  style={{ color: 'var(--muted)' }}
                />
              ) : (
                <ChevronRight
                  className="h-4 w-4"
                  style={{ color: 'var(--muted)' }}
                />
              )}
            </button>
          ) : (
            <span className="h-6 w-6" aria-hidden />
          )}

          <Checkbox
            isSelected={allSelected}
            onChange={() => toggleMenu(menu)}
            className="cursor-pointer"
          />

          <div
            className="flex h-7 w-7 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            }}
          >
            <IconComponent
              className="h-3.5 w-3.5"
              style={{ color: 'var(--accent)' }}
            />
          </div>

          <Label
            className="flex-1 cursor-pointer text-sm font-medium"
            style={{ color: 'var(--foreground)' }}
          >
            {menu.name}
          </Label>

          <AdminDrawerMeta
            tone={
              allSelected ? 'success' : someSelected ? 'warning' : 'default'
            }
          >
            {selectedCount}/{menuPermIds.length}
          </AdminDrawerMeta>
        </div>

        {isExpanded && (
          <div>
            {menu.permissions.map((perm) => {
              const isChecked = selectedPermissions.has(perm.id);
              const actionCfg = ACTION_CONFIG[perm.action] ?? {
                label: perm.action,
                color: 'default' as const,
              };

              return (
                <button
                  key={perm.id}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{
                    paddingLeft: `${32 + indent + 20}px`,
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: isChecked
                      ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                      : 'transparent',
                  }}
                  onClick={() => togglePermission(perm.id)}
                >
                  <Checkbox
                    isSelected={isChecked}
                    onChange={() => togglePermission(perm.id)}
                    className="cursor-pointer"
                  />
                  <Key
                    className="h-3 w-3"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span
                    className="flex-1 text-sm"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {perm.name}
                  </span>
                  <AdminDrawerMeta tone={actionCfg.color}>
                    {actionCfg.label}
                  </AdminDrawerMeta>
                  <AdminDrawerMeta
                    tone={perm.type === 'FRONTEND' ? 'accent' : 'success'}
                  >
                    {perm.type === 'FRONTEND' ? '前端' : '后端'}
                  </AdminDrawerMeta>
                </button>
              );
            })}

            {menu.children.map((child) => renderMenu(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      header={
        <AdminDrawerHero
          icon={<Key className="h-5 w-5" strokeWidth={1.75} />}
          title="分配权限"
          description={`为角色「${role.name}」配置可见菜单与操作权限。`}
          meta={
            <AdminDrawerMeta tone="accent">
              已选 {selectedPermissions.size} 项
            </AdminDrawerMeta>
          }
        />
      }
      footer={
        <AdminDrawerFooter
          aside={
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {selectedMenus.size} 个菜单 · {selectedPermissions.size} 个权限
            </p>
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-w-[88px] cursor-pointer text-sm font-medium"
              >
                取消
              </Button>
              <Button
                onClick={handleSave}
                variant="primary"
                {...({ isLoading: loading } as any)}
                className="min-w-[120px] cursor-pointer text-sm font-medium shadow-sm"
              >
                {loading ? (
                  '保存中...'
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    保存配置
                  </span>
                )}
              </Button>
            </>
          }
        />
      }
    >
      <div className="space-y-4">
        {systems.map((system) => {
          const systemPermIds = getAllSystemPermissions(system);
          const allSelected = systemPermIds.every((id) =>
            selectedPermissions.has(id),
          );
          const someSelected = systemPermIds.some((id) =>
            selectedPermissions.has(id),
          );
          const selectedCount = systemPermIds.filter((id) =>
            selectedPermissions.has(id),
          ).length;
          const isExpanded = expandedNodes.has(system.id);

          return (
            <section
              key={system.id}
              className="overflow-hidden rounded-md"
              style={{
                border: '1px solid var(--border)',
                backgroundColor: 'var(--panel)',
              }}
            >
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  backgroundColor: 'var(--panel-muted)',
                  borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleNode(system.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown
                      className="h-4 w-4"
                      style={{ color: 'var(--muted)' }}
                    />
                  ) : (
                    <ChevronRight
                      className="h-4 w-4"
                      style={{ color: 'var(--muted)' }}
                    />
                  )}
                </button>
                <Checkbox
                  isSelected={allSelected}
                  onChange={() => toggleSystem(system)}
                  className="cursor-pointer"
                />
                <Layers
                  className="h-4 w-4"
                  style={{ color: 'var(--success)' }}
                />
                <Label
                  className="flex-1 cursor-pointer text-sm font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {system.name}
                </Label>
                <AdminDrawerMeta
                  tone={
                    allSelected
                      ? 'success'
                      : someSelected
                        ? 'warning'
                        : 'default'
                  }
                >
                  {selectedCount}/{systemPermIds.length}
                </AdminDrawerMeta>
              </div>

              {isExpanded && (
                <div>{system.menus.map((menu) => renderMenu(menu))}</div>
              )}
            </section>
          );
        })}
      </div>
    </AdminDrawerShell>
  );
}
