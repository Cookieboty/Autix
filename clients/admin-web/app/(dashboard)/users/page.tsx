'use client';

import { useEffect, useState } from 'react';
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
  Users,
} from 'lucide-react';
import { Button, Input, Chip } from '@heroui/react';
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopover,
  ListBox,
  ListBoxItem,
} from '@heroui/react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { UserDrawer } from '@/components/users/user-drawer';
import { RegistrationApproval } from '@/components/users/registration-approval';
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
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          User administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--foreground)' }}>
          用户管理
        </h1>
      </div>
      {canCreate && (
        <Button
          onClick={onCreate}
          className="h-9 rounded-md px-3"
          style={{ backgroundColor: 'var(--foreground)', color: 'var(--panel)' }}
        >
          <Plus className="mr-2 h-4 w-4" />
          新增用户
        </Button>
      )}
    </div>
  );
}

export default function UsersPage() {
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
      const { data } = await api.get(`/users?${params}`);
      return data;
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
      ACTIVE: { label: '正常', color: 'var(--success)', borderColor: 'var(--success)' },
      DISABLED: { label: '禁用', color: 'var(--muted)', borderColor: 'var(--border)' },
      LOCKED: { label: '锁定', color: 'var(--danger)', borderColor: 'var(--danger)' },
      PENDING: { label: '待审批', color: 'var(--warning)', borderColor: 'var(--warning)' },
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
                  Current system
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--foreground)' }}>
                  选择当前要管理的数据域。
                </p>
              </div>
            </div>
            <Select
              selectedKey={currentSystemId || null}
              onSelectionChange={(key) => {
                if (key) handleSwitchSystem(key as string);
              }}
              className="w-full lg:w-60"
            >
              <SelectTrigger
                className="h-11 rounded-none border-0 px-0"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--foreground)',
                  boxShadow: 'inset 0 -1px 0 0 var(--border)',
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectPopover>
                <ListBox>
                  {systems.map((s) => (
                    <ListBoxItem key={s.id} id={s.id}>
                      {s.name}
                    </ListBoxItem>
                  ))}
                </ListBox>
              </SelectPopover>
            </Select>
          </div>
        </SectionShell>
      )}

      {!isSuperAdmin && systems.length > 1 && !currentSystemId ? (
        <SectionShell>
          <div className="flex flex-col items-center justify-center border-y py-20" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
            <Layers className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">请先选择要管理的系统</p>
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
                    全部用户
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
                    待审批
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
                        placeholder="搜索用户名..."
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
                      搜索
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
                      <TableContent aria-label="用户列表">
                        <TableHeader>
                          <TableColumn isRowHeader>用户名</TableColumn>
                          <TableColumn>姓名</TableColumn>
                          <TableColumn>邮箱</TableColumn>
                          <TableColumn>所属系统</TableColumn>
                          <TableColumn>状态</TableColumn>
                          <TableColumn>最后登录</TableColumn>
                          <TableColumn className="text-right">操作</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-10 text-center" style={{ color: 'var(--muted)' }}>
                                加载中...
                              </TableCell>
                            </TableRow>
                          ) : data?.list.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-10 text-center" style={{ color: 'var(--muted)' }}>
                                暂无数据
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
                                    <div className="flex flex-wrap gap-1.5">
                                      {[...new Map(userItem.roles.map((ur) => [ur.role.system.id, ur.role.system])).values()].map((sys) => (
                                        <span
                                          key={sys.id}
                                          className="inline-flex items-center text-[11px]"
                                          style={{ color: 'var(--muted)' }}
                                        >
                                          {sys.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    '-'
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
                                        编辑
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
                                            禁用
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                            启用
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

                  {data && data.pagination.totalPages > 1 && (
                    <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-1">
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>
                        共 {data.pagination.total} 条，第 {data.pagination.page}/{data.pagination.totalPages} 页
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          isDisabled={page === 1}
                          className="h-8 rounded-md px-3"
                          style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                        >
                          上一页
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                          isDisabled={page === data.pagination.totalPages}
                          className="h-8 rounded-md px-3"
                          style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                        >
                          下一页
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
                title="确认删除用户"
                description="删除后用户登录态与角色关系将立即失效。"
              />
            }
            footer={
              <AdminDialogFooterRow
                aside="此操作不可撤销"
                actions={
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteConfirmUser(null)}
                      className="min-w-[80px] cursor-pointer text-sm"
                    >
                      取消
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (deleteConfirmUser) {
                          deleteMutation.mutate(deleteConfirmUser.id);
                          setDeleteConfirmUser(null);
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
              确认删除用户{' '}
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[13px]"
                style={{
                  backgroundColor: 'var(--panel-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {deleteConfirmUser?.username}
              </span>
              ？
            </p>
          </AdminDialogShell>
        </>
      )}
    </div>
  );
}
