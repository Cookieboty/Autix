'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { User, Lock, Mail, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
      <h1 className="text-2xl font-bold font-mono mb-6 text-primary">
        个人信息
      </h1>

      <div className="grid gap-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm">用户名</Label>
                <p className="mt-1 font-mono font-medium">{user.username}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">姓名</Label>
                <p className="mt-1 font-medium">{user.realName || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  邮箱
                </Label>
                <p className="mt-1">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 角色和权限 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              角色与权限
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-sm">当前角色</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Array.isArray(user.roles) ? user.roles : []).map((role: any, index: number) => (
                  <Badge
                    key={typeof role === 'string' ? role : `role-${index}`}
                    className="border-0 bg-primary text-primary-foreground"
                  >
                    {typeof role === 'string' ? role : (role.code || role.name || '未知角色')}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">拥有权限</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Array.isArray(user.permissions) ? user.permissions.slice(0, 20) : []).map((perm: any, index: number) => (
                  <Badge 
                    key={typeof perm === 'string' ? perm : `perm-${index}`} 
                    variant="secondary" 
                    className="text-xs font-mono"
                  >
                    {typeof perm === 'string' ? perm : perm.code || perm.name || '未知权限'}
                  </Badge>
                ))}
                {user.permissions && user.permissions.length > 20 && (
                  <Badge variant="secondary" className="text-xs">
                    +{user.permissions.length - 20} 更多
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 修改密码 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              修改密码
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>当前密码 *</Label>
                <Input
                  type="password"
                  {...register('currentPassword', { required: '请输入当前密码' })}
                  placeholder="••••••••"
                />
                {errors.currentPassword && (
                  <p className="text-xs text-red-500">{errors.currentPassword.message}</p>
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
                />
                {errors.newPassword && (
                  <p className="text-xs text-red-500">{errors.newPassword.message}</p>
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
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
                )}
              </div>
              {message && (
                <div role="alert" className="text-sm p-3 rounded border" style={{ color: 'var(--color-system)', backgroundColor: 'oklch(73.29% 0.1941 150.81 / 0.1)', borderColor: 'oklch(73.29% 0.1941 150.81 / 0.3)' }}>
                  {message}
                </div>
              )}
              {error && (
                <div role="alert" className="text-sm p-3 rounded border" style={{ color: 'var(--destructive)', backgroundColor: 'oklch(59.40% 0.1973 24.63 / 0.1)', borderColor: 'oklch(59.40% 0.1973 24.63 / 0.3)' }}>
                  {error}
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="cursor-pointer bg-primary text-primary-foreground"
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
