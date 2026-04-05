'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreHorizontal, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { RoleDrawer } from '@/components/roles/role-drawer';
import { PermissionDrawer } from '@/components/roles/permission-drawer';

interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  sort: number;
  createdAt: string;
  _count: { users: number; permissions: number };
}

export default function RolesPage() {
  const { hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [permDrawerOpen, setPermDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [permRole, setPermRole] = useState<Role | null>(null);

  const canCreate = hasPermission('role:create');
  const canUpdate = hasPermission('role:update');
  const canDelete = hasPermission('role:delete');

  const { data: roles = [], isLoading, refetch } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get('/roles');
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });

  const openCreate = () => {
    setEditingRole(null);
    setRoleDrawerOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setRoleDrawerOpen(true);
  };

  const openPermissions = (role: Role) => {
    setPermRole(role);
    setPermDrawerOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-mono" style={{ color: '#7C3AED' }}>
          角色管理
        </h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => refetch()} className="cursor-pointer">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCreate && (
            <Button
              onClick={openCreate}
              className="cursor-pointer"
              style={{ backgroundColor: '#7C3AED' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              新增角色
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>角色名称</TableHead>
              <TableHead>角色编码</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>关联用户</TableHead>
              <TableHead>权限数量</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                  加载中...
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="font-mono text-sm text-gray-500">{role.code}</TableCell>
                  <TableCell className="text-sm text-gray-500">{role.description || '-'}</TableCell>
                  <TableCell>{role._count.users}</TableCell>
                  <TableCell>{role._count.permissions}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(role.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <>
                            <DropdownMenuItem
                              onClick={() => openEdit(role)}
                              className="cursor-pointer"
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openPermissions(role)}
                              className="cursor-pointer"
                            >
                              分配权限
                            </DropdownMenuItem>
                          </>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm(`确认删除角色 ${role.name}？`)) {
                                deleteMutation.mutate(role.id);
                              }
                            }}
                            className="cursor-pointer text-red-600"
                          >
                            删除
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RoleDrawer
        open={roleDrawerOpen}
        onOpenChange={setRoleDrawerOpen}
        role={editingRole}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['roles'] });
          setRoleDrawerOpen(false);
        }}
      />

      {permRole && (
        <PermissionDrawer
          open={permDrawerOpen}
          onOpenChange={setPermDrawerOpen}
          role={permRole}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setPermDrawerOpen(false);
          }}
        />
      )}
    </div>
  );
}
