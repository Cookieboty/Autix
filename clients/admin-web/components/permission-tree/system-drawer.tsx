'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Layers } from 'lucide-react';

interface SystemFormData {
  name: string;
  code: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  sort: number;
}

interface SystemDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SystemFormData) => Promise<void>;
  initialData?: any;
  isEdit?: boolean;
}

export function SystemDrawer({ open, onClose, onSubmit, initialData, isEdit }: SystemDrawerProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SystemFormData>({
    defaultValues: {
      status: 'ACTIVE',
      sort: 1,
    },
  });

  const status = watch('status');

  useEffect(() => {
    if (open && initialData) {
      reset(initialData);
    } else if (open && !initialData) {
      reset({ name: '', code: '', description: '', status: 'ACTIVE', sort: 1 });
    }
  }, [open, initialData, reset]);

  const handleFormSubmit = async (data: SystemFormData) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] flex flex-col p-0 h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gradient-to-r from-cyan-50 to-blue-50 flex-shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Layers className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <div className="text-gray-900">{isEdit ? '编辑系统' : '新增系统'}</div>
                <div className="text-sm font-normal text-gray-500 mt-0.5">
                  {isEdit ? '修改系统基本信息' : '创建一个新的多租户系统'}
                </div>
              </div>
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto min-h-0">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                系统名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                {...register('name', { required: '请输入系统名称' })}
                placeholder="如：后台管理系统"
                className="h-10"
              />
              {errors.name && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-sm font-medium text-gray-700">
                系统编码 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="code"
                {...register('code', {
                  required: '请输入系统编码',
                  pattern: {
                    value: /^[a-z0-9-]+$/,
                    message: '只能包含小写字母、数字和连字符',
                  },
                })}
                placeholder="如：admin-system"
                className="h-10 font-mono"
                disabled={isEdit}
              />
              {errors.code && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.code.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                系统描述
              </Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="系统功能和用途描述"
                className="min-h-[80px] resize-none"
              />
            </div>

            {/* Sort */}
            <div className="space-y-1.5">
              <Label htmlFor="sort" className="text-sm font-medium text-gray-700">
                排序号 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sort"
                type="number"
                {...register('sort', {
                  required: '请输入排序号',
                  valueAsNumber: true,
                  min: { value: 1, message: '排序号最小为1' },
                })}
                placeholder="数字越小越靠前"
                className="h-10"
              />
              {errors.sort && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.sort.message}
                </p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-sm font-medium text-gray-700">
                状态 <span className="text-red-500">*</span>
              </Label>
              <Select value={status} onValueChange={(value) => setValue('status', value as any)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span>启用</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="INACTIVE">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      <span>停用</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50/50 flex-shrink-0">
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-11 cursor-pointer bg-primary text-primary-foreground"
              >
                {isSubmitting ? '保存中...' : isEdit ? '保存修改' : '创建系统'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 h-11 cursor-pointer"
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
