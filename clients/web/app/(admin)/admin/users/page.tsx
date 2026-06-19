'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  KeyRound,
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
import { useAuthStore } from '@autix/shared-store';
import { toast } from 'sonner';
import { userApi as api } from '@autix/sdk';
import { UserDrawer } from '@/components/admin-users/user-drawer';
import { RegistrationApproval } from '@/components/admin-users/registration-approval';
import {
  AdminDialogShell,
  AdminDialogHero,
  AdminDialogFooterRow,
} from '@/components/dialog-shell';

interface User {
  id: string;
  username: string;
  email: string;
  realName?: string;
  phone?: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'PENDING';
  roles?: {
    role: {
      id: string;
      name: string;
      code: string;
      system: { id: string; name: string; code: string };
    };
  }[];
  createdAt: string;
  lastLoginAt?: string;
}

interface UserListResponse {
  list: User[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

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
        <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
          {t('eyebrow')}
        </p>
        <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-[-0.04em]">
          {t('title')}
        </h1>
      </div>
      {canCreate && (
        <Button onClick={onCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('addUser')}
        </Button>
      )}
    </div>
  );
}

export default function UsersPage() {
  const t = useTranslations('users');
  const { hasPermission, user, systems, switchSystem } = useAuthStore();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const currentSystemId = user?.currentSystemId;

  const handleSwitchSystem = async (systemId: string) => {
    try {
      await api.put('/auth/switch-system', { systemId });
      switchSystem(systemId);
      queryClient.invalidateQueries({ queryKey: ['users'] });
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

  const { data, isLoading, refetch } = useQuery<UserListResponse>({
    queryKey: ['users', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (search) params.set('username', search);
      const { data: raw } = await api.get(`/users?${params}`);
      return {
        list: raw.data ?? raw.list ?? [],
        pagination: raw.pagination ?? {
          total: raw.total ?? 0,
          page: raw.page ?? 1,
          pageSize: raw.pageSize ?? 10,
          totalPages: raw.totalPages ?? 1,
        },
      };
    },
  });

  const { data: pendingCountData } = useQuery<{ count: number }>({
    queryKey: ['registrations', 'pending-count'],
    queryFn: async () => {
      const { data } = await api.get('/registrations/pending-count');
      return data;
    },
  });

  const pendingCount = pendingCountData?.count ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/users/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [resetSentIds, setResetSentIds] = useState<Set<string>>(new Set());
  const handleResetPassword = async (userItem: User) => {
    if (!userItem.email || resettingPassword || resetSentIds.has(userItem.id)) return;
    setResettingPassword(userItem.id);
    try {
      await api.post('/auth/forgot-password', { email: userItem.email });
    } catch {
      // ignore
    }
    toast.success(t('resetPasswordSent', { email: userItem.email }));
    setResetSentIds((prev) => new Set(prev).add(userItem.id));
    setResettingPassword(null);
  };

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
    const map: Record<User['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      ACTIVE: { label: t('statusActive'), variant: 'secondary' },
      DISABLED: { label: t('statusDisabled'), variant: 'outline' },
      LOCKED: { label: t('statusLocked'), variant: 'destructive' },
      PENDING: { label: t('statusPending'), variant: 'default' },
    };
    const s = map[status];
    return (
      <Badge variant={s.variant} className="uppercase tracking-[0.06em]">
        {s.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader canCreate={canCreate} onCreate={openCreate} />

      {!isSuperAdmin && systems.length > 1 && (
        <SectionShell>
          <div className="border-border flex flex-col gap-3 border-b py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Layers className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                  {t('currentSystemEyebrow')}
                </p>
                <p className="text-foreground mt-1 text-sm">
                  {t('selectSystemHint')}
                </p>
              </div>
            </div>
            <Select
              value={currentSystemId || undefined}
              onValueChange={(value) => {
                handleSwitchSystem(value);
              }}
            >
              <SelectTrigger className="w-full lg:w-60">
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
          <div className="text-muted-foreground border-border flex flex-col items-center justify-center border-y py-20">
            <Layers className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">{t('selectSystemFirst')}</p>
          </div>
        </SectionShell>
      ) : (
        <>
          <SectionShell>
            <div className="border-border border-b py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="border-border inline-flex items-center gap-6 border-b pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`pb-2 text-sm transition-colors ${activeTab === 'all'
                      ? 'text-foreground shadow-[inset_0_-1px_0_0_currentColor]'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {t('allUsers')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pending')}
                    className={`flex items-center gap-2 pb-2 text-sm transition-colors ${activeTab === 'pending'
                      ? 'text-foreground shadow-[inset_0_-1px_0_0_currentColor]'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    {t('pendingApproval')}
                    {pendingCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-[20px] rounded-full px-1.5 text-[11px]">
                        {pendingCount}
                      </Badge>
                    )}
                  </button>
                </div>

                {activeTab === 'all' && (
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <div className="border-border relative w-full border-b md:min-w-[280px]">
                      <Search className="text-muted-foreground pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                      <Input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('searchPlaceholder')}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full border-0 bg-transparent pl-6 text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSearch}>
                      {t('searchBtn')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
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
                            <TableRow key={userItem.id}>
                              <TableCell>
                                <p className="text-foreground font-medium">
                                  {userItem.username}
                                </p>
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
                                        <p className="text-muted-foreground text-[11px] leading-none">
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
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{statusChip(userItem.status)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {userItem.lastLoginAt ? new Date(userItem.lastLoginAt).toLocaleDateString('zh-CN') : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-2">
                                  {canUpdate && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEdit(userItem)}
                                    >
                                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                                      {t('edit')}
                                    </Button>
                                  )}
                                  {canUpdate && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        statusMutation.mutate({
                                          id: userItem.id,
                                          status: userItem.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                                        })
                                      }
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
                                  {canUpdate && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={resettingPassword === userItem.id || resetSentIds.has(userItem.id)}
                                      onClick={() => handleResetPassword(userItem)}
                                    >
                                      <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                                      {t('resetPassword')}
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setDeleteConfirmUser(userItem)}
                                      className="text-destructive hover:text-destructive"
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

                  {data?.pagination && data.pagination.totalPages > 1 && (
                    <div className="mt-5 flex flex-col gap-3 px-1 md:flex-row md:items-center md:justify-between">
                      <p className="text-muted-foreground text-sm">
                        {t('paginationInfo', { total: data.pagination.total, page: data.pagination.page, totalPages: data.pagination.totalPages })}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          {t('prevPage')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                          disabled={page === data.pagination.totalPages}
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
              queryClient.invalidateQueries({ queryKey: ['users'] });
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
            <p className="text-foreground text-sm leading-7">
              {t('deleteConfirmPrefix')}{' '}
              <span className="bg-secondary border-border rounded-md border px-1.5 py-0.5 font-mono text-[13px]">
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
