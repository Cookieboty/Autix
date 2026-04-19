'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from '@heroui/react';
import { Button, Input, TextArea } from '@heroui/react';
import { Label } from '@heroui/react';
import { Select, SelectTrigger, SelectValue, SelectPopover, ListBox, ListBoxItem } from '@heroui/react';
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
    <Drawer {...({ isOpen: open, onClose: onClose, className: "w-[500px] sm:max-w-[500px]" } as any)}>
      <DrawerContent placement="right">
        <DrawerHeader className="px-6 py-5 border-b bg-surface-secondary flex-shrink-0">
          <div className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-surface shadow-sm">
              <Key className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-foreground">{isEdit ? '编辑权限' : '新增权限'}</div>
              <div className="text-sm font-normal text-muted mt-0.5">
                {isEdit ? '修改权限基本信息' : '创建一个新的权限点'}
              </div>
            </div>
          </div>
        </DrawerHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 min-h-0">
          <DrawerBody className="px-6 py-5 space-y-5 overflow-y-auto min-h-0">
            {/* Menu */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                所属菜单 <span className="text-danger">*</span>
              </Label>
              <Select
                selectedKey={menuId || null}
                onSelectionChange={(key) => setValue('menuId', key as string)}
                isDisabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    {systemMenus.map((menu) => (
                      <ListBoxItem key={menu.id} id={menu.id}>
                        {menu.name}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </SelectPopover>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                权限名称 <span className="text-danger">*</span>
              </Label>
              <Input
                id="name"
                {...register('name', { required: '请输入权限名称' })}
                placeholder="如：创建用户"
                {...({ isInvalid: !!errors.name } as any)}
                errorMessage={errors.name?.message}
              />
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-sm font-medium text-foreground">
                权限编码 <span className="text-danger">*</span>
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
                className="font-mono"
                isDisabled={isEdit}
                {...({ isInvalid: !!errors.code } as any)}
                errorMessage={errors.code?.message}
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                权限类型 <span className="text-danger">*</span>
              </Label>
              <Select
                selectedKey={type}
                onSelectionChange={(key) => setValue('type', key as 'FRONTEND' | 'BACKEND')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    <ListBoxItem id="FRONTEND">前端权限</ListBoxItem>
                    <ListBoxItem id="BACKEND">后端权限</ListBoxItem>
                  </ListBox>
                </SelectPopover>
              </Select>
            </div>

            {/* Action */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                操作类型 <span className="text-danger">*</span>
              </Label>
              <Select
                selectedKey={action}
                onSelectionChange={(key) => setValue('action', key as 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    {ACTION_OPTIONS.map((opt) => (
                      <ListBoxItem key={opt.value} id={opt.value}>
                        {opt.label}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </SelectPopover>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">
                权限描述
              </Label>
              <TextArea
                id="description"
                {...register('description')}
                placeholder="描述此权限的用途"
                className="resize-none min-h-[80px]"
              />
            </div>
          </DrawerBody>

          <DrawerFooter className="px-6 py-4 border-t bg-surface-secondary flex-shrink-0">
            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                {...({ isLoading: isSubmitting } as any)}
                className="flex-1 cursor-pointer"
              >
                {isSubmitting ? '保存中...' : isEdit ? '保存修改' : '创建权限'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 cursor-pointer"
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
