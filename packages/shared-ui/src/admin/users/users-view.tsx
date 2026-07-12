'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Search,
  RefreshCw,
  Clock3,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
} from '../../ui';
import {
  useAdminUsersQuery,
  useAuthStore,
  useDeleteAdminUserMutation,
  usePendingRegistrationCountQuery,
  useSendAdminPasswordResetMutation,
  useSwitchAdminSystemMutation,
  useUpdateAdminUserStatusMutation,
  type AdminUserListItem,
} from '@autix/shared-store';
import { toast } from 'sonner';
import { UserDrawer, RegistrationApproval } from './index';
import {
  AdminDialogShell,
  AdminDialogHero,
  AdminDialogFooterRow,
} from '../../shells';
import { UsersTable } from './UsersTable';

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

export function AdminUsersView() {
  const t = useTranslations('users');
  const { hasPermission, user, systems, switchSystem } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [includeDeleted, setIncludeDeleted] = useState(false);

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
    includeDeleted: isSuperAdmin && includeDeleted,
  });

  const { data: pendingCountData } = usePendingRegistrationCountQuery();
  const pendingCount = pendingCountData?.count ?? 0;
  const deleteMutation = useDeleteAdminUserMutation();
  const statusMutation = useUpdateAdminUserStatusMutation();
  const passwordResetMutation = useSendAdminPasswordResetMutation();

  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [resetSentIds, setResetSentIds] = useState<Set<string>>(new Set());
  const handleResetPassword = async (userItem: User) => {
    if (!userItem.email || resettingPassword || resetSentIds.has(userItem.id)) return;
    setResettingPassword(userItem.id);
    try {
      await passwordResetMutation.mutateAsync(userItem.email);
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

  const openEdit = (userItem: User) => {
    setEditingUser(userItem);
    setDrawerOpen(true);
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
                    className={`pb-2 text-sm transition-colors ${
                      activeTab === 'all'
                        ? 'text-foreground shadow-[inset_0_-1px_0_0_currentColor]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('allUsers')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pending')}
                    className={`flex items-center gap-2 pb-2 text-sm transition-colors ${
                      activeTab === 'pending'
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
                    {isSuperAdmin ? (
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox
                          checked={includeDeleted}
                          onCheckedChange={(checked) => {
                            setIncludeDeleted(checked === true);
                            setPage(1);
                          }}
                        />
                        {t('includeDeleted')}
                      </label>
                    ) : null}
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
                <UsersTable
                  canDelete={canDelete}
                  canUpdate={canUpdate}
                  data={data}
                  isLoading={isLoading}
                  page={page}
                  resetSentIds={resetSentIds}
                  resettingPassword={resettingPassword}
                  t={t}
                  onDelete={setDeleteConfirmUser}
                  onEdit={openEdit}
                  onNextPage={() =>
                    data?.pagination &&
                    setPage((currentPage) => Math.min(data.pagination.totalPages, currentPage + 1))
                  }
                  onPrevPage={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  onResetPassword={(userItem) => void handleResetPassword(userItem)}
                  onToggleStatus={(userItem) =>
                    statusMutation.mutate({
                      id: userItem.id,
                      status: userItem.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                    })
                  }
                />
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
