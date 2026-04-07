'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, AlertCircle, Layers, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface User {
  id: string;
  username: string;
  email: string;
  realName?: string;
  phone?: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED';
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
      const roles: Role[] = Array.isArray(data) ? data : data.data || [];
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] flex flex-col p-0 h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-gray-900">{isEdit ? '编辑用户' : '新增用户'}</div>
                <div className="text-sm font-normal text-gray-500 mt-0.5">
                  {isEdit ? `修改「${user!.username}」的基本信息` : '创建一个新的系统用户'}
                </div>
              </div>
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto min-h-0">
            {/* System Select — super admin create mode only */}
            {!isEdit && isSuperAdmin && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  所属系统 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={systemId || ''}
                  onValueChange={(val) => setValue('systemId', val)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="请选择系统" />
                  </SelectTrigger>
                  <SelectContent>
                    {systems.map((sys) => (
                      <SelectItem key={sys.id} value={sys.id}>
                        {sys.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Role Select — super admin create mode only */}
            {!isEdit && isSuperAdmin && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  角色 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={roleCode || 'USER'}
                  onValueChange={(val) => setValue('roleCode', val)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM_ADMIN">系统管理员</SelectItem>
                    <SelectItem value="USER">普通用户</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                用户名 <span className="text-red-500">*</span>
              </Label>
              <Input
                {...register('username', {
                  required: '请输入用户名',
                  pattern: {
                    value: /^[a-zA-Z0-9_-]+$/,
                    message: '仅支持字母、数字、下划线和连字符',
                  },
                })}
                disabled={isEdit}
                placeholder="如：zhangsan"
                className="h-10 font-mono text-sm"
              />
              {errors.username && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.username.message}
                </p>
              )}
              {isEdit && (
                <p className="text-xs text-gray-400">用户名创建后不可修改</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                邮箱 <span className="text-red-500">*</span>
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
                className="h-10"
              />
              {errors.email && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password (only for create) */}
            {!isEdit && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  密码 <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="password"
                  {...register('password', {
                    required: '请输入密码',
                    minLength: { value: 6, message: '密码至少6位' },
                  })}
                  placeholder="至少6位字符"
                  className="h-10"
                />
                {errors.password && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password.message}
                  </p>
                )}
              </div>
            )}

            {/* Real Name — edit mode only */}
            {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">姓名</Label>
              <Input
                {...register('realName')}
                placeholder="如：张三"
                className="h-10"
              />
            </div>
            )}

            {/* Phone — edit mode only */}
            {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">手机号</Label>
              <Input
                {...register('phone', {
                  pattern: {
                    value: /^1[3-9]\d{9}$/,
                    message: '请输入有效的手机号',
                  },
                })}
                placeholder="如：13800138000"
                className="h-10"
              />
              {errors.phone && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.phone.message}
                </p>
              )}
            </div>
            )}

            {/* Status — edit mode only */}
            {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">状态</Label>
              <Select
                value={status || 'ACTIVE'}
                onValueChange={(val) => setValue('status', val)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      正常
                    </div>
                  </SelectItem>
                  <SelectItem value="DISABLED">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      禁用
                    </div>
                  </SelectItem>
                  <SelectItem value="LOCKED">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      锁定
                    </div>
                  </SelectItem>
                </SelectContent>
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
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Layers className="h-4 w-4 text-purple-500" />
                    系统与角色管理
                    {userSystemRoles.length > 0 && (
                      <span className="text-xs text-gray-400">
                        ({userSystemRoles.length} 个系统)
                      </span>
                    )}
                  </div>
                  {rolesPanelOpen ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </button>

                {rolesPanelOpen && (
                  <div className="px-4 py-3 space-y-4">
                    {/* Current assignments */}
                    {rolesLoading ? (
                      <p className="text-xs text-gray-400">加载中...</p>
                    ) : userSystemRoles.length === 0 ? (
                      <p className="text-xs text-gray-400">暂无系统角色</p>
                    ) : (
                      <div className="space-y-3">
                        {userSystemRoles.map((group) => (
                          <div key={group.systemId}>
                            <p className="text-xs font-medium text-gray-500 mb-1.5">
                              {group.systemName}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {group.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-2 py-0.5"
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
                      <p className="text-xs font-medium text-gray-500">添加角色</p>
                      <div className="flex gap-2">
                        <Select
                          value={selectedSystemId}
                          onValueChange={(val) => {
                            setSelectedSystemId(val);
                            setSelectedRoleId('');
                            loadRolesForSystem(val);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder="选择系统" />
                          </SelectTrigger>
                          <SelectContent>
                            {systems.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={selectedRoleId}
                          onValueChange={setSelectedRoleId}
                          disabled={!selectedSystemId}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder="选择角色" />
                          </SelectTrigger>
                          <SelectContent>
                            {(allRolesBySystem[selectedSystemId] || []).map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          size="sm"
                          className="h-8 px-2 cursor-pointer"
                          disabled={!selectedSystemId || !selectedRoleId}
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
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50/50 flex-shrink-0">
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-11 cursor-pointer text-base font-medium shadow-sm bg-primary text-primary-foreground"
              >
                {loading ? '保存中...' : isEdit ? '保存修改' : '创建用户'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-11 cursor-pointer text-base font-medium"
              >
                取消
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
