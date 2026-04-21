'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@heroui/react';
import { Select, SelectTrigger, SelectValue, SelectPopover, ListBox, ListBoxItem } from '@heroui/react';
import { Key } from 'lucide-react';
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
    <AdminDrawerShell
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      width="md"
      header={
        <AdminDrawerHero
          icon={<Key className="h-5 w-5" />}
          eyebrow={isEdit ? '编辑权限' : '新建权限'}
          title={isEdit ? initialData?.name || '编辑权限' : '创建新权限'}
          description={isEdit ? '调整权限语义与归属信息。' : '创建一个新的权限点。'}
          meta={<AdminDrawerMeta tone={type === 'FRONTEND' ? 'accent' : 'success'}>{type === 'FRONTEND' ? '前端权限' : '后端权限'}</AdminDrawerMeta>}
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? '修改后会影响角色分配与权限树展示。' : '创建完成后即可继续分配到角色。'}
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
                {isSubmitting ? '保存中...' : isEdit ? '保存修改' : '创建权限'}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        <AdminDrawerSection title="归属关系" description="权限需要明确挂在具体菜单下，保持导航与能力边界一致。">
          <AdminField
            label="所属菜单"
            required
            help={isEdit ? '编辑态不允许直接更改权限所属菜单。' : '建议按真实业务入口挂载，避免权限散落。'}
          >
            <Select
              selectedKey={menuId || null}
              onSelectionChange={(key) => setValue('menuId', key as string)}
              isDisabled={isEdit}
            >
              <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
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
          </AdminField>
        </AdminDrawerSection>

        <AdminDrawerSection title="基本信息" description="定义权限名称、编码与边界说明。">
          <AdminField label="权限名称" required htmlFor="name" error={errors.name?.message}>
            <input
              id="name"
              {...register('name', { required: '请输入权限名称' })}
              placeholder="如：创建用户"
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.name}
            />
          </AdminField>

          <AdminField
            label="权限编码"
            required
            htmlFor="code"
            error={errors.code?.message}
            help={isEdit ? '权限编码创建后不可修改。' : '建议按资源:动作格式命名，便于检索与分配。'}
          >
            <input
              id="code"
              {...register('code', {
                required: '请输入权限编码',
                pattern: {
                  value: /^[a-z0-9:-]+$/,
                  message: '只能包含小写字母、数字、连字符和冒号',
                },
              })}
              placeholder="如：user:create"
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              disabled={isEdit}
              aria-invalid={!!errors.code}
            />
          </AdminField>

          <AdminField label="权限描述" htmlFor="description" help="尽量用一句话说明权限边界。">
            <textarea
              id="description"
              {...register('description')}
              placeholder="描述此权限的用途"
              rows={4}
              className={`${adminTextareaClassName} min-h-[112px]`}
              style={adminInputStyle}
            />
          </AdminField>
        </AdminDrawerSection>

        <AdminDrawerSection title="权限语义" description="区分权限发生在哪一侧，以及它具体允许什么操作。">
          <AdminFieldGroup columns={2}>
            <AdminField label="权限类型" required>
              <Select
                selectedKey={type}
                onSelectionChange={(key) => setValue('type', key as 'FRONTEND' | 'BACKEND')}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    <ListBoxItem id="FRONTEND">前端权限</ListBoxItem>
                    <ListBoxItem id="BACKEND">后端权限</ListBoxItem>
                  </ListBox>
                </SelectPopover>
              </Select>
            </AdminField>

            <AdminField label="操作类型" required>
              <Select
                selectedKey={action}
                onSelectionChange={(key) => setValue('action', key as 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT')}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
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
            </AdminField>
          </AdminFieldGroup>
        </AdminDrawerSection>
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
