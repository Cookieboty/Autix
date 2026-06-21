import { Ban, CheckCircle, Edit, KeyRound, Trash } from 'lucide-react';
import type { AdminUserListItem } from '@autix/shared-store';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui';
import { groupUserRolesBySystem } from './users-view-helpers';

type User = AdminUserListItem;
type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

interface UsersPagination {
  total: number;
  page: number;
  totalPages: number;
}

export function UsersTable({
  canDelete,
  canUpdate,
  data,
  isLoading,
  page,
  resetSentIds,
  resettingPassword,
  t,
  onDelete,
  onEdit,
  onNextPage,
  onPrevPage,
  onResetPassword,
  onToggleStatus,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  data?: { list?: User[]; pagination?: UsersPagination };
  isLoading: boolean;
  page: number;
  resetSentIds: Set<string>;
  resettingPassword: string | null;
  t: Translate;
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onResetPassword: (user: User) => void;
  onToggleStatus: (user: User) => void;
}) {
  return (
    <>
      <div>
        <Table aria-label={t('userListLabel')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('username')}</TableHead>
              <TableHead>{t('realName')}</TableHead>
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('systemRoles')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('lastLogin')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : !data?.list?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              data.list.map((userItem) => (
                <UserRow
                  key={userItem.id}
                  canDelete={canDelete}
                  canUpdate={canUpdate}
                  resetSentIds={resetSentIds}
                  resettingPassword={resettingPassword}
                  t={t}
                  user={userItem}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onResetPassword={onResetPassword}
                  onToggleStatus={onToggleStatus}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="mt-5 flex flex-col gap-3 px-1 md:flex-row md:items-center md:justify-between">
          <p className="text-muted-foreground text-sm">
            {t('paginationInfo', {
              total: data.pagination.total,
              page: data.pagination.page,
              totalPages: data.pagination.totalPages,
            })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onPrevPage} disabled={page === 1}>
              {t('prevPage')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextPage}
              disabled={page === data.pagination.totalPages}
            >
              {t('nextPage')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function UserRow({
  canDelete,
  canUpdate,
  resetSentIds,
  resettingPassword,
  t,
  user,
  onDelete,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  resetSentIds: Set<string>;
  resettingPassword: string | null;
  t: Translate;
  user: User;
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
  onResetPassword: (user: User) => void;
  onToggleStatus: (user: User) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <p className="text-foreground font-medium">{user.username}</p>
      </TableCell>
      <TableCell>{user.realName || '-'}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        <UserRoleGroups user={user} />
      </TableCell>
      <TableCell>
        <UserStatusBadge status={user.status} t={t} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN') : '-'}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => onEdit(user)}>
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              {t('edit')}
            </Button>
          )}
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => onToggleStatus(user)}>
              {user.status === 'ACTIVE' ? (
                <>
                  <Ban className="mr-1.5 h-3.5 w-3.5" />
                  {t('disable')}
                </>
              ) : (
                <>
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  {t('enable')}
                </>
              )}
            </Button>
          )}
          {canUpdate && (
            <Button
              variant="outline"
              size="sm"
              disabled={resettingPassword === user.id || resetSentIds.has(user.id)}
              onClick={() => onResetPassword(user)}
            >
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              {t('resetPassword')}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(user)}
              className="text-destructive hover:text-destructive"
            >
              <Trash className="mr-1.5 h-3.5 w-3.5" />
              {t('delete')}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function UserStatusBadge({ status, t }: { status: User['status']; t: Translate }) {
  const map: Record<
    User['status'],
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    ACTIVE: { label: t('statusActive'), variant: 'secondary' },
    DISABLED: { label: t('statusDisabled'), variant: 'outline' },
    LOCKED: { label: t('statusLocked'), variant: 'destructive' },
    PENDING: { label: t('statusPending'), variant: 'default' },
  };
  const current = map[status];
  return (
    <Badge variant={current.variant} className="uppercase tracking-[0.06em]">
      {current.label}
    </Badge>
  );
}

function UserRoleGroups({ user }: { user: User }) {
  const groups = groupUserRolesBySystem(user);
  if (groups.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-1.5">
      {groups.map(({ system, roles }) => (
        <div key={system.id}>
          <p className="text-muted-foreground text-[11px] leading-none">{system.name}</p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {roles.map((role) => (
              <Badge key={role.id} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                {role.name}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
