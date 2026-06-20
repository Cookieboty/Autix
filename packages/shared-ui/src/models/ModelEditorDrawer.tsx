'use client';

import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../ui';
import {
  CAPABILITY_KEYS,
  type EditingModel,
  type ModelsDrawerMode,
  type ModelsViewVariant,
  variantClasses,
} from './model-editing';

interface ModelEditorDrawerProps {
  open: boolean;
  mode: ModelsDrawerMode;
  editing: EditingModel;
  onEditingChange: (model: EditingModel) => void;
  onClose: () => void;
  onSave: () => void;
  modelTypeOptions: readonly string[];
  variant: ModelsViewVariant;
}

export function ModelEditorDrawer({
  open,
  mode,
  editing,
  onEditingChange,
  onClose,
  onSave,
  modelTypeOptions,
  variant,
}: ModelEditorDrawerProps) {
  const t = useTranslations('models');
  const title = editing.id ? t('editModel') : t('addModel');
  const body = (
    <ModelDrawerBody
      editing={editing}
      onEditingChange={onEditingChange}
      modelTypeOptions={modelTypeOptions}
      variant={variant}
    />
  );
  const footer = (
    <>
      <Button variant="ghost" size="sm" onClick={onClose}>
        {t('cancelLabel')}
      </Button>
      <Button size="sm" disabled={!editing.model} onClick={onSave}>
        {editing.id ? t('saveLabel') : t('createLabel')}
      </Button>
    </>
  );

  if (mode === 'sheet') {
    return (
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
      >
        <SheetContent
          side="right"
          className="flex w-[460px] flex-col gap-0 p-0 sm:max-w-[460px]"
        >
          <SheetHeader className="h-14 flex-row items-center justify-between border-b border-border px-6 py-0">
            <SheetTitle className="text-sm">{title}</SheetTitle>
            <SheetDescription className="sr-only">{title}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {body}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <OverlayDrawer open={open} title={title} onClose={onClose} footer={footer}>
      {body}
    </OverlayDrawer>
  );
}

function ModelDrawerBody({
  editing,
  onEditingChange,
  modelTypeOptions,
  variant,
}: {
  editing: EditingModel;
  onEditingChange: (model: EditingModel) => void;
  modelTypeOptions: readonly string[];
  variant: ModelsViewVariant;
}) {
  const t = useTranslations('models');
  const classes = variantClasses[variant];

  return (
    <>
      <Field label={t('fieldName')} description={t('nameHelperText')} variant={variant}>
        <Input
          aria-label={t('fieldName')}
          value={editing.name}
          onChange={(e) => onEditingChange({ ...editing, name: e.target.value })}
          placeholder={editing.model || t('namePlaceholder')}
        />
      </Field>
      <Field label={t('fieldModelName')} variant={variant}>
        <Input
          aria-label={t('fieldModelName')}
          value={editing.model}
          onChange={(e) => onEditingChange({ ...editing, model: e.target.value })}
          placeholder="gpt-4o"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('fieldProvider')} variant={variant}>
          <Input
            aria-label={t('fieldProvider')}
            value={editing.provider}
            onChange={(e) => onEditingChange({ ...editing, provider: e.target.value })}
            placeholder="amux"
          />
        </Field>
        <Field label={t('fieldType')} variant={variant}>
          <HeroSelect
            label={t('fieldType')}
            value={editing.type}
            onChange={(value) => onEditingChange({ ...editing, type: value })}
            options={modelTypeOptions.map((option) => ({ value: option, label: option }))}
          />
        </Field>
      </div>
      <Field label="Base URL" variant={variant}>
        <Input
          aria-label="Base URL"
          value={editing.baseUrl}
          onChange={(e) => onEditingChange({ ...editing, baseUrl: e.target.value })}
          placeholder="https://api.amux.ai/v1"
        />
      </Field>
      <Field label="API Key" variant={variant}>
        <Input
          aria-label="API Key"
          type="password"
          value={editing.apiKey}
          onChange={(e) => onEditingChange({ ...editing, apiKey: e.target.value })}
          placeholder={editing.id ? t('apiKeyPlaceholderEdit') : 'sk-...'}
        />
      </Field>
      <Field label={t('fieldPriority')} variant={variant}>
        <Input
          aria-label={t('fieldPriority')}
          type="number"
          value={String(editing.priority)}
          onChange={(e) =>
            onEditingChange({ ...editing, priority: parseInt(e.target.value) || 0 })
          }
        />
      </Field>
      <Field label={t('fieldCapabilities')} variant={variant}>
        <div className="flex flex-wrap gap-2">
          {CAPABILITY_KEYS.map(({ value, key }) => (
            <Button
              key={value}
              size="sm"
              variant={editing.capabilities.includes(value) ? 'default' : 'ghost'}
              onClick={() => {
                const capabilities = editing.capabilities.includes(value)
                  ? editing.capabilities.filter((capability) => capability !== value)
                  : [...editing.capabilities, value];
                onEditingChange({ ...editing, capabilities });
              }}
              className="text-xs"
            >
              {t(key)}
            </Button>
          ))}
        </div>
      </Field>
      <div className="pt-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="isDefault"
            checked={editing.isDefault}
            onCheckedChange={(checked) => onEditingChange({ ...editing, isDefault: !!checked })}
          />
          <label htmlFor="isDefault" className="cursor-pointer text-sm">
            {t('setDefaultModel')}
          </label>
        </div>
        <p className={`ml-6 mt-1 ${classes.helperText}`}>{t('defaultTypeHint')}</p>
      </div>
    </>
  );
}

function OverlayDrawer({
  open,
  title,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations('models');

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={onClose}>
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}

      <div
        className="fixed top-0 right-0 z-50 h-full flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: '460px',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          backgroundColor: 'var(--panel, #1a1a1a)',
          borderLeft: '1px solid var(--border)',
          boxShadow: open ? '-8px 0 30px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <Button
            size="sm"
            variant="ghost"
            className="p-0 w-8 h-8"
            aria-label={t('closeLabel')}
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {children}
        </div>

        <div className="flex items-center justify-end gap-2 flex-shrink-0 px-6 py-4 border-t border-default">
          {footer}
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  description,
  children,
  variant,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  variant: ModelsViewVariant;
}) {
  const classes = variantClasses[variant];

  return (
    <div className="space-y-1.5">
      <label className={classes.fieldLabel}>{label}</label>
      <div>{children}</div>
      {description && <p className={classes.helperText}>{description}</p>}
    </div>
  );
}

function HeroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
