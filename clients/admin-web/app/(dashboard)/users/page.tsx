'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw, Edit, Trash, Ban, CheckCircle, Clock, Layers, AlertTriangle } from 'lucide-react';
import { Button, Input } from '@heroui/react';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableColumn,
  TableContent,
} from '@heroui/react';
import { Select, SelectTrigger, SelectValue, SelectPopover, ListBox, ListBoxItem } from '@heroui/react';
import {
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { Chip } from '@heroui/react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { UserDrawer } from '@/components/users/user-drawer';
import { RegistrationApproval } from '@/components/users/registration-approval';

interface User {
  id: string;
  username: string;
  email: string;
  realName?: string;
  phone?: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'PENDING';
  roles?: { role: { id: string; name: string; code: string; system: { id: string; name: string; code: string } } }[];
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

  // Auto-select the only system for non-super-admins
  useEffect(() => {
    if (!isSuperAdmin && !currentSystemId && systems.length === 1) {
      handleSwitchSystem(systems[0].id);
    }
  }, [isSuperAdmin, currentSystemId, systems]);

  const handleSwitchSystem = async (systemId: string) => {
    try {
      await api.put('/auth/switch-system', { systemId });
      switchSystem(systemId);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch {
      // ignore
    }
  };

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
      ACTIVE: { label: '正常', color: 'success' as const },
      DISABLED: { label: '禁用', color: 'default' as const },
      LOCKED: { label: '锁定', color: 'danger' as const },
      PENDING: { label: '待审批', color: 'warning' as const },
    };
    const s = map[status];
    return <Chip color={s.color} variant="soft" size="sm">{s.label}</Chip>;
  };

  return (
    <div>
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-mono text-primary">
          用户管理
        </h1>
        {canCreate && (
          <Button
            onClick={openCreate}
            variant="primary"
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            新增用户
          </Button>
        )}
      </div>

      {/* System picker for non-super-admins with multiple systems */}
      {!isSuperAdmin && systems.length > 1 && (
        <div className="flex items-center gap-3 mb-5 p-3 rounded-lg border bg-muted/40">
          <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">当前系统：</span>
          <Select
            selectedKey={currentSystemId || null}
            onSelectionChange={(key) => {
              if (key) handleSwitchSystem(key as string);
            }}
            className="w-48"
          >
            <SelectTrigger>
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
      )}

      {/* Non-super-admin with no system selected yet */}
      {!isSuperAdmin && systems.length > 1 && !currentSystemId ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Layers className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">请先选择要管理的系统</p>
        </div>
      ) : (
        <>
      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium cursor-pointer border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          全部用户
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'pending'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          待审批
          {pendingCount > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-danger text-danger-foreground text-xs flex items-center justify-center px-1">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'all' ? (
        <>
      {/* 搜索栏 */}
      <div className="flex gap-2 mb-4">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索用户名..."
          className="max-w-xs"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="outline" onClick={handleSearch} className="cursor-pointer">
          <Search className="h-4 w-4 mr-2" />
          搜索
        </Button>
        <Button variant="ghost" onClick={() => refetch()} className="cursor-pointer">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* 表格 */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableContent>
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : data?.list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                data?.list.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium font-mono">{user.username}</TableCell>
                    <TableCell>{user.realName || '-'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                          {user.roles && user.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {[...new Map(user.roles.map((ur) => [ur.role.system.id, ur.role.system])).values()].map((sys) => (
                            <span key={sys.id} className="text-xs bg-accent/10 text-accent border border-accent/20 rounded px-1.5 py-0.5">
                              {sys.name}
                            </span>
                          ))}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{statusChip(user.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(user)}
                            className="h-8 px-2 cursor-pointer hover:bg-accent/10 hover:text-accent"
                            aria-label="编辑"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            编辑
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              statusMutation.mutate({
                                id: user.id,
                                status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                              })
                            }
                            className={`h-8 px-2 cursor-pointer ${
                              user.status === 'ACTIVE'
                                ? 'hover:bg-warning/10 hover:text-warning'
                                : 'hover:bg-success/10 hover:text-success'
                            }`}
                            aria-label={user.status === 'ACTIVE' ? '禁用' : '启用'}
                          >
                            {user.status === 'ACTIVE' ? (
                              <>
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                禁用
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                启用
                              </>
                            )}
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmUser(user)}
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

      {/* 分页 */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            共 {data.pagination.total} 条，第 {data.pagination.page}/{data.pagination.totalPages} 页
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              isDisabled={page === 1}
              className="cursor-pointer"
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              isDisabled={page === data.pagination.totalPages}
              className="cursor-pointer"
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

      {/* Drawer */}
      <UserDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        user={editingUser}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          setDrawerOpen(false);
        }}
      />

      {/* Delete Confirm Dialog */}
      <Modal
        isOpen={!!deleteConfirmUser}
        onOpenChange={(open) => { if (!open) setDeleteConfirmUser(null); }}
      >
        <ModalBackdrop isDismissable />
        <ModalContainer>
          <ModalDialog>
            <ModalHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-danger" />
                确认删除用户
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-muted-foreground">
                确认删除用户 <span className="font-mono font-medium text-foreground">{deleteConfirmUser?.username}</span>？此操作不可撤销。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmUser(null)}>取消</Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (deleteConfirmUser) {
                    deleteMutation.mutate(deleteConfirmUser.id);
                    setDeleteConfirmUser(null);
                  }
                }}
              >
                确认删除
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </Modal>
        </>
      )}
    </div>
  );
}
