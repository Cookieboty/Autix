'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('permission');
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
          eyebrow={isEdit ? t('sysEditEyebrow') : t('sysCreateEyebrow')}
          title={isEdit ? initialData?.name || t('sysEditEyebrow') : t('sysCreateTitle')}
          description={isEdit ? t('sysEditDescription') : t('sysCreateDescription')}
          meta={<AdminDrawerMeta tone={status === 'ACTIVE' ? 'success' : 'default'}>{status === 'ACTIVE' ? t('sysActiveStatus') : t('sysDisabledStatus')}</AdminDrawerMeta>}
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? t('sysEditAside') : t('sysCreateAside')}
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
                variant="primary"
                onClick={handleSubmit(handleFormSubmit)}
                {...({ isLoading: isSubmitting } as any)}
                className="min-w-[120px] cursor-pointer text-sm font-medium shadow-sm"
              >
                {isSubmitting ? t('saving') : isEdit ? t('saveChanges') : t('sysCreateBtn')}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        <AdminDrawerSection title={t('sysBasicInfo')} description={t('sysBasicInfoDescription')}>
          <AdminField label={t('sysName')} required htmlFor="name" error={errors.name?.message}>
            <input
              id="name"
              {...register('name', { required: t('sysNameRequired') })}
              placeholder={t('sysNamePlaceholder')}
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.name}
            />
          </AdminField>

          <AdminField
            label={t('sysCode')}
            required
            htmlFor="code"
            error={errors.code?.message}
            help={isEdit ? t('sysCodeReadonly') : t('sysCodeHelp')}
          >
            <input
              id="code"
              {...register('code', {
                required: t('sysCodeRequired'),
                pattern: {
                  value: /^[a-z0-9-]+$/,
                  message: t('sysCodePattern'),
                },
              })}
              placeholder={t('sysCodePlaceholder')}
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              disabled={isEdit}
              aria-invalid={!!errors.code}
            />
          </AdminField>

          <AdminField
            label={t('sysDescription')}
            htmlFor="description"
            help={t('sysDescriptionHelp')}
          >
            <textarea
              id="description"
              {...register('description')}
              placeholder={t('sysDescriptionPlaceholder')}
              rows={4}
              className={`${adminTextareaClassName} min-h-[120px]`}
              style={adminInputStyle}
            />
          </AdminField>
        </AdminDrawerSection>

        <AdminDrawerSection title={t('sysStatusSection')} description={t('sysStatusSectionDesc')}>
          <AdminFieldGroup template="minmax(0,1fr) 144px">
            <AdminField label={t('sysStatus')} required htmlFor="status">
              <Select
                selectedKey={status}
                onSelectionChange={(key) => setValue('status', key as 'ACTIVE' | 'INACTIVE')}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    <ListBoxItem id="ACTIVE" textValue={t('statusActive')}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                        <span>{t('statusActive')}</span>
                      </div>
                    </ListBoxItem>
                    <ListBoxItem id="INACTIVE" textValue={t('statusDisabled')}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                        <span>{t('statusDisabled')}</span>
                      </div>
                    </ListBoxItem>
                  </ListBox>
                </SelectPopover>
              </Select>
            </AdminField>

            <AdminField
              label={t('sysSortOrder')}
              required
              htmlFor="sort"
              error={errors.sort?.message}
              help={errors.sort?.message ? undefined : t('sysSortHelp')}
            >
              <input
                id="sort"
                type="number"
                {...register('sort', {
                  required: t('sysSortRequired'),
                  valueAsNumber: true,
                  min: { value: 1, message: t('sysSortMin') },
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
