'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Edit,
  Plus,
  RefreshCw,
  Shield,
  Trash,
} from 'lucide-react';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui';
import {
  AdminDialogFooterRow,
  AdminDialogHero,
  AdminDialogShell,
} from '../../shells';
import {
  useAdminRolesQuery,
  useAuthStore,
  useDeleteAdminRoleMutation,
  type AdminRoleListItem,
} from '@autix/shared-store';
import { PermissionDrawer } from './permission-drawer';
import { RoleDrawer } from './role-drawer';
import { AdminPaginationFooter, useClientPagination } from '../layout';

type Role = AdminRoleListItem;

export function AdminRolesView() {
  const t = useTranslations('roles');
  const { hasPermission } = useAuthStore();
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [permDrawerOpen, setPermDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [permRole, setPermRole] = useState<Role | null>(null);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<Role | null>(null);

  const canCreate = hasPermission('role:create');
  const canUpdate = hasPermission('role:update');
  const canDelete = hasPermission('role:delete');

  const { data: roles = [], isLoading, refetch } = useAdminRolesQuery();
  const {
    items: pagedRoles,
    page,
    setPage,
    pageSize,
    total,
  } = useClientPagination(roles, 20);
  const deleteMutation = useDeleteAdminRoleMutation();

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
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center"
                >
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center"
                >
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              pagedRoles.map((role) => (
                <TableRow key={role.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {role.code}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {role.description || '-'}
                  </TableCell>
                  <TableCell>{role._count.users}</TableCell>
                  <TableCell>{role._count.permissions}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
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
                            className="hover:text-accent h-8 cursor-pointer px-2 hover:bg-accent/10"
                            aria-label={t('edit')}
                          >
                            <Edit className="mr-1 h-3.5 w-3.5" />
                            {t('edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPermissions(role)}
                            className="hover:text-accent h-8 cursor-pointer px-2 hover:bg-accent/10"
                            aria-label={t('assignPermissions')}
                          >
                            <Shield className="mr-1 h-3.5 w-3.5" />
                            {t('permissions')}
                          </Button>
                        </>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmRole(role)}
                          className="text-destructive hover:text-destructive h-8 cursor-pointer px-2 hover:bg-destructive/10"
                          aria-label={t('delete')}
                        >
                          <Trash className="mr-1 h-3.5 w-3.5" />
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

      <AdminPaginationFooter page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <RoleDrawer
        open={roleDrawerOpen}
        onOpenChange={setRoleDrawerOpen}
        role={editingRole}
        onSuccess={() => {
          setRoleDrawerOpen(false);
        }}
      />

      {permRole && (
        <PermissionDrawer
          open={permDrawerOpen}
          onOpenChange={setPermDrawerOpen}
          role={permRole}
          onSuccess={() => {
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
