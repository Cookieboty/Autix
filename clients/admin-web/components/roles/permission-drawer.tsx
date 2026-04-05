'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

interface Permission {
  id: string;
  name: string;
  code: string;
  action: string;
  module: string;
}

interface PermissionGroup {
  module: string;
  permissions: Permission[];
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

const MODULE_LABELS: Record<string, string> = {
  user: '用户管理',
  role: '角色管理',
  permission: '权限管理',
  department: '部门管理',
  menu: '菜单管理',
};

const ACTION_LABELS: Record<string, string> = {
  create: '新增',
  read: '查看',
  update: '编辑',
  delete: '删除',
  export: '导出',
  import: '导入',
};

export function PermissionDrawer({ open, onOpenChange, role, onSuccess }: PermissionDrawerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 获取所有权限（按模块分组）
  const { data: groups = [] } = useQuery<PermissionGroup[]>({
    queryKey: ['permissions-grouped'],
    queryFn: async () => {
      const { data } = await api.get('/permissions');
      return data;
    },
    enabled: open,
  });

  // 获取角色当前权限
  const { data: rolePermissions = [] } = useQuery<Permission[]>({
    queryKey: ['role-permissions', role.id],
    queryFn: async () => {
      const { data } = await api.get(`/roles/${role.id}/permissions`);
      return data;
    },
    enabled: open,
  });

  // 初始化已选权限
  useEffect(() => {
    if (open && rolePermissions.length >= 0) {
      setSelected(new Set(rolePermissions.map((p) => p.id)));
    }
  }, [open, rolePermissions]);

  const togglePermission = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleModule = (permissions: Permission[]) => {
    const ids = permissions.map((p) => p.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/roles/${role.id}/permissions`, {
        permissionIds: Array.from(selected),
      });
      onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>分配权限 - {role.name}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto mt-6 space-y-6">
          {groups.map((group) => {
            const moduleIds = group.permissions.map((p) => p.id);
            const allSelected = moduleIds.every((id) => selected.has(id));
            const someSelected = moduleIds.some((id) => selected.has(id));

            return (
              <div key={group.module} className="rounded-lg border p-4">
                {/* 模块标题 + 全选 */}
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    id={`module-${group.module}`}
                    checked={allSelected}
                    data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
                    onCheckedChange={() => toggleModule(group.permissions)}
                    className="cursor-pointer"
                  />
                  <Label
                    htmlFor={`module-${group.module}`}
                    className="text-sm font-semibold cursor-pointer"
                  >
                    {MODULE_LABELS[group.module] || group.module}
                  </Label>
                  <span className="text-xs text-gray-400 ml-auto">
                    {moduleIds.filter((id) => selected.has(id)).length}/{moduleIds.length}
                  </span>
                </div>
                {/* 权限列表 */}
                <div className="grid grid-cols-2 gap-2 ml-6">
                  {group.permissions.map((perm) => (
                    <div key={perm.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`perm-${perm.id}`}
                        checked={selected.has(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id)}
                        className="cursor-pointer"
                      />
                      <Label
                        htmlFor={`perm-${perm.id}`}
                        className="text-sm text-gray-600 cursor-pointer"
                      >
                        {ACTION_LABELS[perm.action.toLowerCase()] || perm.action}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 pt-4 border-t mt-4">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 cursor-pointer"
            style={{ backgroundColor: '#7C3AED' }}
          >
            {loading ? '保存中...' : `保存 (${selected.size} 项)`}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 cursor-pointer"
          >
            取消
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
