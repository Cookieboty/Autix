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
import {
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-mono text-primary">
          角色管理
        </h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => refetch()} className="cursor-pointer">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCreate && (
            <Button
              onClick={openCreate}
              variant="primary"
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-2" />
              新增角色
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
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

      {/* Delete Confirm Dialog */}
      <Modal
        isOpen={!!deleteConfirmRole}
        onOpenChange={(open) => { if (!open) setDeleteConfirmRole(null); }}
      >
        <ModalBackdrop isDismissable />
        <ModalContainer>
          <ModalDialog>
            <ModalHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-danger" />
                确认删除角色
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-muted-foreground">
                确认删除角色 <span className="font-mono font-medium text-foreground">{deleteConfirmRole?.name}</span>？此操作不可撤销。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmRole(null)}>取消</Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (deleteConfirmRole) {
                    deleteMutation.mutate(deleteConfirmRole.id);
                    setDeleteConfirmRole(null);
                  }
                }}
              >
                确认删除
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </Modal>
    </div>
  );
}
