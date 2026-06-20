import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash,
  Ban,
  CheckCircle,
  Clock3,
  Layers,
  AlertTriangle,
  Users,
} from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@autix/shared-ui/ui';
import {
  useAdminUsersQuery,
  useAuthStore,
  useDeleteAdminUserMutation,
  usePendingRegistrationCountQuery,
  useSwitchAdminSystemMutation,
  useUpdateAdminUserStatusMutation,
  type AdminUserListItem,
} from '@autix/shared-store';
import { UserDrawer, RegistrationApproval } from '@autix/shared-ui/admin';
import {
  AdminDialogShell,
  AdminDialogHero,
  AdminDialogFooterRow,
} from '@autix/shared-ui/shells';

type User = AdminUserListItem;

function SectionShell({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>;
}

function PageHeader({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  const t = useTranslations('users');
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--foreground)' }}>
          {t('title')}
        </h1>
      </div>
      {canCreate && (
        <Button
          onClick={onCreate}
          className="h-9 rounded-md px-3"
          style={{ backgroundColor: 'var(--foreground)', color: 'var(--panel)' }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('addUser')}
        </Button>
      )}
    </div>
  );
}

export function AdminUsersPage() {
  const t = useTranslations('users');
  const { hasPermission, user, systems, switchSystem } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const currentSystemId = user?.currentSystemId;
  const switchSystemMutation = useSwitchAdminSystemMutation();

  const handleSwitchSystem = async (systemId: string) => {
    try {
      await switchSystemMutation.mutateAsync(systemId);
      switchSystem(systemId);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isSuperAdmin && !currentSystemId && systems.length === 1) {
      handleSwitchSystem(systems[0].id);
    }
  }, [isSuperAdmin, currentSystemId, systems]);

  const canCreate = hasPermission('user:create');
  const canUpdate = hasPermission('user:update');
  const canDelete = hasPermission('user:delete');

  const { data, isLoading, refetch } = useAdminUsersQuery({
    page,
    pageSize: 10,
    username: search,
  });

  const { data: pendingCountData } = usePendingRegistrationCountQuery();
  const pendingCount = pendingCountData?.count ?? 0;
  const deleteMutation = useDeleteAdminUserMutation();
  const statusMutation = useUpdateAdminUserStatusMutation();

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const openCreate = () => {
    setEditingUser(null);
    setDrawerOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setDrawerOpen(true);
  };

  const statusChip = (status: User['status']) => {
    const map = {
      ACTIVE: { label: t('statusActive'), color: 'var(--success)', borderColor: 'var(--success)' },
      DISABLED: { label: t('statusDisabled'), color: 'var(--muted)', borderColor: 'var(--border)' },
      LOCKED: { label: t('statusLocked'), color: 'var(--danger)', borderColor: 'var(--danger)' },
      PENDING: { label: t('statusPending'), color: 'var(--warning)', borderColor: 'var(--warning)' },
    };
    const s = map[status];
    return (
      <span
        className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em]"
        style={{ color: s.color, backgroundColor: 'var(--panel)', border: `1px solid ${s.borderColor}` }}
      >
        {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader canCreate={canCreate} onCreate={openCreate} />

      {!isSuperAdmin && systems.length > 1 && (
        <SectionShell>
          <div className="flex flex-col gap-3 border-b py-5 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <Layers className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
                  {t('currentSystemEyebrow')}
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--foreground)' }}>
                  {t('selectSystemHint')}
                </p>
              </div>
            </div>
            <Select
              value={currentSystemId || undefined}
              onValueChange={(key) => {
                if (key) handleSwitchSystem(key as string);
              }}
            >
              <SelectTrigger
                className="h-11 rounded-none border-0 px-0 w-full lg:w-60"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--foreground)',
                  boxShadow: 'inset 0 -1px 0 0 var(--border)',
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                
                  {systems.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                
              </SelectContent>
            </Select>
          </div>
        </SectionShell>
      )}

      {!isSuperAdmin && systems.length > 1 && !currentSystemId ? (
        <SectionShell>
          <div className="flex flex-col items-center justify-center border-y py-20" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
            <Layers className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">{t('selectSystemFirst')}</p>
          </div>
        </SectionShell>
      ) : (
        <>
          <SectionShell>
            <div className="border-b py-5" style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex items-center gap-6 border-b pb-1" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className="pb-2 text-sm transition-colors"
                    style={{
                      color: activeTab === 'all' ? 'var(--foreground)' : 'var(--muted)',
                      boxShadow: activeTab === 'all' ? 'inset 0 -1px 0 0 var(--foreground)' : 'none',
                    }}
                  >
                    {t('allUsers')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pending')}
                    className="flex items-center gap-2 pb-2 text-sm transition-colors"
                    style={{
                      color: activeTab === 'pending' ? 'var(--foreground)' : 'var(--muted)',
                      boxShadow: activeTab === 'pending' ? 'inset 0 -1px 0 0 var(--foreground)' : 'none',
                    }}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    {t('pendingApproval')}
                    {pendingCount > 0 && (
                      <span
                        className="inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px]"
                        style={{ backgroundColor: 'var(--danger)', color: 'var(--danger-foreground)' }}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </button>
                </div>

                {activeTab === 'all' && (
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <div className="relative w-full border-b md:min-w-[280px]" style={{ borderColor: 'var(--border)' }}>
                      <Search
                        className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                        style={{ color: 'var(--muted)' }}
                      />
                      <Input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('searchPlaceholder')}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full border-0 bg-transparent pl-6 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      onClick={handleSearch}
                      className="h-9 rounded-md px-3"
                      style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      {t('searchBtn')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => refetch()}
                      className="h-9 rounded-md px-3"
                      style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="py-6">
              {activeTab === 'all' ? (
                <>
                  <div>
                    <Table>
                      
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
                              <TableCell colSpan={7} className="py-10 text-center" style={{ color: 'var(--muted)' }}>
                                {t('loading')}
                              </TableCell>
                            </TableRow>
                          ) : data?.list.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-10 text-center" style={{ color: 'var(--muted)' }}>
                                {t('noData')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            data?.list.map((userItem) => (
                              <TableRow key={userItem.id} className="transition-colors hover:bg-transparent">
                                <TableCell>
                                  <div>
                                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                                      {userItem.username}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>{userItem.realName || '-'}</TableCell>
                                <TableCell>{userItem.email}</TableCell>
                                <TableCell>
                                  {userItem.roles && userItem.roles.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {Object.values(
                                        userItem.roles.reduce<Record<string, { system: { id: string; name: string }; roles: { id: string; name: string }[] }>>((acc, ur) => {
                                          const sysId = ur.role.system.id;
                                          if (!acc[sysId]) acc[sysId] = { system: ur.role.system, roles: [] };
                                          acc[sysId].roles.push(ur.role);
                                          return acc;
                                        }, {}),
                                      ).map(({ system: sys, roles: sysRoles }) => (
                                        <div key={sys.id}>
                                          <p className="text-[11px] leading-none" style={{ color: 'var(--muted)' }}>
                                            {sys.name}
                                          </p>
                                          <div className="mt-0.5 flex flex-wrap gap-1">
                                            {sysRoles.map((r) => (
                                              <Badge key={r.id} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                                                {r.name}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--muted)' }}>-</span>
                                  )}
                                </TableCell>
                                <TableCell>{statusChip(userItem.status)}</TableCell>
                                <TableCell style={{ color: 'var(--muted)' }}>
                                  {userItem.lastLoginAt ? new Date(userItem.lastLoginAt).toLocaleDateString('zh-CN') : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-end gap-2">
                                    {canUpdate && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEdit(userItem)}
                                        className="h-8 rounded-md px-2.5"
                                        style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                                      >
                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                        {t('edit')}
                                      </Button>
                                    )}
                                    {canUpdate && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          statusMutation.mutate({
                                            id: userItem.id,
                                            status: userItem.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                                          })
                                        }
                                        className="h-8 rounded-md px-2.5"
                                        style={{
                                          backgroundColor: 'var(--panel-muted)',
                                          color: userItem.status === 'ACTIVE' ? 'var(--warning)' : 'var(--success)',
                                          border: '1px solid var(--border)',
                                        }}
                                      >
                                        {userItem.status === 'ACTIVE' ? (
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
                                    {canDelete && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeleteConfirmUser(userItem)}
                                        className="h-8 rounded-md px-2.5"
                                        style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--danger)', border: '1px solid var(--border)' }}
                                      >
                                        <Trash className="mr-1.5 h-3.5 w-3.5" />
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

                  {data && data.pagination.totalPages > 1 && (
                    <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-1">
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>
                        {t('paginationInfo', { total: data.pagination.total, page: data.pagination.page, totalPages: data.pagination.totalPages })}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="h-8 rounded-md px-3"
                          style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                        >
                          {t('prevPage')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                          disabled={page === data.pagination.totalPages}
                          className="h-8 rounded-md px-3"
                          style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                        >
                          {t('nextPage')}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <RegistrationApproval />
              )}
            </div>
          </SectionShell>

          <UserDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            user={editingUser}
            onSuccess={() => {
              setDrawerOpen(false);
            }}
          />

          <AdminDialogShell
            open={!!deleteConfirmUser}
            onOpenChange={(open) => {
              if (!open) setDeleteConfirmUser(null);
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
                      onClick={() => setDeleteConfirmUser(null)}
                      className="min-w-[80px] cursor-pointer text-sm"
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (deleteConfirmUser) {
                          deleteMutation.mutate(deleteConfirmUser.id);
                          setDeleteConfirmUser(null);
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
            <p className="text-sm leading-7" style={{ color: 'var(--foreground)' }}>
              {t('deleteConfirmPrefix')}{' '}
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[13px]"
                style={{
                  backgroundColor: 'var(--panel-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {deleteConfirmUser?.username}
              </span>
              {t('deleteConfirmSuffix')}
            </p>
          </AdminDialogShell>
        </>
      )}
    </div>
  );
}
