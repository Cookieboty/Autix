'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Edit, Trash, Shield, AlertTriangle } from 'lucide-react';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@autix/shared-ui/ui';
import { useAuthStore } from '@autix/shared-store';
import { userApi as api } from '@autix/sdk';
import { RoleDrawer } from '@/components/admin-roles/role-drawer';
import { PermissionDrawer } from '@/components/admin-roles/permission-drawer';
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
  const t = useTranslations('roles');
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
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
            {t('eyebrow')}
          </p>
          <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-[-0.04em]">
            {t('title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            aria-label={t('refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCreate && (
            <Button onClick={openCreate} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t('addRole')}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden">
        <Table aria-label={t('roleListLabel')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('roleName')}</TableHead>
              <TableHead>{t('roleCode')}</TableHead>
              <TableHead>{t('description')}</TableHead>
              <TableHead>{t('linkedUsers')}</TableHead>
              <TableHead>{t('permissionCount')}</TableHead>
              <TableHead>{t('createdAt')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('noData')}
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
                            aria-label={t('edit')}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            {t('edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPermissions(role)}
                            className="h-8 px-2 cursor-pointer hover:bg-accent/10 hover:text-accent"
                            aria-label={t('assignPermissions')}
                          >
                            <Shield className="h-3.5 w-3.5 mr-1" />
                            {t('permissions')}
                          </Button>
                        </>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmRole(role)}
                          className="h-8 px-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={t('delete')}
                        >
                          <Trash className="h-3.5 w-3.5 mr-1" />
                          {t('delete')}
                        </Button>
                      )}
                    </div>
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
            title={t('deleteTitle')}
            description={t('deleteDesc')}
          />
        }
        footer={
          <AdminDialogFooterRow
            aside={t('irreversible')}
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmRole(null)}
                  className="min-w-[80px] cursor-pointer text-sm"
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (deleteConfirmRole) {
                      deleteMutation.mutate(deleteConfirmRole.id);
                      setDeleteConfirmRole(null);
                    }
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
          {t('deleteConfirmPrefix')}{' '}
          <span className="bg-secondary border-border rounded-md border px-1.5 py-0.5 font-mono text-[13px]">
            {deleteConfirmRole?.name}
          </span>
          {t('deleteConfirmSuffix')}
        </p>
      </AdminDialogShell>
    </div>
  );
}
