'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@heroui/react';
import { Select, SelectTrigger, SelectValue, SelectPopover, ListBox, ListBoxItem } from '@heroui/react';
import { Layers } from 'lucide-react';
import {
  AdminDrawerBody,
  AdminDrawerFooter,
  AdminDrawerHero,
  AdminDrawerMeta,
  AdminDrawerSection,
  AdminDrawerShell,
  AdminField,
  AdminFieldGroup,
  adminInputClassName,
  adminInputStyle,
  adminTextareaClassName,
} from '@/components/drawer-shell';

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
    <AdminDrawerShell
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      width="sm"
      header={
        <AdminDrawerHero
          icon={<Layers className="h-5 w-5" />}
          eyebrow={isEdit ? '编辑系统' : '新建系统'}
          title={isEdit ? initialData?.name || '编辑系统' : '创建新系统'}
          description={isEdit ? '调整系统基本信息与启停状态。' : '创建一个新的多租户系统实体。'}
          meta={<AdminDrawerMeta tone={status === 'ACTIVE' ? 'success' : 'default'}>{status === 'ACTIVE' ? '启用中' : '停用中'}</AdminDrawerMeta>}
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? '停用系统后，相关入口会按系统状态收敛。' : '创建完成后即可继续配置菜单与权限。'}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="min-w-[88px] cursor-pointer text-sm font-medium"
              >
                取消
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit(handleFormSubmit)}
                {...({ isLoading: isSubmitting } as any)}
                className="min-w-[120px] cursor-pointer text-sm font-medium shadow-sm"
              >
                {isSubmitting ? '保存中...' : isEdit ? '保存修改' : '创建系统'}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        <AdminDrawerSection title="基本信息" description="定义系统名称、编码与用途说明。">
          <AdminField label="系统名称" required htmlFor="name" error={errors.name?.message}>
            <input
              id="name"
              {...register('name', { required: '请输入系统名称' })}
              placeholder="如：后台管理系统"
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.name}
            />
          </AdminField>

          <AdminField
            label="系统编码"
            required
            htmlFor="code"
            error={errors.code?.message}
            help={isEdit ? '系统编码创建后不可修改。' : '建议使用稳定的英文标识，避免后续频繁调整。'}
          >
            <input
              id="code"
              {...register('code', {
                required: '请输入系统编码',
                pattern: {
                  value: /^[a-z0-9-]+$/,
                  message: '只能包含小写字母、数字和连字符',
                },
              })}
              placeholder="如：admin-system"
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              disabled={isEdit}
              aria-invalid={!!errors.code}
            />
          </AdminField>

          <AdminField
            label="系统描述"
            htmlFor="description"
            help="建议说明系统的目标用户、主要职责和边界。"
          >
            <textarea
              id="description"
              {...register('description')}
              placeholder="系统功能和用途描述"
              rows={4}
              className={`${adminTextareaClassName} min-h-[120px]`}
              style={adminInputStyle}
            />
          </AdminField>
        </AdminDrawerSection>

        <AdminDrawerSection title="状态与排序" description="控制系统是否对外可用，以及在列表中的优先级。">
          <AdminFieldGroup template="minmax(0,1fr) 144px">
            <AdminField label="状态" required htmlFor="status">
              <Select
                selectedKey={status}
                onSelectionChange={(key) => setValue('status', key as 'ACTIVE' | 'INACTIVE')}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    <ListBoxItem id="ACTIVE" textValue="启用">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                        <span>启用</span>
                      </div>
                    </ListBoxItem>
                    <ListBoxItem id="INACTIVE" textValue="停用">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                        <span>停用</span>
                      </div>
                    </ListBoxItem>
                  </ListBox>
                </SelectPopover>
              </Select>
            </AdminField>

            <AdminField
              label="排序号"
              required
              htmlFor="sort"
              error={errors.sort?.message}
              help={errors.sort?.message ? undefined : '数字越小越靠前'}
            >
              <input
                id="sort"
                type="number"
                {...register('sort', {
                  required: '请输入排序号',
                  valueAsNumber: true,
                  min: { value: 1, message: '排序号最小为1' },
                })}
                placeholder="1"
                className={adminInputClassName}
                style={adminInputStyle}
                aria-invalid={!!errors.sort}
              />
            </AdminField>
          </AdminFieldGroup>
        </AdminDrawerSection>
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
