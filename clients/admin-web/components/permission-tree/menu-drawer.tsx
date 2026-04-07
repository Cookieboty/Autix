'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] flex flex-col p-0 h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gradient-to-r from-teal-50 to-green-50 flex-shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <MenuIcon className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <div className="text-gray-900">{isEdit ? '编辑菜单' : '新增菜单'}</div>
                <div className="text-sm font-normal text-gray-500 mt-0.5">
                  {isEdit ? '修改菜单基本信息' : '创建一个新的系统菜单'}
                </div>
              </div>
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto min-h-0">
            {/* System */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                所属系统 <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={systemId} 
                onValueChange={(value) => setValue('systemId', value)}
                disabled={isEdit}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="选择系统" />
                </SelectTrigger>
                <SelectContent>
                  {systems.map((sys) => (
                    <SelectItem key={sys.id} value={sys.id}>
                      {sys.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                菜单名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                {...register('name', { required: '请输入菜单名称' })}
                placeholder="如：用户管理"
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
                菜单编码 <span className="text-red-500">*</span>
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

            {/* Path */}
            <div className="space-y-1.5">
              <Label htmlFor="path" className="text-sm font-medium text-gray-700">
                路由路径 <span className="text-red-500">*</span>
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
                className="h-10 font-mono"
              />
              {errors.path && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.path.message}
                </p>
              )}
            </div>

            {/* Icon */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">图标</Label>
              <Select value={icon} onValueChange={(value) => setValue('icon', value)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((iconName) => (
                    <SelectItem key={iconName} value={iconName}>
                      {iconName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parent Menu */}
            {systemId && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">上级菜单</Label>
                <Select
                  value={watch('parentId') || 'root'}
                  onValueChange={(value) => setValue('parentId', value === 'root' ? '' : value)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">无（根菜单）</SelectItem>
                    {filteredMenus.map((menu) => (
                      <SelectItem key={menu.id} value={menu.id}>
                        {menu.parentId ? '└─ ' : ''}{menu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                className="h-10"
              />
              {errors.sort && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.sort.message}
                </p>
              )}
            </div>

            {/* Visible */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                可见性 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={visible ? 'true' : 'false'}
                onValueChange={(value) => setValue('visible', value === 'true')}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">显示</SelectItem>
                  <SelectItem value="false">隐藏</SelectItem>
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
                {isSubmitting ? '保存中...' : isEdit ? '保存修改' : '创建菜单'}
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
