'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import {
  Key,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Layers,
  Menu as MenuIcon,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  useAdminPermissionTreeQuery,
  useAdminRoleMenusQuery,
  useAdminRolePermissionsQuery,
  useUpdateAdminRoleMenusAndPermissionsMutation,
} from '@autix/shared-store';
import {
  AdminDrawerShell,
  AdminDrawerHero,
  AdminDrawerFooter,
  AdminDrawerMeta,
} from '../../admin-drawer-shell';

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

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-success bg-success/10',
  READ: 'text-info bg-info/10',
  UPDATE: 'text-warning bg-warning/10',
  DELETE: 'text-destructive bg-destructive/10',
  EXPORT: 'text-muted-foreground bg-muted',
  IMPORT: 'text-muted-foreground bg-muted',
};

const selectionCountClass = (allSelected: boolean, someSelected: boolean) => {
  if (allSelected) return 'text-success bg-success/10';
  if (someSelected) return 'text-warning bg-warning/10';
  return 'text-muted-foreground bg-muted';
};

export function PermissionDrawer({
  open,
  onOpenChange,
  role,
  onSuccess,
}: PermissionDrawerProps) {
  const t = useTranslations('roles');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [selectedMenus, setSelectedMenus] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const updateRolePermissionsMutation = useUpdateAdminRoleMenusAndPermissionsMutation();

  const { data: systems = [] } = useAdminPermissionTreeQuery(open);
  const { data: rolePermissions = [] } = useAdminRolePermissionsQuery(role.id, open);
  const { data: roleMenus = [] } = useAdminRoleMenusQuery(role.id, open);

  useEffect(() => {
    if (open) {
      setSelectedPermissions(new Set(rolePermissions.map((p) => p.id)));
      setSelectedMenus(new Set(roleMenus.map((m) => m.id)));
    }
  }, [open, role.id, rolePermissions, roleMenus]);

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
      await updateRolePermissionsMutation.mutateAsync({
        roleId: role.id,
        menuIds: Array.from(selectedMenus),
        permissionIds: Array.from(selectedPermissions),
      });
      onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || t('permSaveFailed'));
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
              ? 'color-mix(in srgb, var(--brand) 6%, transparent)'
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
            checked={allSelected}
            onCheckedChange={() => toggleMenu(menu)}
            className="cursor-pointer"
          />

          <div
            className="flex h-7 w-7 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)',
            }}
          >
            <IconComponent
              className="h-3.5 w-3.5"
              style={{ color: 'var(--brand)' }}
            />
          </div>

          <Label
            className="flex-1 cursor-pointer text-sm font-medium"
            style={{ color: 'var(--foreground)' }}
          >
            {menu.name}
          </Label>

          <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectionCountClass(allSelected, someSelected)}`}>
            {selectedCount}/{menuPermIds.length}
          </span>
        </div>

        {isExpanded && (
          <div>
            {menu.permissions.map((perm) => {
              const isChecked = selectedPermissions.has(perm.id);
              const actionLabelMap: Record<string, string> = {
                CREATE: t('actionCreate'),
                READ: t('actionRead'),
                UPDATE: t('actionUpdate'),
                DELETE: t('actionDelete'),
                EXPORT: t('actionExport'),
                IMPORT: t('actionImport'),
              };
              const actionLabel = actionLabelMap[perm.action] ?? perm.action;
              const actionColor = ACTION_COLORS[perm.action] ?? 'text-muted-foreground bg-muted';

              return (
                <button
                  key={perm.id}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{
                    paddingLeft: `${32 + indent + 20}px`,
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: isChecked
                      ? 'color-mix(in srgb, var(--brand) 10%, transparent)'
                      : 'transparent',
                  }}
                  onClick={() => togglePermission(perm.id)}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => togglePermission(perm.id)}
                    className="cursor-pointer"
                  />
                  <Key
                    className="h-3 w-3"
                    style={{ color: 'var(--brand)' }}
                  />
                  <span
                    className="flex-1 text-sm"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {perm.name}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${actionColor}`}>
                    {actionLabel}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${perm.type === 'FRONTEND' ? 'text-info bg-info/10' : 'text-success bg-success/10'}`}>
                    {perm.type === 'FRONTEND' ? t('permFrontend') : t('permBackend')}
                  </span>
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
          title={t('permAssignTitle')}
          description={t('permAssignDescription', { roleName: role.name })}
          meta={
            <span className="text-[10px] px-1.5 py-0.5 rounded text-info bg-info/10">
              {t('permSelectedItems', { count: selectedPermissions.size })}
            </span>
          }
        />
      }
      footer={
        <AdminDrawerFooter
          aside={
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {t('permMenuCount', { menuCount: selectedMenus.size, permCount: selectedPermissions.size })}
            </p>
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-w-[88px] cursor-pointer text-sm font-medium"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading}
                className="min-w-[120px] cursor-pointer text-sm font-medium shadow-sm"
              >
                {loading ? (
                  t('permSaving')
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {t('permSaveConfig')}
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
                  checked={allSelected}
                  onCheckedChange={() => toggleSystem(system)}
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
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectionCountClass(allSelected, someSelected)}`}>
                  {selectedCount}/{systemPermIds.length}
                </span>
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
