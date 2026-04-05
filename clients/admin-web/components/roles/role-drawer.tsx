'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  sort: number;
}

interface RoleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  onSuccess: () => void;
}

interface RoleForm {
  name: string;
  code: string;
  description?: string;
  sort?: number;
}

export function RoleDrawer({ open, onOpenChange, role, onSuccess }: RoleDrawerProps) {
  const isEdit = !!role;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoleForm>();

  useEffect(() => {
    if (open) {
      reset(role ? {
        name: role.name,
        code: role.code,
        description: role.description || '',
        sort: role.sort,
      } : { name: '', code: '', description: '', sort: 0 });
      setError('');
    }
  }, [open, role, reset]);

  const onSubmit = async (data: RoleForm) => {
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await api.patch(`/roles/${role!.id}`, data);
      } else {
        await api.post('/roles', data);
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
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑角色' : '新增角色'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>角色名称 *</Label>
            <Input {...register('name', { required: '请输入角色名称' })} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>角色编码 *</Label>
            <Input
              {...register('code', { required: '请输入角色编码' })}
              disabled={isEdit}
              placeholder="如：ADMIN"
              className="font-mono"
            />
            {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>描述</Label>
            <Input {...register('description')} />
          </div>
          <div className="space-y-2">
            <Label>排序</Label>
            <Input type="number" {...register('sort', { valueAsNumber: true })} defaultValue={0} />
          </div>
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
