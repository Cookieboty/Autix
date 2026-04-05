'use client';

import { useEffect } from 'react';
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
import api from '@/lib/api';
import { useState } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  realName?: string;
  phone?: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED';
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
}

export function UserDrawer({ open, onOpenChange, user, onSuccess }: UserDrawerProps) {
  const isEdit = !!user;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserForm>();

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
        reset({ username: '', email: '', password: '', realName: '', phone: '' });
      }
      setError('');
    }
  }, [open, user, reset]);

  const onSubmit = async (data: UserForm) => {
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        const { password, ...updateData } = data;
        await api.patch(`/users/${user!.id}`, updateData);
      } else {
        await api.post('/users', data);
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
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑用户' : '新增用户'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名 *</Label>
            <Input
              id="username"
              {...register('username', { required: '请输入用户名' })}
              disabled={isEdit}
            />
            {errors.username && (
              <p className="text-xs text-red-500">{errors.username.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱 *</Label>
            <Input
              id="email"
              type="email"
              {...register('email', { required: '请输入邮箱' })}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">密码 *</Label>
              <Input
                id="password"
                type="password"
                {...register('password', {
                  required: '请输入密码',
                  minLength: { value: 6, message: '密码至少6位' },
                })}
              />
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="realName">姓名</Label>
            <Input id="realName" {...register('realName')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          {isEdit && (
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                defaultValue={user?.status}
                onValueChange={(val) => setValue('status', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">正常</SelectItem>
                  <SelectItem value="DISABLED">禁用</SelectItem>
                  <SelectItem value="LOCKED">锁定</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {error && (
            <div role="alert" className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 cursor-pointer"
              style={{ backgroundColor: '#7C3AED' }}
            >
              {loading ? '保存中...' : '保存'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 cursor-pointer"
            >
              取消
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
