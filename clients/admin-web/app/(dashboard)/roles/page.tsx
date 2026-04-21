'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Edit, Trash, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@heroui/react';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableColumn,
  TableContent,
} from '@heroui/react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { RoleDrawer } from '@/components/roles/role-drawer';
import { PermissionDrawer } from '@/components/roles/permission-drawer';
import {
  AdminDialogShell,
  AdminDialogHero,
  AdminDialogFooterRow,
} from '@/components/dialog-shell';

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
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<Role | null>(null);

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
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
            Role administration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--foreground)' }}>
            角色管理
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => refetch()}
            className="h-9 w-9 cursor-pointer rounded-md"
            aria-label="刷新"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCreate && (
            <Button
              onClick={openCreate}
              className="h-9 rounded-md px-3"
              style={{ backgroundColor: 'var(--foreground)', color: 'var(--panel)' }}
            >
              <Plus className="mr-2 h-4 w-4" />
              新增角色
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden">
        <Table>
          <TableContent>
            <TableHeader>
              <TableColumn isRowHeader>角色名称</TableColumn>
              <TableColumn>角色编码</TableColumn>
              <TableColumn>描述</TableColumn>
              <TableColumn>关联用户</TableColumn>
              <TableColumn>权限数量</TableColumn>
              <TableColumn>创建时间</TableColumn>
              <TableColumn className="text-right">操作</TableColumn>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{role.code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{role.description || '-'}</TableCell>
                    <TableCell>{role._count.users}</TableCell>
                    <TableCell>{role._count.permissions}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(role.createdAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(role)}
                              className="h-8 px-2 cursor-pointer hover:bg-accent/10 hover:text-accent"
                              aria-label="编辑"
                            >
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPermissions(role)}
                              className="h-8 px-2 cursor-pointer hover:bg-accent/10 hover:text-accent"
                              aria-label="分配权限"
                            >
                              <Shield className="h-3.5 w-3.5 mr-1" />
                              权限
                            </Button>
                          </>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmRole(role)}
                            className="h-8 px-2 cursor-pointer text-danger hover:bg-danger/10 hover:text-danger"
                            aria-label="删除"
                          >
                            <Trash className="h-3.5 w-3.5 mr-1" />
                            删除
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </TableContent>
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

      <AdminDialogShell
        open={!!deleteConfirmRole}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmRole(null);
        }}
        width="sm"
        header={
          <AdminDialogHero
            icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.75} />}
            tone="danger"
            title="确认删除角色"
            description="角色下所有绑定的用户权限关系将同时解除。"
          />
        }
        footer={
          <AdminDialogFooterRow
            aside="此操作不可撤销"
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmRole(null)}
                  className="min-w-[80px] cursor-pointer text-sm"
                >
                  取消
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (deleteConfirmRole) {
                      deleteMutation.mutate(deleteConfirmRole.id);
                      setDeleteConfirmRole(null);
                    }
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
          确认删除角色{' '}
          <span
            className="rounded-md px-1.5 py-0.5 font-mono text-[13px]"
            style={{
              backgroundColor: 'var(--panel-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {deleteConfirmRole?.name}
          </span>
          ？
        </p>
      </AdminDialogShell>
    </div>
  );
}
