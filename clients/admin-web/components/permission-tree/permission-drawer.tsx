'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Key } from 'lucide-react';

interface PermissionFormData {
  menuId: string;
  name: string;
  code: string;
  type: 'FRONTEND' | 'BACKEND';
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT';
  description?: string;
}

interface PermissionDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PermissionFormData) => Promise<void>;
  initialData?: any;
  isEdit?: boolean;
  menuId?: string;
  systemMenus: any[];
}

const ACTION_OPTIONS = [
  { value: 'CREATE', label: '新增' },
  { value: 'READ', label: '查看' },
  { value: 'UPDATE', label: '编辑' },
  { value: 'DELETE', label: '删除' },
  { value: 'EXPORT', label: '导出' },
  { value: 'IMPORT', label: '导入' },
];

export function PermissionDrawer({ 
  open, 
  onClose, 
  onSubmit, 
  initialData, 
  isEdit,
  menuId: propMenuId,
  systemMenus,
}: PermissionDrawerProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PermissionFormData>({
    defaultValues: {
      type: 'BACKEND',
      action: 'READ',
    },
  });

  const type = watch('type');
  const action = watch('action');
  const menuId = watch('menuId');

  useEffect(() => {
    if (open && initialData) {
      reset(initialData);
    } else if (open && !initialData) {
      reset({
        menuId: propMenuId || '',
        name: '',
        code: '',
        type: 'BACKEND',
        action: 'READ',
        description: '',
      });
    }
  }, [open, initialData, propMenuId, reset]);

  const handleFormSubmit = async (data: PermissionFormData) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] flex flex-col p-0 h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Key className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-gray-900">{isEdit ? '编辑权限' : '新增权限'}</div>
                <div className="text-sm font-normal text-gray-500 mt-0.5">
                  {isEdit ? '修改权限基本信息' : '创建一个新的权限点'}
                </div>
              </div>
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto min-h-0">
            {/* Menu */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                所属菜单 <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={menuId} 
                onValueChange={(value) => setValue('menuId', value)}
                disabled={isEdit}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="选择菜单" />
                </SelectTrigger>
                <SelectContent>
                  {systemMenus.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>
                      {menu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                权限名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                {...register('name', { required: '请输入权限名称' })}
                placeholder="如：创建用户"
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
                权限编码 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="code"
                {...register('code', {
                  required: '请输入权限编码',
                  pattern: {
                    value: /^[a-z0-9:-]+$/,
                    message: '只能包含小写字母、数字、连字符和冒号',
                  },
                })}
                placeholder="如：user:create"
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

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                权限类型 <span className="text-red-500">*</span>
              </Label>
              <Select value={type} onValueChange={(value) => setValue('type', value as any)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRONTEND">前端权限</SelectItem>
                  <SelectItem value="BACKEND">后端权限</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                操作类型 <span className="text-red-500">*</span>
              </Label>
              <Select value={action} onValueChange={(value) => setValue('action', value as any)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                权限描述
              </Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="描述此权限的用途"
                className="min-h-[60px] resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50/50 flex-shrink-0">
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-11 cursor-pointer"
                style={{ backgroundColor: '#3B82F6' }}
              >
                {isSubmitting ? '保存中...' : isEdit ? '保存修改' : '创建权限'}
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
