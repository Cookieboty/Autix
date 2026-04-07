'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Building, AlertCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DepartmentFormData {
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  sort?: number;
}

interface DepartmentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DepartmentFormData) => Promise<void>;
  initialData?: Partial<DepartmentFormData>;
  isEdit?: boolean;
  departments: Array<{ id: string; name: string }>;
}

export function DepartmentDrawer({
  open,
  onClose,
  onSubmit,
  initialData,
  isEdit,
  departments,
}: DepartmentDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepartmentFormData>({
    defaultValues: {
      sort: 1,
    },
  });

  const parentId = watch('parentId');

  useEffect(() => {
    if (open) {
      if (initialData) {
        Object.entries(initialData).forEach(([key, value]) => {
          setValue(key as any, value);
        });
      } else {
        reset({
          sort: 1,
        });
      }
      setError('');
    }
  }, [open, initialData, reset, setValue]);

  const handleFormSubmit = async (data: DepartmentFormData) => {
    setLoading(true);
    setError('');
    try {
      await onSubmit(data);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const availableParents = departments.filter((d) => d.id !== (initialData as any)?.id);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] flex flex-col p-0 h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gradient-to-r from-orange-50 to-amber-50 flex-shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Building className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-gray-900">{isEdit ? '编辑部门' : '新增部门'}</div>
                <div className="text-sm font-normal text-gray-500 mt-0.5">
                  {isEdit ? `修改「${initialData?.name}」的基本信息` : '创建一个新的组织部门'}
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
              <Label className="text-sm font-medium text-gray-700">
                部门名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                {...register('name', { required: '请输入部门名称' })}
                placeholder="如：技术部"
                className="h-10"
              />
              {errors.name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                部门编码 <span className="text-red-500">*</span>
              </Label>
              <Input
                {...register('code', {
                  required: '请输入部门编码',
                  pattern: {
                    value: /^[a-z0-9-]+$/,
                    message: '仅支持小写字母、数字和连字符',
                  },
                })}
                disabled={isEdit}
                placeholder="如：tech-dept"
                className="h-10 font-mono text-sm"
              />
              {errors.code && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.code.message}
                </p>
              )}
              {isEdit && (
                <p className="text-xs text-gray-400">部门编码创建后不可修改</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">部门描述</Label>
              <Textarea
                {...register('description')}
                placeholder="简要描述部门职能..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Parent Department */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">上级部门</Label>
              <Select
                value={parentId || 'root'}
                onValueChange={(value) =>
                  setValue('parentId', value === 'root' ? undefined : value)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">根部门（顶级）</SelectItem>
                  {availableParents.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">选择此部门的上级部门（可选）</p>
            </div>

            {/* Sort */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">排序</Label>
              <Input
                type="number"
                {...register('sort', { valueAsNumber: true })}
                className="h-10 w-32"
              />
              <p className="text-xs text-gray-400">数值越小越靠前</p>
            </div>

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
                {loading ? '保存中...' : isEdit ? '保存修改' : '创建部门'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
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
