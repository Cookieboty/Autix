'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@heroui/react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopover,
  ListBox,
  ListBoxItem,
} from '@heroui/react';
import { Users, Layers, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  AdminDrawerBody,
  AdminDrawerError,
  AdminDrawerFooter,
  AdminDrawerHero,
  AdminDrawerMeta,
  AdminDrawerSection,
  AdminDrawerShell,
  AdminField,
  AdminFieldGroup,
  adminInputClassName,
  adminInputStyle,
} from '@/components/drawer-shell';

interface User {
  id: string;
  username: string;
  email: string;
  realName?: string;
  phone?: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'PENDING';
}

interface System {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface Role {
  id: string;
  name: string;
  code: string;
}

interface SystemRoleGroup {
  systemId: string;
  systemName: string;
  systemCode: string;
  roles: Role[];
}

interface UserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess: () => void;
}

interface UserForm {
  username: string;
  email: string;
  password?: string;
  realName?: string;
  phone?: string;
  status?: string;
  systemId?: string;
  roleCode?: string;
}

const selectTriggerClassName = adminInputClassName;

export function UserDrawer({ open, onOpenChange, user, onSuccess }: UserDrawerProps) {
  const isEdit = !!user;
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin) ?? false;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systems, setSystems] = useState<System[]>([]);

  const [userSystemRoles, setUserSystemRoles] = useState<SystemRoleGroup[]>([]);
  const [allRolesBySystem, setAllRolesBySystem] = useState<Record<string, Role[]>>({});
  const [rolesPanelOpen, setRolesPanelOpen] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [rolesLoading, setRolesLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserForm>();

  const status = watch('status');
  const systemId = watch('systemId');
  const roleCode = watch('roleCode');
  const assignedSystemCount = userSystemRoles.length;
  const assignedRoleCount = userSystemRoles.reduce((count, group) => count + group.roles.length, 0);

  useEffect(() => {
    if (open) {
      if (user) {
        reset({
          username: user.username,
          email: user.email,
          realName: user.realName || '',
          phone: user.phone || '',
          status: user.status,
        });
      } else {
        reset({
          username: '',
          email: '',
          password: '',
          realName: '',
          phone: '',
          status: 'ACTIVE',
          systemId: '',
          roleCode: 'USER',
        });
      }
      setError('');
      setRolesPanelOpen(false);
      setSelectedSystemId('');
      setSelectedRoleId('');
      if (isEdit) {
        if (isSuperAdmin) {
          loadUserSystemRoles();
          loadSystems();
        }
      }
      if (!isEdit && isSuperAdmin) {
        loadSystems();
      }
    }
  }, [open, user, reset, isEdit, isSuperAdmin]);

  const loadSystems = async () => {
    try {
      const { data } = await api.get('/systems');
      setSystems(data);
    } catch (err) {
      console.error('Failed to load systems:', err);
    }
  };

  const loadUserSystemRoles = async () => {
    if (!user) return;
    setRolesLoading(true);
    try {
      const { data } = await api.get(`/users/${user.id}/roles`);
      setUserSystemRoles(data);
    } catch (err) {
      console.error('Failed to load user roles:', err);
    } finally {
      setRolesLoading(false);
    }
  };

  const loadRolesForSystem = async (sysId: string) => {
    if (allRolesBySystem[sysId]) return;
    try {
      const { data } = await api.get(`/roles?systemId=${sysId}`);
      const roles: Role[] = data.list || data || [];
      setAllRolesBySystem((prev) => ({ ...prev, [sysId]: roles }));
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  };

  const handleAddRole = async () => {
    if (!user || !selectedSystemId || !selectedRoleId) return;
    try {
      const existing = userSystemRoles.map((group) => ({
        systemId: group.systemId,
        roleIds: group.roles.map((roleItem) => roleItem.id),
      }));
      const targetGroup = existing.find((group) => group.systemId === selectedSystemId);
      if (targetGroup) {
        if (!targetGroup.roleIds.includes(selectedRoleId)) {
          targetGroup.roleIds.push(selectedRoleId);
        }
      } else {
        existing.push({ systemId: selectedSystemId, roleIds: [selectedRoleId] });
      }
      await api.put(`/users/${user.id}/roles`, { systemRoles: existing });
      await loadUserSystemRoles();
      setSelectedRoleId('');
    } catch (err: any) {
      setError(err.response?.data?.message || '角色添加失败');
    }
  };

  const handleRemoveRole = async (sysId: string, roleId: string) => {
    if (!user) return;
    try {
      const existing = userSystemRoles.map((group) => ({
        systemId: group.systemId,
        roleIds: group.roles.map((roleItem) => roleItem.id).filter((id) => !(group.systemId === sysId && id === roleId)),
      })).filter((group) => group.roleIds.length > 0);
      await api.put(`/users/${user.id}/roles`, { systemRoles: existing });
      await loadUserSystemRoles();
    } catch (err: any) {
      setError(err.response?.data?.message || '角色移除失败');
    }
  };

  const onSubmit = async (data: UserForm) => {
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        const { password, systemId: _s, roleCode: _r, ...updateData } = data;
        await api.patch(`/users/${user!.id}`, updateData);
      } else if (isSuperAdmin) {
        const { username, email, password, systemId: targetSystemId, roleCode: targetRoleCode } = data;
        await api.post('/users', { username, email, password, systemId: targetSystemId, roleCode: targetRoleCode });
      } else {
        const { username, email, password } = data;
        await api.post('/users', { username, email, password });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      width={isEdit ? 'md' : 'sm'}
      header={
        <AdminDrawerHero
          icon={<Users className="h-5 w-5" />}
          eyebrow={isEdit ? '编辑用户' : '新建用户'}
          title={isEdit ? user!.username : '创建新用户'}
          description={isEdit ? '修改账户信息、状态与角色分配。' : '创建一个新的系统用户账户。'}
          meta={
            isEdit ? (
              <AdminDrawerMeta tone={status === 'ACTIVE' ? 'success' : status === 'LOCKED' ? 'danger' : 'default'}>
                {status === 'ACTIVE' ? '正常' : status === 'LOCKED' ? '已锁定' : status === 'DISABLED' ? '已禁用' : '待激活'}
              </AdminDrawerMeta>
            ) : (
              <AdminDrawerMeta tone="default">新建模式</AdminDrawerMeta>
            )
          }
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? '保存后会立即更新用户资料与账户状态。' : '创建完成后，用户即可按分配角色进入系统。'}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-w-[88px] cursor-pointer text-sm font-medium"
              >
                取消
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit(onSubmit)}
                {...({ isLoading: loading } as any)}
                className="min-w-[120px] cursor-pointer text-sm font-medium shadow-sm"
              >
                {loading ? '保存中...' : isEdit ? '保存修改' : '创建用户'}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        {error && <AdminDrawerError>{error}</AdminDrawerError>}

        {!isEdit && isSuperAdmin && (
          <AdminDrawerSection title="归属关系" description="为新用户指定初始系统与角色。">
            <AdminFieldGroup columns={2}>
              <AdminField label="所属系统" required>
                <Select
                  selectedKey={systemId || null}
                  onSelectionChange={(key) => setValue('systemId', key as string)}
                >
                  <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {systems.map((sys) => (
                        <ListBoxItem key={sys.id} id={sys.id}>
                          {sys.name}
                        </ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
              </AdminField>

              <AdminField label="角色" required>
                <Select
                  selectedKey={roleCode || 'USER'}
                  onSelectionChange={(key) => setValue('roleCode', key as string)}
                >
                  <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      <ListBoxItem id="SYSTEM_ADMIN">系统管理员</ListBoxItem>
                      <ListBoxItem id="USER">普通用户</ListBoxItem>
                    </ListBox>
                  </SelectPopover>
                </Select>
              </AdminField>
            </AdminFieldGroup>
          </AdminDrawerSection>
        )}

        <AdminDrawerSection
          title="账户信息"
          description={isEdit ? '维护登录识别信息与通知邮箱。' : '创建用户时至少需要用户名、邮箱和密码。'}
        >
          <AdminField
            label="用户名"
            required
            error={errors.username?.message}
            help={isEdit ? '用户名创建后不可修改。' : undefined}
          >
            <input
              {...register('username', {
                required: '请输入用户名',
                pattern: {
                  value: /^[a-zA-Z0-9_-]+$/,
                  message: '仅支持字母、数字、下划线和连字符',
                },
              })}
              disabled={isEdit}
              placeholder="如：zhangsan"
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              aria-invalid={!!errors.username}
            />
          </AdminField>

          <AdminField label="邮箱" required error={errors.email?.message}>
            <input
              type="email"
              {...register('email', {
                required: '请输入邮箱',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: '请输入有效的邮箱地址',
                },
              })}
              placeholder="如：user@example.com"
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.email}
            />
          </AdminField>

          {!isEdit && (
            <AdminField label="密码" required error={errors.password?.message}>
              <input
                type="password"
                {...register('password', {
                  required: '请输入密码',
                  minLength: { value: 6, message: '密码至少6位' },
                })}
                placeholder="至少6位字符"
                className={adminInputClassName}
                style={adminInputStyle}
                aria-invalid={!!errors.password}
              />
            </AdminField>
          )}
        </AdminDrawerSection>

        {isEdit && (
          <AdminDrawerSection title="个人资料" description="补充用户的实名信息与联系方式。">
            <AdminFieldGroup columns={2}>
              <AdminField label="姓名">
                <input
                  {...register('realName')}
                  placeholder="如：张三"
                  className={adminInputClassName}
                  style={adminInputStyle}
                />
              </AdminField>

              <AdminField label="手机号" error={errors.phone?.message}>
                <input
                  {...register('phone', {
                    pattern: {
                      value: /^1[3-9]\d{9}$/,
                      message: '请输入有效的手机号',
                    },
                  })}
                  placeholder="如：13800138000"
                  className={adminInputClassName}
                  style={adminInputStyle}
                  aria-invalid={!!errors.phone}
                />
              </AdminField>
            </AdminFieldGroup>
          </AdminDrawerSection>
        )}

        {isEdit && (
          <AdminDrawerSection title="账户状态" description="控制该用户当前是否可正常登录与使用系统。">
            <AdminFieldGroup template="minmax(0,1fr) 180px">
              <AdminField label="状态">
                <Select
                  selectedKey={status || 'ACTIVE'}
                  onSelectionChange={(key) => setValue('status', key as string)}
                >
                  <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      <ListBoxItem id="ACTIVE" textValue="正常">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                          正常
                        </div>
                      </ListBoxItem>
                      <ListBoxItem id="DISABLED" textValue="禁用">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                          禁用
                        </div>
                      </ListBoxItem>
                      <ListBoxItem id="LOCKED" textValue="锁定">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
                          锁定
                        </div>
                      </ListBoxItem>
                    </ListBox>
                  </SelectPopover>
                </Select>
              </AdminField>
            </AdminFieldGroup>
          </AdminDrawerSection>
        )}

        {isEdit && isSuperAdmin && (
          <AdminDrawerSection title="系统与角色管理" description="管理该用户在不同系统中的角色分配关系。">
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  className="rounded-md border px-4 py-3"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--panel-muted)',
                  }}
                >
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>已分配系统</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{assignedSystemCount}</p>
                </div>
                <div
                  className="rounded-md border px-4 py-3"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--panel-muted)',
                  }}
                >
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>角色总数</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{assignedRoleCount}</p>
                </div>
              </div>

              <div
                className="overflow-hidden rounded-md border"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--panel)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setRolesPanelOpen((value) => !value)}
                  className="flex w-full items-center justify-between px-4 py-3 transition-colors"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--panel-muted) 72%, var(--panel))',
                    borderBottom: rolesPanelOpen ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    <Layers className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    当前分配
                  </div>
                  {rolesPanelOpen ? (
                    <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                  ) : (
                    <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                  )}
                </button>

                {rolesPanelOpen && (
                  <div className="space-y-5 px-4 py-4">
                    {rolesLoading ? (
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>加载中...</p>
                    ) : userSystemRoles.length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>当前还没有任何系统角色分配。</p>
                    ) : (
                      <div className="space-y-4">
                        {userSystemRoles.map((group) => (
                          <div key={group.systemId} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                {group.systemName}
                              </p>
                              <span className="text-xs" style={{ color: 'var(--muted)' }}>{group.roles.length} 个角色</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {group.roles.map((roleItem) => (
                                <span
                                  key={roleItem.id}
                                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                                  style={{
                                    color: 'var(--accent)',
                                    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border))',
                                  }}
                                >
                                  {roleItem.name}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRole(group.systemId, roleItem.id)}
                                    className="transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>添加角色</p>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <Select
                          selectedKey={selectedSystemId || null}
                          onSelectionChange={(key) => {
                            setSelectedSystemId(key as string);
                            setSelectedRoleId('');
                            loadRolesForSystem(key as string);
                          }}
                        >
                          <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectPopover>
                            <ListBox>
                              {systems.map((systemItem) => (
                                <ListBoxItem key={systemItem.id} id={systemItem.id}>
                                  {systemItem.name}
                                </ListBoxItem>
                              ))}
                            </ListBox>
                          </SelectPopover>
                        </Select>

                        <Select
                          selectedKey={selectedRoleId || null}
                          onSelectionChange={(key) => setSelectedRoleId(key as string)}
                          isDisabled={!selectedSystemId}
                        >
                          <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectPopover>
                            <ListBox>
                              {(allRolesBySystem[selectedSystemId] || []).map((roleItem) => (
                                <ListBoxItem key={roleItem.id} id={roleItem.id}>
                                  {roleItem.name}
                                </ListBoxItem>
                              ))}
                            </ListBox>
                          </SelectPopover>
                        </Select>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11 min-w-[88px] cursor-pointer px-3"
                          isDisabled={!selectedSystemId || !selectedRoleId}
                          onClick={handleAddRole}
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            添加
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </AdminDrawerSection>
        )}
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
