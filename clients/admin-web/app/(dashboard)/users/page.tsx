'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw, Edit, Trash, Ban, CheckCircle, Clock, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  data: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

  const statusBadge = (status: User['status']) => {
    const map = {
      ACTIVE: { label: '正常', className: 'bg-green-100 text-green-700' },
      DISABLED: { label: '禁用', className: 'bg-gray-100 text-gray-600' },
      LOCKED: { label: '锁定', className: 'bg-red-100 text-red-600' },
      PENDING: { label: '待审批', className: 'bg-yellow-100 text-yellow-700' },
    };
    const s = map[status];
    return <Badge className={s.className + ' border-0'}>{s.label}</Badge>;
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
            className="cursor-pointer bg-primary text-primary-foreground"
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
          <Select value={currentSystemId || ''} onValueChange={handleSwitchSystem}>
            <SelectTrigger className="w-48 h-8 bg-background">
              <SelectValue placeholder="请选择系统" />
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
            <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-xs flex items-center justify-center px-1">
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
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>所属系统</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最后登录</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium font-mono">{user.username}</TableCell>
                  <TableCell>{user.realName || '-'}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.roles && user.roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {[...new Map(user.roles.map((ur) => [ur.role.system.id, ur.role.system])).values()].map((sys) => (
                          <span key={sys.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">
                            {sys.name}
                          </span>
                        ))}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{statusBadge(user.status)}</TableCell>
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
                          className="h-8 px-2 cursor-pointer hover:bg-blue-50 hover:text-blue-600"
                          title="编辑"
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
                              ? 'hover:bg-orange-50 hover:text-orange-600'
                              : 'hover:bg-green-50 hover:text-green-600'
                          }`}
                          title={user.status === 'ACTIVE' ? '禁用' : '启用'}
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
                          onClick={() => {
                            if (confirm(`确认删除用户 ${user.username}？`)) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          className="h-8 px-2 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
                          title="删除"
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
        </Table>
      </div>

      {/* 分页 */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            共 {data.total} 条，第 {data.page}/{data.totalPages} 页
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="cursor-pointer"
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
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
        </>
      )}
    </div>
  );
}
