'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@heroui/react';
import { Select, SelectTrigger, SelectValue, SelectPopover, ListBox, ListBoxItem } from '@heroui/react';
import { Menu as MenuIcon } from 'lucide-react';
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
} from '@/components/drawer-shell';

interface MenuFormData {
  systemId: string;
  name: string;
  code: string;
  path: string;
  icon?: string;
  parentId?: string;
  sort: number;
  visible: boolean;
}

interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: MenuFormData) => Promise<void>;
  initialData?: any;
  isEdit?: boolean;
  systemId?: string;
  parentMenuId?: string;
  systems: any[];
  menus: any[];
}

const ICON_OPTIONS = [
  'Users', 'Building', 'Shield', 'Key', 'Menu', 'Settings', 'FileText',
  'Folder', 'BarChart', 'MessageSquare', 'Bell', 'Calendar', 'Package',
  'ShoppingCart', 'CreditCard', 'Database', 'Server', 'Globe'
];

export function MenuDrawer({
  open,
  onClose,
  onSubmit,
  initialData,
  isEdit,
  systemId: propSystemId,
  parentMenuId,
  systems,
  menus,
}: MenuDrawerProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MenuFormData>({
    defaultValues: {
      visible: true,
      sort: 1,
    },
  });

  const systemId = watch('systemId');
  const visible = watch('visible');
  const icon = watch('icon');

  useEffect(() => {
    if (open && initialData) {
      reset(initialData);
    } else if (open && !initialData) {
      reset({
        systemId: propSystemId || '',
        parentId: parentMenuId || '',
        name: '',
        code: '',
        path: '',
        icon: 'Menu',
        sort: 1,
        visible: true,
      });
    }
  }, [open, initialData, propSystemId, parentMenuId, reset]);

  const handleFormSubmit = async (data: MenuFormData) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  const filteredMenus = menus.filter((m) => m.systemId === systemId && m.id !== initialData?.id);

  return (
    <AdminDrawerShell
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      width="md"
      header={
        <AdminDrawerHero
          icon={<MenuIcon className="h-5 w-5" />}
          eyebrow={isEdit ? '编辑菜单' : '新建菜单'}
          title={isEdit ? initialData?.name || '编辑菜单' : '创建新菜单'}
          description={isEdit ? '调整菜单层级、路由与展示配置。' : '创建一个新的系统导航入口。'}
          meta={<AdminDrawerMeta tone={visible ? 'success' : 'default'}>{visible ? '显示中' : '已隐藏'}</AdminDrawerMeta>}
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? '修改后会立即影响当前系统的导航结构。' : '创建完成后可继续为菜单配置权限点。'}
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
                {isSubmitting ? '保存中...' : isEdit ? '保存修改' : '创建菜单'}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        <AdminDrawerSection title="归属关系" description="先确认菜单所属系统，以及是否挂在其他菜单之下。">
          <AdminField
            label="所属系统"
            required
            help={isEdit ? '编辑态不允许更改菜单所属系统。' : '建议按真实业务边界归属到对应系统。'}
          >
            <Select
              selectedKey={systemId || null}
              onSelectionChange={(key) => setValue('systemId', key as string)}
              isDisabled={isEdit}
            >
              <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectPopover>
                <ListBox>
                  {systems.map((sys) => (
                    <ListBoxItem key={sys.id} id={sys.id}>
                      {sys.name}
                    </ListBoxItem>
                  ))}
                </ListBox>
              </SelectPopover>
            </Select>
          </AdminField>

          {systemId && (
            <AdminField label="上级菜单" help="只在当前系统内选择父级菜单。">
              <Select
                selectedKey={watch('parentId') || 'root'}
                onSelectionChange={(key) => setValue('parentId', key === 'root' ? '' : (key as string))}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    <ListBoxItem id="root">无（根菜单）</ListBoxItem>
                    {filteredMenus.map((menu) => (
                      <ListBoxItem key={menu.id} id={menu.id} textValue={menu.name}>
                        {menu.parentId ? '└─ ' : ''}{menu.name}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </SelectPopover>
              </Select>
            </AdminField>
          )}
        </AdminDrawerSection>

        <AdminDrawerSection title="基本信息" description="定义菜单名称、编码与路由路径。">
          <AdminField label="菜单名称" required htmlFor="name" error={errors.name?.message}>
            <input
              id="name"
              {...register('name', { required: '请输入菜单名称' })}
              placeholder="如：用户管理"
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.name}
            />
          </AdminField>

          <AdminField
            label="菜单编码"
            required
            htmlFor="code"
            error={errors.code?.message}
            help={isEdit ? '菜单编码创建后不可修改。' : '建议使用稳定的英文编码，便于后续关联权限。'}
          >
            <input
              id="code"
              {...register('code', {
                required: '请输入菜单编码',
                pattern: {
                  value: /^[a-z0-9-]+$/,
                  message: '只能包含小写字母、数字和连字符',
                },
              })}
              placeholder="如：user-management"
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              disabled={isEdit}
              aria-invalid={!!errors.code}
            />
          </AdminField>

          <AdminField
            label="路由路径"
            required
            htmlFor="path"
            error={errors.path?.message}
            help={errors.path?.message ? undefined : '建议与实际页面路由保持一致。'}
          >
            <input
              id="path"
              {...register('path', {
                required: '请输入路由路径',
                pattern: {
                  value: /^\/[a-z0-9-/]*$/,
                  message: '必须以/开头，只能包含小写字母、数字、连字符和斜杠',
                },
              })}
              placeholder="如：/users"
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              aria-invalid={!!errors.path}
            />
          </AdminField>
        </AdminDrawerSection>

        <AdminDrawerSection title="展示设置" description="控制菜单的排序、图标与前台可见性。">
          <AdminFieldGroup columns={2}>
            <AdminField label="图标">
              <Select
                selectedKey={icon || 'Menu'}
                onSelectionChange={(key) => setValue('icon', key as string)}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    {ICON_OPTIONS.map((iconName) => (
                      <ListBoxItem key={iconName} id={iconName}>
                        {iconName}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </SelectPopover>
              </Select>
            </AdminField>

            <AdminField label="可见性" required>
              <Select
                selectedKey={visible ? 'true' : 'false'}
                onSelectionChange={(key) => setValue('visible', key === 'true')}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    <ListBoxItem id="true">显示</ListBoxItem>
                    <ListBoxItem id="false">隐藏</ListBoxItem>
                  </ListBox>
                </SelectPopover>
              </Select>
            </AdminField>
          </AdminFieldGroup>

          <AdminField
            label="排序号"
            required
            htmlFor="sort"
            error={errors.sort?.message}
            help={errors.sort?.message ? undefined : '数字越小越靠前。'}
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
        </AdminDrawerSection>
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
