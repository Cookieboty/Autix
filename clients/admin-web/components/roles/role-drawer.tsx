'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from '@heroui/react';
import { Button, Input } from '@heroui/react';
import { Label } from '@heroui/react';
import { Shield, AlertCircle } from 'lucide-react';
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleForm>();

  useEffect(() => {
    if (open) {
      reset(
        role
          ? { name: role.name, code: role.code, description: role.description || '', sort: role.sort }
          : { name: '', code: '', description: '', sort: 0 }
      );
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
      setError(err.response?.data?.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer {...({ isOpen: open, onClose: () => onOpenChange(false), className: "w-[480px] sm:max-w-[480px]" } as any)}>
      <DrawerContent placement="right">
        <DrawerHeader className="px-6 py-5 border-b bg-surface-secondary flex-shrink-0">
          <div className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-surface shadow-sm">
              <Shield className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-foreground">{isEdit ? '编辑角色' : '新增角色'}</div>
              <div className="text-sm font-normal text-muted mt-0.5">
                {isEdit ? `修改「${role!.name}」的基本信息` : '创建一个新的系统角色'}
              </div>
            </div>
          </div>
        </DrawerHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <DrawerBody className="px-6 py-5 space-y-5 overflow-y-auto min-h-0">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                角色名称 <span className="text-danger">*</span>
              </Label>
              <Input
                {...register('name', { required: '请输入角色名称' })}
                placeholder="如：系统管理员"
                {...({ isInvalid: !!errors.name } as any)}
                errorMessage={errors.name?.message}
              />
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                角色编码 <span className="text-danger">*</span>
              </Label>
              <Input
                {...register('code', { required: '请输入角色编码' })}
                isDisabled={isEdit}
                placeholder="如：ADMIN"
                className="font-mono text-sm"
                {...({ isInvalid: !!errors.code } as any)}
                errorMessage={errors.code?.message}
              />
              {isEdit && (
                <p className="text-xs text-muted">角色编码创建后不可修改</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">描述</Label>
              <Input
                {...register('description')}
                placeholder="简要描述该角色的职责"
              />
            </div>

            {/* Sort */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">排序</Label>
              <Input
                type="number"
                {...register('sort', { valueAsNumber: true })}
                defaultValue={0}
                className="w-32"
              />
              <p className="text-xs text-muted">数值越小越靠前</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 border border-danger/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </DrawerBody>

          <DrawerFooter className="px-6 py-4 border-t bg-surface-secondary flex-shrink-0">
            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                {...({ isLoading: loading } as any)}
                className="flex-1 cursor-pointer text-base font-medium shadow-sm"
              >
                {loading ? '保存中...' : isEdit ? '保存修改' : '创建角色'}
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
