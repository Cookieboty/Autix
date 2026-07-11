import { useRef, type ReactNode } from 'react';
import type { DryRunResult, MembershipLevel } from '@autix/shared-store';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@autix/i18n';
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
import { ModelSchemaEditor } from '../pricing/model-schema-editor';
import type { buildDryRunPayload } from '../pricing/pricing-admin-helpers';
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
  membershipLevels,
  membershipLevelsLoading,
  t,
  tCommon,
  onClose,
  onFormChange,
  onDryRun,
  onSave,
}: {
  form: SystemModelForm;
  open: boolean;
  saving: boolean;
  membershipLevels: MembershipLevel[];
  membershipLevelsLoading: boolean;
  t: Translate;
  tCommon: CommonTranslate;
  onClose: () => void;
  onFormChange: (form: SystemModelForm) => void;
  onDryRun: (payload: ReturnType<typeof buildDryRunPayload>) => Promise<DryRunResult>;
  onSave: () => void;
}) {
  const schemaEditorsLoading = Boolean(form.id) && !form.schemaLoaded;
  const credentialInteractionRef = useRef({
    baseUrl: false,
    apiKey: false,
  });
  const setFormField = <K extends keyof SystemModelForm>(key: K, value: SystemModelForm[K]) => {
    onFormChange({ ...form, [key]: value });
  };
  const markCredentialInteraction = (key: 'baseUrl' | 'apiKey') => {
    credentialInteractionRef.current[key] = true;
  };
  const setCredentialField = (key: 'baseUrl' | 'apiKey', value: string) => {
    const isDirty = form.credentialFieldsDirty[key] || credentialInteractionRef.current[key];
    credentialInteractionRef.current[key] = false;
    if (!isDirty) return;
    onFormChange({
      ...form,
      [key]: value,
      credentialFieldsDirty: {
        ...form.credentialFieldsDirty,
        ...(isDirty ? { [key]: true } : {}),
      },
    });
  };
  const toggleMembershipLevel = (levelId: string) => {
    const nextLevelIds = form.allowedMembershipLevelIds.includes(levelId)
      ? form.allowedMembershipLevelIds.filter((id) => id !== levelId)
      : [...form.allowedMembershipLevelIds, levelId];
    setFormField('allowedMembershipLevelIds', nextLevelIds);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent side="right" className="flex w-[min(94vw,760px)] flex-col gap-0 p-0 sm:max-w-none">
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
              type="url"
              value={form.baseUrl}
              name={`system-model-base-url-${form.id ?? 'new'}`}
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              spellCheck={false}
              inputMode="url"
              onBeforeInput={() => markCredentialInteraction('baseUrl')}
              onKeyDown={() => markCredentialInteraction('baseUrl')}
              onPaste={() => markCredentialInteraction('baseUrl')}
              onCut={() => markCredentialInteraction('baseUrl')}
              onDrop={() => markCredentialInteraction('baseUrl')}
              onChange={(event) => setCredentialField('baseUrl', event.target.value)}
              placeholder={form.id ? t('apiKeyPlaceholderEdit') : 'https://api.openai.com/v1'}
            />
          </Field>
          <Field label={t('fieldApiKey')}>
            <Input
              aria-label={t('fieldApiKey')}
              type="password"
              value={form.apiKey}
              name={`system-model-api-key-${form.id ?? 'new'}`}
              autoComplete="new-password"
              data-1p-ignore="true"
              data-lpignore="true"
              spellCheck={false}
              onBeforeInput={() => markCredentialInteraction('apiKey')}
              onKeyDown={() => markCredentialInteraction('apiKey')}
              onPaste={() => markCredentialInteraction('apiKey')}
              onCut={() => markCredentialInteraction('apiKey')}
              onDrop={() => markCredentialInteraction('apiKey')}
              onChange={(event) => setCredentialField('apiKey', event.target.value)}
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
          <Field
            label={t('fieldMembershipAccess')}
            description={t('fieldMembershipAccessDescription')}
          >
            {membershipLevelsLoading ? (
              <div className="bg-muted h-20 animate-pulse rounded-md" />
            ) : membershipLevels.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-3 text-xs">
                {t('membershipAccessEmpty')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-0.5">
                {membershipLevels.map((level) => (
                  <label
                    key={level.id}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1"
                  >
                    <Checkbox
                      checked={form.allowedMembershipLevelIds.includes(level.id)}
                      onCheckedChange={() => toggleMembershipLevel(level.id)}
                    />
                    <span className="text-foreground truncate text-sm">{level.name}</span>
                    <span className="text-muted-foreground text-xs">
                      ({t('membershipLevelMeta', { level: level.level })})
                    </span>
                  </label>
                ))}
              </div>
            )}
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

          <div className="border-border space-y-3 border-t pt-4">
            <div>
              <h3 className="text-foreground text-sm font-semibold">
                {t('descriptionSectionHeading')}
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                {t('descriptionSectionDescription')}
              </p>
            </div>
            {schemaEditorsLoading ? (
              <div className="bg-muted h-32 animate-pulse rounded-md" />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SUPPORTED_LANGUAGES.map((locale) => (
                  <div key={locale} className="space-y-1.5">
                    <label className="text-muted-foreground block text-xs font-medium">
                      {LANGUAGE_LABELS[locale]}
                    </label>
                    <Input
                      aria-label={`${t('descriptionSectionHeading')} — ${LANGUAGE_LABELS[locale]}`}
                      type="text"
                      value={form.description[locale] ?? ''}
                      onChange={(event) =>
                        setFormField('description', {
                          ...form.description,
                          [locale]: event.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-border space-y-3 border-t pt-4">
            <div>
              <h3 className="text-foreground text-sm font-semibold">{t('schemaSectionHeading')}</h3>
              <p className="text-muted-foreground mt-1 text-xs">{t('schemaSectionDescription')}</p>
            </div>
            {schemaEditorsLoading ? (
              <div className="bg-muted h-64 animate-pulse rounded-md" />
            ) : (
              <ModelSchemaEditor
                paramsSchemaText={form.paramsSchemaText}
                pricingSchemaText={form.pricingSchemaText}
                onParamsSchemaTextChange={(text) => setFormField('paramsSchemaText', text)}
                onPricingSchemaTextChange={(text) => setFormField('pricingSchemaText', text)}
                onDryRun={onDryRun}
              />
            )}
          </div>
        </div>

        <SheetFooter className="border-border flex-row items-center justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!form.model.trim() || saving || schemaEditorsLoading}
            onClick={onSave}
          >
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
