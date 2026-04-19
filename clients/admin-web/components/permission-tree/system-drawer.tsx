'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from '@heroui/react';
import { Button, Input, TextArea } from '@heroui/react';
import { Label } from '@heroui/react';
import { Select, SelectTrigger, SelectValue, SelectPopover, ListBox, ListBoxItem } from '@heroui/react';
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
    <Drawer {...({ isOpen: open, onClose: onClose, className: "w-[500px] sm:max-w-[500px]" } as any)}>
      <DrawerContent placement="right">
        <DrawerHeader className="px-6 py-5 border-b bg-surface-secondary flex-shrink-0">
          <div className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-surface shadow-sm">
              <Layers className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-foreground">{isEdit ? '编辑系统' : '新增系统'}</div>
              <div className="text-sm font-normal text-muted mt-0.5">
                {isEdit ? '修改系统基本信息' : '创建一个新的多租户系统'}
              </div>
            </div>
          </div>
        </DrawerHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 min-h-0">
          <DrawerBody className="px-6 py-5 space-y-5 overflow-y-auto min-h-0">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                系统名称 <span className="text-danger">*</span>
              </Label>
              <Input
                id="name"
                {...register('name', { required: '请输入系统名称' })}
                placeholder="如：后台管理系统"
                {...({ isInvalid: !!errors.name } as any)}
                errorMessage={errors.name?.message}
              />
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-sm font-medium text-foreground">
                系统编码 <span className="text-danger">*</span>
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
                className="font-mono"
                isDisabled={isEdit}
                {...({ isInvalid: !!errors.code } as any)}
                errorMessage={errors.code?.message}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">
                系统描述
              </Label>
              <TextArea
                id="description"
                {...register('description')}
                placeholder="系统功能和用途描述"
                className="resize-none min-h-[80px]"
              />
            </div>

            {/* Sort */}
            <div className="space-y-1.5">
              <Label htmlFor="sort" className="text-sm font-medium text-foreground">
                排序号 <span className="text-danger">*</span>
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
                {...({ isInvalid: !!errors.sort } as any)}
                errorMessage={errors.sort?.message}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-sm font-medium text-foreground">
                状态 <span className="text-danger">*</span>
              </Label>
              <Select
                selectedKey={status}
                onSelectionChange={(key) => setValue('status', key as 'ACTIVE' | 'INACTIVE')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    <ListBoxItem id="ACTIVE" textValue="启用">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-success" />
                        <span>启用</span>
                      </div>
                    </ListBoxItem>
                    <ListBoxItem id="INACTIVE" textValue="停用">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-muted" />
                        <span>停用</span>
                      </div>
                    </ListBoxItem>
                  </ListBox>
                </SelectPopover>
              </Select>
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
                {isSubmitting ? '保存中...' : isEdit ? '保存修改' : '创建系统'}
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
