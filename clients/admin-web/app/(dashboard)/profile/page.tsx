'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { User, Lock, Mail, Shield } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@heroui/react';
import { Button, Input } from '@heroui/react';
import { Label } from '@heroui/react';
import { Chip } from '@heroui/react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PasswordForm>();

  const newPassword = watch('newPassword');

  const onSubmit = async (data: PasswordForm) => {
    if (data.newPassword !== data.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await api.post('/auth/change-password', {
        oldPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setMessage('密码修改成功');
      reset();
    } catch (err: any) {
      setError(err.response?.data?.message || '密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">
        个人信息
      </h1>

      <div className="grid gap-6">
        {/* 基本信息 */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <span className="font-semibold">基本信息</span>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-default-500 text-sm">用户名</Label>
                <p className="mt-1 font-mono font-medium">{user.username}</p>
              </div>
              <div>
                <Label className="text-default-500 text-sm">姓名</Label>
                <p className="mt-1 font-medium">{user.realName || '-'}</p>
              </div>
              <div>
                <Label className="text-default-500 text-sm flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  邮箱
                </Label>
                <p className="mt-1">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 角色和权限 */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">角色与权限</span>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label className="text-default-500 text-sm">当前角色</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Array.isArray(user.roles) ? user.roles : []).map((role: any, index: number) => (
                  <Chip
                    key={typeof role === 'string' ? role : `role-${index}`}
                    color="accent"
                    variant="soft"
                  >
                    {typeof role === 'string' ? role : (role.code || role.name || '未知角色')}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-default-500 text-sm">拥有权限</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Array.isArray(user.permissions) ? user.permissions.slice(0, 20) : []).map((perm: any, index: number) => (
                  <Chip
                    key={typeof perm === 'string' ? perm : `perm-${index}`}
                    color="default"
                    variant="soft"
                    size="sm"
                    className="font-mono"
                  >
                    {typeof perm === 'string' ? perm : perm.code || perm.name || '未知权限'}
                  </Chip>
                ))}
                {user.permissions && user.permissions.length > 20 && (
                  <Chip color="default" variant="soft" size="sm">
                    +{user.permissions.length - 20} 更多
                  </Chip>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 修改密码 */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <span className="font-semibold">修改密码</span>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>当前密码 *</Label>
                <Input
                  type="password"
                  {...register('currentPassword', { required: '请输入当前密码' })}
                  placeholder="••••••••"
                  variant="secondary"
                />
                {errors.currentPassword && (
                  <p className="text-sm text-danger">{errors.currentPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>新密码 *</Label>
                <Input
                  type="password"
                  {...register('newPassword', {
                    required: '请输入新密码',
                    minLength: { value: 6, message: '密码至少6位' },
                  })}
                  placeholder="••••••••"
                  variant="secondary"
                />
                {errors.newPassword && (
                  <p className="text-sm text-danger">{errors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>确认新密码 *</Label>
                <Input
                  type="password"
                  {...register('confirmPassword', {
                    required: '请确认新密码',
                    validate: (val) => val === newPassword || '两次输入的密码不一致',
                  })}
                  placeholder="••••••••"
                  variant="secondary"
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-danger">{errors.confirmPassword.message}</p>
                )}
              </div>
              {message && (
                <div role="alert" className="text-sm p-3 rounded-lg bg-success/10 text-success">
                  {message}
                </div>
              )}
              {error && (
                <div role="alert" className="text-sm p-3 rounded-lg bg-danger/10 text-danger">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                isDisabled={loading}
              >
                {loading ? '修改中...' : '修改密码'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
