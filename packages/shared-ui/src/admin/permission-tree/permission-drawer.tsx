'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Button } from '../../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
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
} from '../../admin-drawer-shell';

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

export function PermissionDrawer({
  open,
  onClose,
  onSubmit,
  initialData,
  isEdit,
  menuId: propMenuId,
  systemMenus,
}: PermissionDrawerProps) {
  const t = useTranslations('permission');

  const ACTION_OPTIONS = [
    { value: 'CREATE', label: t('actionCreate') },
    { value: 'READ', label: t('actionRead') },
    { value: 'UPDATE', label: t('actionUpdate') },
    { value: 'DELETE', label: t('actionDelete') },
    { value: 'EXPORT', label: t('actionExport') },
    { value: 'IMPORT', label: t('actionImport') },
  ];

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
          eyebrow={isEdit ? t('permEditEyebrow') : t('permCreateEyebrow')}
          title={isEdit ? initialData?.name || t('permEditEyebrow') : t('permCreateTitle')}
          description={isEdit ? t('permEditDescription') : t('permCreateDescription')}
          meta={<AdminDrawerMeta tone={type === 'FRONTEND' ? 'accent' : 'success'}>{type === 'FRONTEND' ? t('frontendPermission') : t('backendPermission')}</AdminDrawerMeta>}
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? t('editAside') : t('createAside')}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="min-w-[88px] cursor-pointer text-sm font-medium"
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit(handleFormSubmit)}
                disabled={isSubmitting}
                className="min-w-[120px] cursor-pointer text-sm font-medium shadow-sm"
              >
                {isSubmitting ? t('saving') : isEdit ? t('saveChanges') : t('permCreateBtn')}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        <AdminDrawerSection title={t('belongSection')} description={t('belongDescription')}>
          <AdminField
            label={t('parentMenu')}
            required
            help={isEdit ? t('parentMenuEditHelp') : t('parentMenuCreateHelp')}
          >
            <Select
              value={menuId || ''}
              onValueChange={(val) => setValue('menuId', val)}
              disabled={isEdit}
            >
              <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {systemMenus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id}>
                    {menu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AdminField>
        </AdminDrawerSection>

        <AdminDrawerSection title={t('basicInfo')} description={t('basicInfoDescription')}>
          <AdminField label={t('permissionName')} required htmlFor="name" error={errors.name?.message}>
            <input
              id="name"
              {...register('name', { required: t('permissionNameRequired') })}
              placeholder={t('permissionNamePlaceholder')}
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.name}
            />
          </AdminField>

          <AdminField
            label={t('permissionCode')}
            required
            htmlFor="code"
            error={errors.code?.message}
            help={isEdit ? t('permissionCodeReadonly') : t('permissionCodeHelp')}
          >
            <input
              id="code"
              {...register('code', {
                required: t('permissionCodeRequired'),
                pattern: {
                  value: /^[a-z0-9:-]+$/,
                  message: t('permissionCodePattern'),
                },
              })}
              placeholder={t('permissionCodePlaceholder')}
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              disabled={isEdit}
              aria-invalid={!!errors.code}
            />
          </AdminField>

          <AdminField label={t('permissionDescription')} htmlFor="description" help={t('permissionDescriptionHelp')}>
            <textarea
              id="description"
              {...register('description')}
              placeholder={t('permissionDescriptionPlaceholder')}
              rows={4}
              className={`${adminTextareaClassName} min-h-[112px]`}
              style={adminInputStyle}
            />
          </AdminField>
        </AdminDrawerSection>

        <AdminDrawerSection title={t('semanticSection')} description={t('semanticDescription')}>
          <AdminFieldGroup columns={2}>
            <AdminField label={t('permissionType')} required>
              <Select
                value={type}
                onValueChange={(val) => setValue('type', val as 'FRONTEND' | 'BACKEND')}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRONTEND">{t('frontendPermission')}</SelectItem>
                  <SelectItem value="BACKEND">{t('backendPermission')}</SelectItem>
                </SelectContent>
              </Select>
            </AdminField>

            <AdminField label={t('actionType')} required>
              <Select
                value={action}
                onValueChange={(val) => setValue('action', val as 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT')}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
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
            </AdminField>
          </AdminFieldGroup>
        </AdminDrawerSection>
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
