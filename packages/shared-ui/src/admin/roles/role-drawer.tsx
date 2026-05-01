'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Button } from '@heroui/react';
import { Shield } from 'lucide-react';
import { userApi as api } from '@autix/shared-lib';
import {
  AdminDrawerBody,
  AdminDrawerError,
  AdminDrawerFooter,
  AdminDrawerHero,
  AdminDrawerMeta,
  AdminDrawerSection,
  AdminDrawerShell,
  AdminField,
  AdminFieldGroup,
  adminInputClassName,
  adminInputStyle,
} from '../../admin-drawer-shell';

interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  sort: number;
}

interface RoleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  onSuccess: () => void;
}

interface RoleForm {
  name: string;
  code: string;
  description?: string;
  sort?: number;
}

export function RoleDrawer({ open, onOpenChange, role, onSuccess }: RoleDrawerProps) {
  const t = useTranslations('roles');
  const isEdit = !!role;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleForm>();

  useEffect(() => {
    if (open) {
      reset(
        role
          ? { name: role.name, code: role.code, description: role.description || '', sort: role.sort }
          : { name: '', code: '', description: '', sort: 0 }
      );
      setError('');
    }
  }, [open, role, reset]);

  const onSubmit = async (data: RoleForm) => {
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await api.patch(`/roles/${role!.id}`, data);
      } else {
        await api.post('/roles', data);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || t('drawerOperationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      width="sm"
      header={
        <AdminDrawerHero
          icon={<Shield className="h-5 w-5" />}
          eyebrow={isEdit ? t('drawerEditEyebrow') : t('drawerCreateEyebrow')}
          title={isEdit ? role!.name : t('drawerCreateTitle')}
          description={isEdit ? t('drawerEditDescription') : t('drawerCreateDescription')}
          meta={<AdminDrawerMeta tone={isEdit ? 'accent' : 'default'}>{isEdit ? t('drawerEditMode') : t('drawerNewMode')}</AdminDrawerMeta>}
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? t('drawerEditAside') : t('drawerCreateAside')}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-w-[88px] cursor-pointer text-sm font-medium"
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit(onSubmit)}
                {...({ isLoading: loading } as any)}
                className="min-w-[120px] cursor-pointer text-sm font-medium shadow-sm"
              >
                {loading ? t('drawerSaving') : isEdit ? t('drawerSaveChanges') : t('drawerCreateRole')}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        {error && <AdminDrawerError>{error}</AdminDrawerError>}

        <AdminDrawerSection title={t('drawerBasicInfo')} description={t('drawerBasicInfoDescription')}>
          <AdminField
            label={t('drawerRoleName')}
            required
            error={errors.name?.message}
          >
            <input
              {...register('name', { required: t('drawerRoleNameRequired') })}
              placeholder={t('drawerRoleNamePlaceholder')}
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.name}
            />
          </AdminField>

          <AdminFieldGroup template="minmax(0,1fr) 144px">
            <AdminField
              label={t('drawerRoleCode')}
              required
              error={errors.code?.message}
              help={
                isEdit
                  ? t('drawerRoleCodeReadonly')
                  : t('drawerRoleCodeHelp')
              }
            >
              <input
                {...register('code', { required: t('drawerRoleCodeRequired') })}
                disabled={isEdit}
                placeholder={t('drawerRoleCodePlaceholder')}
                className={`${adminInputClassName} font-mono`}
                style={adminInputStyle}
                aria-invalid={!!errors.code}
              />
            </AdminField>

            <AdminField label={t('drawerSort')} help={t('drawerSortHelp')}>
              <input
                type="number"
                {...register('sort', { valueAsNumber: true })}
                defaultValue={0}
                className={adminInputClassName}
                style={adminInputStyle}
              />
            </AdminField>
          </AdminFieldGroup>

          <AdminField label={t('drawerDescription')}>
            <input
              {...register('description')}
              placeholder={t('drawerDescriptionPlaceholder')}
              className={adminInputClassName}
              style={adminInputStyle}
            />
          </AdminField>
        </AdminDrawerSection>
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
