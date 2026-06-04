'use client';

import { useEffect, useState } from 'react';
import { Settings, Globe, Plus, Trash2, Edit2, Check, X, Download } from 'lucide-react';
import {
  Button,
  Input,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SidebarTrigger,
} from '@autix/shared-ui/ui';
import { useTranslations } from 'next-intl';
import {
  getAllModels,
  deleteModel as deleteModelApi,
  createModel as createModelApi,
  updateModel as updateModelApi,
  type ModelConfigItem,
} from '@/lib/api';
import { AmuxImportDialog } from '@/components/models/AmuxImportDialog';
import { useAuthStore } from '@/store/auth.store';

const CAPABILITY_KEYS: { value: string; key: string }[] = [
  { value: 'text', key: 'capText' },
  { value: 'vision', key: 'capVision' },
  { value: 'voice', key: 'capVoice' },
  { value: 'speech', key: 'capSpeech' },
  { value: 'code', key: 'capCode' },
  { value: 'reasoning', key: 'capReasoning' },
  { value: 'image', key: 'capImage' },
  { value: 'embedding', key: 'capEmbedding' },
];

const MODEL_TYPE_OPTIONS = ['general', 'code', 'intent', 'embedding'];

interface EditingModel {
  id?: string;
  name: string;
  model: string;
  provider: string;
  type: string;
  priority: number;
  isDefault: boolean;
  visibility: string;
  capabilities: string[];
  baseUrl: string;
  apiKey: string;
}

function emptyEditing(): EditingModel {
  return {
    name: '',
    model: '',
    provider: 'amux',
    type: 'general',
    priority: 0,
    isDefault: false,
    visibility: 'private',
    capabilities: ['text'],
    baseUrl: 'https://api.amux.ai/v1',
    apiKey: '',
  };
}

export default function ModelsPage() {
  const t = useTranslations('models');
  const { isAdmin } = useAuthStore();
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EditingModel>(emptyEditing());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [amuxImportOpen, setAmuxImportOpen] = useState(false);

  const loadModels = () => {
    setLoading(true);
    getAllModels()
      .then(({ data }) => setModels(data as ModelConfigItem[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadModels();
  }, []);

  const openCreate = () => {
    setEditing(emptyEditing());
    setDrawerOpen(true);
  };

  const openEdit = (m: ModelConfigItem) => {
    setEditing({
      id: m.id,
      name: m.name,
      model: m.model,
      provider: m.provider,
      type: m.type,
      priority: m.priority,
      isDefault: m.isDefault,
      visibility: m.visibility,
      capabilities: m.capabilities,
      baseUrl: m.baseUrl ?? (m.metadata as any)?.baseUrl ?? '',
      apiKey: m.apiKey ?? (m.metadata as any)?.apiKey ?? '',
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(emptyEditing());
  };

  const handleSave = async () => {
    const payload = {
      name: editing.name || editing.model,
      model: editing.model,
      provider: editing.provider,
      type: editing.type as any,
      priority: editing.priority,
      isDefault: editing.isDefault,
      visibility: editing.visibility as any,
      capabilities: editing.capabilities,
      baseUrl: editing.baseUrl || undefined,
      apiKey: editing.apiKey || undefined,
    } as any;

    try {
      if (editing.id) {
        await updateModelApi(editing.id, payload);
      } else {
        await createModelApi(payload);
      }
      closeDrawer();
      loadModels();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteModelApi(id);
      setDeletingId(null);
      loadModels();
    } catch (e) {
      console.error(e);
    }
  };

  const privateModels = models.filter((m) => m.visibility === 'private');
  const publicModels = models.filter((m) => m.visibility === 'public');

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Settings className="ml-1 h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{t('title')}</span>
            {models.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {models.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAmuxImportOpen(true)}>
              <Download className="w-3.5 h-3.5" />
              {t('importFromAmux')}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              {t('addModel')}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {loading && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            )}

            {!loading && models.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Globe className="h-12 w-12 text-muted-foreground opacity-20" />
                <p className="text-sm text-muted-foreground">{t('noModelsHint')}</p>
              </div>
            )}

            {!loading && privateModels.length > 0 && (
              <ModelSection
                title={t('privateModels')}
                models={privateModels}
                onEdit={openEdit}
                onDelete={(id) => setDeletingId(id)}
                deletingId={deletingId}
                onConfirmDelete={handleDelete}
                onCancelDelete={() => setDeletingId(null)}
              />
            )}

            {!loading && publicModels.length > 0 && (
              <ModelSection
                title={t('publicModels')}
                models={publicModels}
                onEdit={openEdit}
                onDelete={(id) => setDeletingId(id)}
                deletingId={deletingId}
                onConfirmDelete={handleDelete}
                onCancelDelete={() => setDeletingId(null)}
                readOnly={!isAdmin}
              />
            )}
          </div>
        </div>
      </div>

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
      >
        <SheetContent
          side="right"
          className="flex w-[460px] flex-col gap-0 p-0 sm:max-w-[460px]"
        >
          <SheetHeader className="h-14 flex-row items-center justify-between border-b border-border px-6 py-0">
            <SheetTitle className="text-sm">
              {editing.id ? t('editModel') : t('addModel')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {editing.id ? t('editModel') : t('addModel')}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <Field label={t('fieldName')} description={t('nameHelperText')}>
              <Input
                aria-label={t('fieldName')}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder={editing.model || t('namePlaceholder')}
              />
            </Field>
            <Field label={t('fieldModelName')}>
              <Input
                aria-label={t('fieldModelName')}
                value={editing.model}
                onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                placeholder="gpt-4o"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('fieldProvider')}>
                <Input
                  aria-label={t('fieldProvider')}
                  value={editing.provider}
                  onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
                  placeholder="amux"
                />
              </Field>
              <Field label={t('fieldType')}>
                <HeroSelect
                  label={t('fieldType')}
                  value={editing.type}
                  onChange={(v) => setEditing({ ...editing, type: v })}
                  options={MODEL_TYPE_OPTIONS.map((o) => ({ value: o, label: o }))}
                />
              </Field>
            </div>
            <Field label="Base URL">
              <Input
                aria-label="Base URL"
                value={editing.baseUrl}
                onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                placeholder="https://api.amux.ai/v1"
              />
            </Field>
            <Field label="API Key">
              <Input
                aria-label="API Key"
                type="password"
                value={editing.apiKey}
                onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
                placeholder={editing.id ? t('apiKeyPlaceholderEdit') : 'sk-...'}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('fieldPriority')}>
                <Input
                  aria-label={t('fieldPriority')}
                  type="number"
                  value={String(editing.priority)}
                  onChange={(e) => setEditing({ ...editing, priority: parseInt(e.target.value) || 0 })}
                />
              </Field>
              {isAdmin && (
                <Field label={t('fieldVisibility')}>
                  <HeroSelect
                    label={t('fieldVisibility')}
                    value={editing.visibility}
                    onChange={(v) => setEditing({ ...editing, visibility: v })}
                    options={[
                      { value: 'public', label: t('visibilityPublic') },
                      { value: 'private', label: t('visibilityPrivate') },
                    ]}
                  />
                </Field>
              )}
            </div>
            <Field label={t('fieldCapabilities')}>
              <div className="flex flex-wrap gap-2">
                {CAPABILITY_KEYS.map(({ value, key }) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={editing.capabilities.includes(value) ? 'default' : 'ghost'}
                    onClick={() => {
                      const caps = editing.capabilities.includes(value)
                        ? editing.capabilities.filter((c) => c !== value)
                        : [...editing.capabilities, value];
                      setEditing({ ...editing, capabilities: caps });
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
                  onCheckedChange={(checked) => setEditing({ ...editing, isDefault: !!checked })}
                />
                <label htmlFor="isDefault" className="cursor-pointer text-sm">
                  {t('setDefaultModel')}
                </label>
              </div>
              <p className="ml-6 mt-1 text-xs text-muted-foreground">
                {t('defaultTypeHint')}
              </p>
            </div>
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button variant="ghost" size="sm" onClick={closeDrawer}>
              {t('cancelLabel')}
            </Button>
            <Button size="sm" disabled={!editing.model} onClick={handleSave}>
              {editing.id ? t('saveLabel') : t('createLabel')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AmuxImportDialog
        open={amuxImportOpen}
        onClose={() => setAmuxImportOpen(false)}
        onImported={loadModels}
      />
    </div>
  );
}

// ── Sub components ──────────────────────────────────────────────

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
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <div>{children}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
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
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ModelSection({
  title,
  models,
  onEdit,
  onDelete,
  deletingId,
  onConfirmDelete,
  onCancelDelete,
  readOnly,
}: {
  title: string;
  models: ModelConfigItem[];
  onEdit: (m: ModelConfigItem) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('models');
  const capLabelMap: Record<string, string> = Object.fromEntries(
    CAPABILITY_KEYS.map((o) => [o.value, t(o.key)]),
  );
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {models.map((m) => (
          <ModelCard
            key={m.id}
            model={m}
            capLabelMap={capLabelMap}
            onEdit={onEdit}
            onDelete={onDelete}
            deletingId={deletingId}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

function ModelCard({
  model,
  capLabelMap,
  onEdit,
  onDelete,
  deletingId,
  onConfirmDelete,
  onCancelDelete,
  readOnly,
}: {
  model: ModelConfigItem;
  capLabelMap: Record<string, string>;
  onEdit: (m: ModelConfigItem) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('models');
  const isDeleting = deletingId === model.id;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
      {/* Top row: name + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{model.name}</span>
            {model.isDefault && (
              <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 bg-primary text-primary-foreground">
                {t('defaultBadge')}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{model.model}</div>
        </div>

        {!readOnly && (isDeleting ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="sm"
              className="p-0 w-8 h-8 bg-destructive text-white"
              onClick={() => onConfirmDelete(model.id)}
              aria-label={t('confirmDeleteLabel')}
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="p-0 w-8 h-8"
              onClick={onCancelDelete}
              aria-label={t('cancelLabel')}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="p-0 w-8 h-8"
              onClick={() => onEdit(model)}
              aria-label={t('editLabel')}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="p-0 w-8 h-8 hover:text-destructive"
              onClick={() => onDelete(model.id)}
              aria-label={t('deleteLabel')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Provider + type row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{model.provider}</span>
        <span className="text-xs text-muted-foreground/60">·</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {model.type}
        </span>
      </div>

      {/* Capabilities */}
      {model.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.capabilities.map((c) => (
            <span
              key={c}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {capLabelMap[c] || c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
