'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '../../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import { Menu as MenuIcon, ChevronDown, ChevronRight } from 'lucide-react';
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
} from '../../admin-drawer-shell';

interface MenuFormData {
  systemId: string;
  name: string;
  code: string;
  path: string;
  icon?: string;
  parentId?: string;
  sort: number;
  visible: boolean;
  nameEn?: string;
  nameZhTW?: string;
  nameFr?: string;
  nameJa?: string;
  nameRu?: string;
  nameVi?: string;
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
  const t = useTranslations('permission');
  const [i18nExpanded, setI18nExpanded] = useState(false);

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
        nameEn: '',
        nameZhTW: '',
        nameFr: '',
        nameJa: '',
        nameRu: '',
        nameVi: '',
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
          eyebrow={isEdit ? t('menuEditEyebrow') : t('menuCreateEyebrow')}
          title={isEdit ? initialData?.name || t('menuEditEyebrow') : t('menuCreateTitle')}
          description={isEdit ? t('menuEditDescription') : t('menuCreateDescription')}
          meta={<AdminDrawerMeta tone={visible ? 'success' : 'default'}>{visible ? t('menuShowing') : t('menuHiddenStatus')}</AdminDrawerMeta>}
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? t('menuEditAside') : t('menuCreateAside')}
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
                {isSubmitting ? t('saving') : isEdit ? t('saveChanges') : t('menuCreateBtn')}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        <AdminDrawerSection title={t('menuBelongSection')} description={t('menuBelongDescription')}>
          <AdminField
            label={t('menuParentSystem')}
            required
            help={isEdit ? t('menuSystemEditHelp') : t('menuSystemCreateHelp')}
          >
            <Select
              value={systemId || ''}
              onValueChange={(val) => setValue('systemId', val)}
              disabled={isEdit}
            >
              <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {systems.map((sys) => (
                  <SelectItem key={sys.id} value={sys.id}>
                    {sys.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AdminField>

          {systemId && (
            <AdminField label={t('menuParentMenu')} help={t('menuParentMenuHelp')}>
              <Select
                value={watch('parentId') || 'root'}
                onValueChange={(val) => setValue('parentId', val === 'root' ? '' : val)}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">{t('menuRootMenu')}</SelectItem>
                  {filteredMenus.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>
                      {menu.parentId ? '└─ ' : ''}{menu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminField>
          )}
        </AdminDrawerSection>

        <AdminDrawerSection title={t('menuBasicInfo')} description={t('menuBasicInfoDescription')}>
          <AdminField label={t('menuName')} required htmlFor="name" error={errors.name?.message}>
            <input
              id="name"
              {...register('name', { required: t('menuNameRequired') })}
              placeholder={t('menuNamePlaceholder')}
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.name}
            />
          </AdminField>

          <AdminField
            label={t('menuCode')}
            required
            htmlFor="code"
            error={errors.code?.message}
            help={isEdit ? t('menuCodeReadonly') : t('menuCodeHelp')}
          >
            <input
              id="code"
              {...register('code', {
                required: t('menuCodeRequired'),
                pattern: {
                  value: /^[a-z0-9-]+$/,
                  message: t('menuCodePattern'),
                },
              })}
              placeholder={t('menuCodePlaceholder')}
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              disabled={isEdit}
              aria-invalid={!!errors.code}
            />
          </AdminField>

          <AdminField
            label={t('routePath')}
            required
            htmlFor="path"
            error={errors.path?.message}
            help={errors.path?.message ? undefined : t('routePathHelp')}
          >
            <input
              id="path"
              {...register('path', {
                required: t('routePathRequired'),
                pattern: {
                  value: /^\/[a-z0-9-/]*$/,
                  message: t('routePathPattern'),
                },
              })}
              placeholder={t('routePathPlaceholder')}
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              aria-invalid={!!errors.path}
            />
          </AdminField>
        </AdminDrawerSection>

        <AdminDrawerSection title={t('menuDisplaySettings')} description={t('menuDisplaySettingsDesc')}>
          <AdminFieldGroup columns={2}>
            <AdminField label={t('menuIcon')}>
              <Select
                value={icon || 'Menu'}
                onValueChange={(val) => setValue('icon', val)}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
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
            </AdminField>

            <AdminField label={t('menuVisibility')} required>
              <Select
                value={visible ? 'true' : 'false'}
                onValueChange={(val) => setValue('visible', val === 'true')}
              >
                <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{t('menuVisible')}</SelectItem>
                  <SelectItem value="false">{t('menuHidden')}</SelectItem>
                </SelectContent>
              </Select>
            </AdminField>
          </AdminFieldGroup>

          <AdminField
            label={t('menuSortOrder')}
            required
            htmlFor="sort"
            error={errors.sort?.message}
            help={errors.sort?.message ? undefined : t('menuSortHelp')}
          >
            <input
              id="sort"
              type="number"
              {...register('sort', {
                required: t('menuSortRequired'),
                valueAsNumber: true,
                min: { value: 1, message: t('menuSortMin') },
              })}
              placeholder="1"
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.sort}
            />
          </AdminField>
        </AdminDrawerSection>

        <section className="space-y-4">
          <button
            type="button"
            onClick={() => setI18nExpanded(!i18nExpanded)}
            className="flex w-full cursor-pointer items-center gap-2 text-left"
          >
            {i18nExpanded ? (
              <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted)' }} />
            ) : (
              <ChevronRight className="h-4 w-4" style={{ color: 'var(--muted)' }} />
            )}
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('menuMultilingualNames')}
            </h3>
          </button>
          {i18nExpanded && (
            <div className="space-y-4">
              <AdminField label={t('menuNameEnglish')} htmlFor="nameEn">
                <input
                  id="nameEn"
                  {...register('nameEn')}
                  placeholder={t('menuNameEnglishPlaceholder')}
                  className={adminInputClassName}
                  style={adminInputStyle}
                />
              </AdminField>
              <AdminField label={t('menuNameTraditionalChinese')} htmlFor="nameZhTW">
                <input
                  id="nameZhTW"
                  {...register('nameZhTW')}
                  placeholder={t('menuNameTraditionalChinesePlaceholder')}
                  className={adminInputClassName}
                  style={adminInputStyle}
                />
              </AdminField>
              <AdminField label={t('menuNameFrench')} htmlFor="nameFr">
                <input
                  id="nameFr"
                  {...register('nameFr')}
                  placeholder={t('menuNameFrenchPlaceholder')}
                  className={adminInputClassName}
                  style={adminInputStyle}
                />
              </AdminField>
              <AdminField label={t('menuNameJapanese')} htmlFor="nameJa">
                <input
                  id="nameJa"
                  {...register('nameJa')}
                  placeholder={t('menuNameJapanesePlaceholder')}
                  className={adminInputClassName}
                  style={adminInputStyle}
                />
              </AdminField>
              <AdminField label={t('menuNameRussian')} htmlFor="nameRu">
                <input
                  id="nameRu"
                  {...register('nameRu')}
                  placeholder={t('menuNameRussianPlaceholder')}
                  className={adminInputClassName}
                  style={adminInputStyle}
                />
              </AdminField>
              <AdminField label={t('menuNameVietnamese')} htmlFor="nameVi">
                <input
                  id="nameVi"
                  {...register('nameVi')}
                  placeholder={t('menuNameVietnamesePlaceholder')}
                  className={adminInputClassName}
                  style={adminInputStyle}
                />
              </AdminField>
            </div>
          )}
        </section>
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
