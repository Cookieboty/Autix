'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from '@heroui/react';
import { Button, Input } from '@heroui/react';
import { Label } from '@heroui/react';
import { Select, SelectTrigger, SelectValue, SelectPopover, ListBox, ListBoxItem } from '@heroui/react';
import { AlertCircle, Menu as MenuIcon } from 'lucide-react';

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

  const filteredMenus = menus.filter(m => m.systemId === systemId && m.id !== initialData?.id);

  return (
    <Drawer {...({ isOpen: open, onClose: onClose, className: "w-[500px] sm:max-w-[500px]" } as any)}>
      <DrawerContent placement="right">
        <DrawerHeader className="px-6 py-5 border-b bg-surface-secondary flex-shrink-0">
          <div className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-surface shadow-sm">
              <MenuIcon className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-foreground">{isEdit ? '编辑菜单' : '新增菜单'}</div>
              <div className="text-sm font-normal text-muted mt-0.5">
                {isEdit ? '修改菜单基本信息' : '创建一个新的系统菜单'}
              </div>
            </div>
          </div>
        </DrawerHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 min-h-0">
          <DrawerBody className="px-6 py-5 space-y-5 overflow-y-auto min-h-0">
            {/* System */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                所属系统 <span className="text-danger">*</span>
              </Label>
              <Select
                selectedKey={systemId || null}
                onSelectionChange={(key) => setValue('systemId', key as string)}
                isDisabled={isEdit}
              >
                <SelectTrigger>
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
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                菜单名称 <span className="text-danger">*</span>
              </Label>
              <Input
                id="name"
                {...register('name', { required: '请输入菜单名称' })}
                placeholder="如：用户管理"
                {...({ isInvalid: !!errors.name } as any)}
                errorMessage={errors.name?.message}
              />
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-sm font-medium text-foreground">
                菜单编码 <span className="text-danger">*</span>
              </Label>
              <Input
                id="code"
                {...register('code', {
                  required: '请输入菜单编码',
                  pattern: {
                    value: /^[a-z0-9-]+$/,
                    message: '只能包含小写字母、数字和连字符',
                  },
                })}
                placeholder="如：user-management"
                className="font-mono"
                isDisabled={isEdit}
                {...({ isInvalid: !!errors.code } as any)}
                errorMessage={errors.code?.message}
              />
            </div>

            {/* Path */}
            <div className="space-y-1.5">
              <Label htmlFor="path" className="text-sm font-medium text-foreground">
                路由路径 <span className="text-danger">*</span>
              </Label>
              <Input
                id="path"
                {...register('path', {
                  required: '请输入路由路径',
                  pattern: {
                    value: /^\/[a-z0-9-/]*$/,
                    message: '必须以/开头，只能包含小写字母、数字、连字符和斜杠',
                  },
                })}
                placeholder="如：/users"
                className="font-mono"
                {...({ isInvalid: !!errors.path } as any)}
                errorMessage={errors.path?.message}
              />
            </div>

            {/* Icon */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">图标</Label>
              <Select
                selectedKey={icon || 'Menu'}
                onSelectionChange={(key) => setValue('icon', key as string)}
              >
                <SelectTrigger>
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
            </div>

            {/* Parent Menu */}
            {systemId && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">上级菜单</Label>
                <Select
                  selectedKey={watch('parentId') || 'root'}
                  onSelectionChange={(key) => setValue('parentId', key === 'root' ? '' : (key as string))}
                >
                  <SelectTrigger>
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
              </div>
            )}

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
                {...({ isInvalid: !!errors.sort } as any)}
                errorMessage={errors.sort?.message}
              />
            </div>

            {/* Visible */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                可见性 <span className="text-danger">*</span>
              </Label>
              <Select
                selectedKey={visible ? 'true' : 'false'}
                onSelectionChange={(key) => setValue('visible', key === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    <ListBoxItem id="true">显示</ListBoxItem>
                    <ListBoxItem id="false">隐藏</ListBoxItem>
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
                {isSubmitting ? '保存中...' : isEdit ? '保存修改' : '创建菜单'}
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
