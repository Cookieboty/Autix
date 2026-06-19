'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Check,
  Edit2,
  Globe,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
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
} from '@autix/shared-ui/ui';
import {
  createSystemModel as createSystemModelApi,
  deleteSystemModel as deleteSystemModelApi,
  getSystemModels,
  systemSettingsApi,
  updateSystemModel as updateSystemModelApi,
  type ModelConfigItem,
  type PublicSystemSettings,
} from '@/lib/api';
import { AMUX_API_URL } from '@/lib/constants';

const CAPABILITY_OPTIONS = [
  { value: 'text', key: 'text' },
  { value: 'vision', key: 'vision' },
  { value: 'voice', key: 'voice' },
  { value: 'speech', key: 'speech' },
  { value: 'code', key: 'code' },
  { value: 'reasoning', key: 'reasoning' },
  { value: 'image', key: 'image' },
  { value: 'video', key: 'video' },
  { value: 'embedding', key: 'embedding' },
];

const MODEL_TYPES = ['general', 'code', 'intent', 'embedding', 'video'];

type SystemModelForm = {
  id?: string;
  name: string;
  model: string;
  provider: string;
  type: string;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  capabilities: string[];
  baseUrl: string;
  apiKey: string;
};

function emptyForm(): SystemModelForm {
  return createEmptyForm(AMUX_API_URL);
}

function createEmptyForm(amuxHost: string): SystemModelForm {
  return {
    name: '',
    model: '',
    provider: 'amux',
    type: 'general',
    priority: 0,
    isDefault: false,
    isActive: true,
    capabilities: ['text'],
    baseUrl: `${amuxHost.replace(/\/$/, '')}/v1`,
    apiKey: '',
  };
}

function formFromModel(model: ModelConfigItem): SystemModelForm {
  return {
    id: model.id,
    name: model.name,
    model: model.model,
    provider: model.provider,
    type: model.type,
    priority: model.priority,
    isDefault: model.isDefault,
    isActive: (model as { isActive?: boolean }).isActive ?? true,
    capabilities: model.capabilities,
    baseUrl: model.baseUrl ?? model.metadata?.baseUrl ?? '',
    apiKey: model.apiKey ?? model.metadata?.apiKey ?? '',
  };
}

export default function AdminSystemModelsPage() {
  const t = useTranslations('adminSystemModels');
  const tCommon = useTranslations('common');
  const [settings, setSettings] = useState<PublicSystemSettings | null>(null);
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<SystemModelForm>(emptyForm());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const amuxHost = settings?.integrations.amuxHost ?? AMUX_API_URL;

  const groupedModels = useMemo(() => {
    return models.reduce<Record<string, ModelConfigItem[]>>((acc, model) => {
      const key = model.type || 'general';
      acc[key] = acc[key] ?? [];
      acc[key].push(model);
      return acc;
    }, {});
  }, [models]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSystemModels();
      setModels(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? t('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    systemSettingsApi
      .getPublic()
      .then(({ data }) => setSettings(data))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setForm(createEmptyForm(amuxHost));
    setDrawerOpen(true);
  };

  const openEdit = (model: ModelConfigItem) => {
    setForm(formFromModel(model));
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setForm(createEmptyForm(amuxHost));
  };

  const save = async () => {
    if (!form.model.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim() || form.model.trim(),
        model: form.model.trim(),
        provider: form.provider.trim() || 'openai',
        type: form.type,
        priority: form.priority,
        isDefault: form.isDefault,
        isActive: form.isActive,
        capabilities: form.capabilities.length > 0 ? form.capabilities : ['text'],
        baseUrl: form.baseUrl.trim() || undefined,
        apiKey: form.apiKey.trim() || undefined,
      };

      if (form.id) {
        await updateSystemModelApi(form.id, payload);
      } else {
        await createSystemModelApi(payload);
      }

      closeDrawer();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await deleteSystemModelApi(id);
      setDeletingId(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? t('deleteFailed'));
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-border flex items-center justify-between gap-4 border-b pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-foreground text-lg font-semibold">{t('title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('description')}
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t('addModel')}
        </Button>
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-lg border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-5">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="bg-muted h-36 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3">
            <Globe className="text-muted-foreground h-12 w-12 opacity-25" />
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
          </div>
        ) : (
          <div className="space-y-7">
            {Object.entries(groupedModels).map(([type, items]) => (
              <section key={type} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.18em]">
                    {type}
                  </span>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((model) => (
                    <SystemModelCard
                      key={model.id}
                      model={model}
                      deletingId={deletingId}
                      onEdit={openEdit}
                      onDelete={setDeletingId}
                      onCancelDelete={() => setDeletingId(null)}
                      onConfirmDelete={remove}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
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
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={form.model || 'GPT-4o'}
              />
            </Field>
            <Field label={t('fieldModelName')}>
              <Input
                aria-label={t('fieldModelName')}
                type="text"
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                placeholder="gpt-4o"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('fieldProvider')}>
                <Input
                  aria-label={t('fieldProvider')}
                  type="text"
                  value={form.provider}
                  onChange={(event) => setForm({ ...form, provider: event.target.value })}
                  placeholder="openai"
                />
              </Field>
              <Field label={t('fieldType')}>
                <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
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
                onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </Field>
            <Field label={t('fieldApiKey')}>
              <Input
                aria-label={t('fieldApiKey')}
                type="password"
                value={form.apiKey}
                onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                placeholder={form.id ? t('apiKeyPlaceholderEdit') : 'sk-...'}
              />
            </Field>
            <Field label={t('fieldPriority')}>
              <Input
                aria-label={t('fieldPriority')}
                type="number"
                value={String(form.priority)}
                onChange={(event) =>
                  setForm({ ...form, priority: Number.parseInt(event.target.value, 10) || 0 })
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
                      setForm({ ...form, capabilities: nextCapabilities });
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
                onChange={(checked) => setForm({ ...form, isDefault: checked })}
              />
              <CheckboxField
                id="system-model-active"
                checked={form.isActive}
                label={t('enableModel')}
                description={t('enableModelDescription')}
                onChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
          </div>

          <SheetFooter className="border-border flex-row items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" size="sm" onClick={closeDrawer}>
              {tCommon('cancel')}
            </Button>
            <Button type="button" size="sm" disabled={!form.model.trim() || saving} onClick={save}>
              {saving ? tCommon('saving') : form.id ? tCommon('save') : tCommon('create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
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

function SystemModelCard({
  model,
  deletingId,
  onEdit,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  model: ModelConfigItem;
  deletingId: string | null;
  onEdit: (model: ModelConfigItem) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}) {
  const t = useTranslations('adminSystemModels');
  const isDeleting = deletingId === model.id;
  const isActive = (model as { isActive?: boolean }).isActive ?? true;

  return (
    <div className="border-border bg-card flex min-h-[154px] flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-foreground truncate text-sm font-semibold">{model.name}</h3>
            {model.isDefault && (
              <span className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-[10px]">
                {t('defaultBadge')}
              </span>
            )}
            {!isActive && (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                {t('inactiveBadge')}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 truncate font-mono text-xs">{model.model}</p>
        </div>
        {isDeleting ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              className="bg-destructive h-8 w-8 p-0 text-white"
              onClick={() => onConfirmDelete(model.id)}
              aria-label={t('confirmDelete')}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onCancelDelete}
              aria-label={t('cancelDelete')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => onEdit(model)}
              aria-label={t('editAction')}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:text-destructive"
              onClick={() => onDelete(model.id)}
              aria-label={t('deleteAction')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">{model.provider}</span>
        <span className="text-muted-foreground/60 text-xs">·</span>
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
          priority {model.priority}
        </span>
      </div>

      {model.capabilities.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1">
          {model.capabilities.map((capability) => (
            <span
              key={capability}
              className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
            >
              {capability}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
