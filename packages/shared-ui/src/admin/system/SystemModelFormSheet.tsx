import type { ReactNode } from 'react';
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
} from '../../ui';
import {
  CAPABILITY_OPTIONS,
  MODEL_TYPES,
  type SystemModelForm,
} from './system-models-helpers';

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;
type CommonTranslate = (key: string) => string;

export function SystemModelFormSheet({
  form,
  open,
  saving,
  t,
  tCommon,
  onClose,
  onFormChange,
  onSave,
}: {
  form: SystemModelForm;
  open: boolean;
  saving: boolean;
  t: Translate;
  tCommon: CommonTranslate;
  onClose: () => void;
  onFormChange: (form: SystemModelForm) => void;
  onSave: () => void;
}) {
  const setFormField = <K extends keyof SystemModelForm>(key: K, value: SystemModelForm[K]) => {
    onFormChange({ ...form, [key]: value });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent side="right" className="flex w-[460px] flex-col gap-0 p-0 sm:max-w-[460px]">
        <SheetHeader className="border-border h-14 flex-row items-center border-b px-6 py-0">
          <SheetTitle className="text-sm">{form.id ? t('editModel') : t('addModel')}</SheetTitle>
          <SheetDescription className="sr-only">
            {form.id ? t('editDescription') : t('createDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label={t('fieldName')} description={t('fieldNameDescription')}>
            <Input
              aria-label={t('fieldName')}
              type="text"
              value={form.name}
              onChange={(event) => setFormField('name', event.target.value)}
              placeholder={form.model || 'GPT-4o'}
            />
          </Field>
          <Field label={t('fieldModelName')}>
            <Input
              aria-label={t('fieldModelName')}
              type="text"
              value={form.model}
              onChange={(event) => setFormField('model', event.target.value)}
              placeholder="gpt-4o"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('fieldProvider')}>
              <Input
                aria-label={t('fieldProvider')}
                type="text"
                value={form.provider}
                onChange={(event) => setFormField('provider', event.target.value)}
                placeholder="openai"
              />
            </Field>
            <Field label={t('fieldType')}>
              <Select value={form.type} onValueChange={(value) => setFormField('type', value)}>
                <SelectTrigger aria-label={t('fieldType')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={t('fieldBaseUrl')}>
            <Input
              aria-label={t('fieldBaseUrl')}
              type="text"
              value={form.baseUrl}
              onChange={(event) => setFormField('baseUrl', event.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </Field>
          <Field label={t('fieldApiKey')}>
            <Input
              aria-label={t('fieldApiKey')}
              type="password"
              value={form.apiKey}
              onChange={(event) => setFormField('apiKey', event.target.value)}
              placeholder={form.id ? t('apiKeyPlaceholderEdit') : 'sk-...'}
            />
          </Field>
          <Field label={t('fieldPriority')}>
            <Input
              aria-label={t('fieldPriority')}
              type="number"
              value={String(form.priority)}
              onChange={(event) =>
                setFormField('priority', Number.parseInt(event.target.value, 10) || 0)
              }
            />
          </Field>
          <Field label={t('fieldCapabilities')}>
            <div className="flex flex-wrap gap-2">
              {CAPABILITY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={form.capabilities.includes(option.value) ? 'default' : 'ghost'}
                  className="text-xs"
                  onClick={() => {
                    const nextCapabilities = form.capabilities.includes(option.value)
                      ? form.capabilities.filter((item) => item !== option.value)
                      : [...form.capabilities, option.value];
                    setFormField('capabilities', nextCapabilities);
                  }}
                >
                  {t(`capabilities.${option.key}`)}
                </Button>
              ))}
            </div>
          </Field>
          <div className="space-y-3 pt-1">
            <CheckboxField
              id="system-model-default"
              checked={form.isDefault}
              label={t('setDefault')}
              description={t('setDefaultDescription')}
              onChange={(checked) => setFormField('isDefault', checked)}
            />
            <CheckboxField
              id="system-model-active"
              checked={form.isActive}
              label={t('enableModel')}
              description={t('enableModelDescription')}
              onChange={(checked) => setFormField('isActive', checked)}
            />
          </div>
        </div>

        <SheetFooter className="border-border flex-row items-center justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" size="sm" disabled={!form.model.trim() || saving} onClick={onSave}>
            {saving ? tCommon('saving') : form.id ? tCommon('save') : tCommon('create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-muted-foreground block text-xs font-medium">{label}</label>
      {children}
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
    </div>
  );
}

function CheckboxField({
  id,
  checked,
  label,
  description,
  onChange,
}: {
  id: string;
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />
        <label htmlFor={id} className="cursor-pointer text-sm">
          {label}
        </label>
      </div>
      <p className="text-muted-foreground ml-6 mt-1 text-xs">{description}</p>
    </div>
  );
}
