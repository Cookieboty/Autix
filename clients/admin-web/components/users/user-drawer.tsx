'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from '@heroui/react';
import { Button, Input } from '@heroui/react';
import { Label } from '@heroui/react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopover,
  ListBox,
  ListBoxItem,
} from '@heroui/react';
import { Users, AlertCircle, Layers, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

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

export function UserDrawer({ open, onOpenChange, user, onSuccess }: UserDrawerProps) {
  const isEdit = !!user;
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin) ?? false;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systems, setSystems] = useState<System[]>([]);

  // System-role management state (super admin edit mode)
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
      // Build new systemRoles preserving existing, adding the new role
      const existing = userSystemRoles.map((g) => ({
        systemId: g.systemId,
        roleIds: g.roles.map((r) => r.id),
      }));
      const targetGroup = existing.find((g) => g.systemId === selectedSystemId);
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
      const existing = userSystemRoles.map((g) => ({
        systemId: g.systemId,
        roleIds: g.roles.map((r) => r.id).filter((id) => !(g.systemId === sysId && id === roleId)),
      })).filter((g) => g.roleIds.length > 0);
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
        const { username, email, password, systemId, roleCode } = data;
        await api.post('/users', { username, email, password, systemId, roleCode });
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
    <Drawer {...({ isOpen: open, onClose: () => onOpenChange(false), className: "w-[500px] sm:max-w-[500px]" } as any)}>
      <DrawerContent placement="right">
        <DrawerHeader className="px-6 py-5 border-b bg-surface-secondary flex-shrink-0">
          <div className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-surface shadow-sm">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-foreground">{isEdit ? '编辑用户' : '新增用户'}</div>
              <div className="text-sm font-normal text-muted mt-0.5">
                {isEdit ? `修改「${user!.username}」的基本信息` : '创建一个新的系统用户'}
              </div>
            </div>
          </div>
        </DrawerHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <DrawerBody className="px-6 py-5 space-y-5 overflow-y-auto min-h-0">
            {/* System Select — super admin create mode only */}
            {!isEdit && isSuperAdmin && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  所属系统 <span className="text-danger">*</span>
                </Label>
                <Select
                  selectedKey={systemId || null}
                  onSelectionChange={(key) => setValue('systemId', key as string)}
                >
                  <SelectTrigger>
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
              </div>
            )}

            {/* Role Select — super admin create mode only */}
            {!isEdit && isSuperAdmin && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  角色 <span className="text-danger">*</span>
                </Label>
                <Select
                  selectedKey={roleCode || 'USER'}
                  onSelectionChange={(key) => setValue('roleCode', key as string)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      <ListBoxItem id="SYSTEM_ADMIN">系统管理员</ListBoxItem>
                      <ListBoxItem id="USER">普通用户</ListBoxItem>
                    </ListBox>
                  </SelectPopover>
                </Select>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                用户名 <span className="text-danger">*</span>
              </Label>
              <Input
                {...register('username', {
                  required: '请输入用户名',
                  pattern: {
                    value: /^[a-zA-Z0-9_-]+$/,
                    message: '仅支持字母、数字、下划线和连字符',
                  },
                })}
                isDisabled={isEdit}
                placeholder="如：zhangsan"
                className="font-mono text-sm"
                {...({ isInvalid: !!errors.username } as any)}
                errorMessage={errors.username?.message}
              />
              {isEdit && (
                <p className="text-xs text-muted">用户名创建后不可修改</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                邮箱 <span className="text-danger">*</span>
              </Label>
              <Input
                type="email"
                {...register('email', {
                  required: '请输入邮箱',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: '请输入有效的邮箱地址',
                  },
                })}
                placeholder="如：user@example.com"
                {...({ isInvalid: !!errors.email } as any)}
                errorMessage={errors.email?.message}
              />
            </div>

            {/* Password (only for create) */}
            {!isEdit && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  密码 <span className="text-danger">*</span>
                </Label>
                <Input
                  type="password"
                  {...register('password', {
                    required: '请输入密码',
                    minLength: { value: 6, message: '密码至少6位' },
                  })}
                  placeholder="至少6位字符"
                  {...({ isInvalid: !!errors.password } as any)}
                  errorMessage={errors.password?.message}
                />
              </div>
            )}

            {/* Real Name — edit mode only */}
            {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">姓名</Label>
              <Input
                {...register('realName')}
                placeholder="如：张三"
              />
            </div>
            )}

            {/* Phone — edit mode only */}
            {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">手机号</Label>
              <Input
                {...register('phone', {
                  pattern: {
                    value: /^1[3-9]\d{9}$/,
                    message: '请输入有效的手机号',
                  },
                })}
                placeholder="如：13800138000"
                {...({ isInvalid: !!errors.phone } as any)}
                errorMessage={errors.phone?.message}
              />
            </div>
            )}

            {/* Status — edit mode only */}
            {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">状态</Label>
              <Select
                selectedKey={status || 'ACTIVE'}
                onSelectionChange={(key) => setValue('status', key as string)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    <ListBoxItem id="ACTIVE" textValue="正常">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-success" />
                        正常
                      </div>
                    </ListBoxItem>
                    <ListBoxItem id="DISABLED" textValue="禁用">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-muted" />
                        禁用
                      </div>
                    </ListBoxItem>
                    <ListBoxItem id="LOCKED" textValue="锁定">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-danger" />
                        锁定
                      </div>
                    </ListBoxItem>
                  </ListBox>
                </SelectPopover>
              </Select>
            </div>
            )}

            {/* System / Role Management — super admin edit mode only */}
            {isEdit && isSuperAdmin && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRolesPanelOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Layers className="h-4 w-4 text-accent" />
                    系统与角色管理
                    {userSystemRoles.length > 0 && (
                      <span className="text-xs text-muted">
                        ({userSystemRoles.length} 个系统)
                      </span>
                    )}
                  </div>
                  {rolesPanelOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted" />
                  )}
                </button>

                {rolesPanelOpen && (
                  <div className="px-4 py-3 space-y-4">
                    {/* Current assignments */}
                    {rolesLoading ? (
                      <p className="text-xs text-muted">加载中...</p>
                    ) : userSystemRoles.length === 0 ? (
                      <p className="text-xs text-muted">暂无系统角色</p>
                    ) : (
                      <div className="space-y-3">
                        {userSystemRoles.map((group) => (
                          <div key={group.systemId}>
                            <p className="text-xs font-medium text-muted mb-1.5">
                              {group.systemName}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {group.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/20 rounded px-2 py-0.5"
                                >
                                  {role.name}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRole(group.systemId, role.id)}
                                    className="hover:text-red-500 transition-colors"
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

                    {/* Add role */}
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-medium text-muted">添加角色</p>
                      <div className="flex gap-2">
                        <Select
                          selectedKey={selectedSystemId || null}
                          onSelectionChange={(key) => {
                            setSelectedSystemId(key as string);
                            setSelectedRoleId('');
                            loadRolesForSystem(key as string);
                          }}
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

                        <Select
                          selectedKey={selectedRoleId || null}
                          onSelectionChange={(key) => setSelectedRoleId(key as string)}
                          isDisabled={!selectedSystemId}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectPopover>
                            <ListBox>
                              {(allRolesBySystem[selectedSystemId] || []).map((r) => (
                                <ListBoxItem key={r.id} id={r.id}>
                                  {r.name}
                                </ListBoxItem>
                              ))}
                            </ListBox>
                          </SelectPopover>
                        </Select>

                        <Button
                          type="button"
                          size="sm"
                          className="h-8 px-2 cursor-pointer"
                          isDisabled={!selectedSystemId || !selectedRoleId}
                          onClick={handleAddRole}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 border border-danger/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </DrawerBody>

          {/* Footer */}
          <DrawerFooter className="px-6 py-4 border-t bg-surface-secondary flex-shrink-0">
            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                {...({ isLoading: loading } as any)}
                className="flex-1 cursor-pointer text-base font-medium shadow-sm"
              >
                {loading ? '保存中...' : isEdit ? '保存修改' : '创建用户'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 cursor-pointer text-base font-medium"
              >
                取消
              </Button>
            </div>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
