'use client';

import { useEffect, useState } from 'react';
import { Settings, Globe, Plus, Trash2, Edit2, Check, X, Download } from 'lucide-react';
import {
  Input,
  Button,
  Checkbox,
  Select,
  ListBox,
} from '@heroui/react';
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
      baseUrl: (m.metadata as any)?.baseUrl ?? '',
      apiKey: (m.metadata as any)?.apiKey ?? '',
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
        <div className="flex items-center justify-between flex-shrink-0 h-14 px-8 border-b border-default">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-foreground/50" />
            <span className="text-sm font-semibold text-foreground">{t('title')}</span>
            {models.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-default-100 text-foreground/50">
                {models.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onPress={() => setAmuxImportOpen(true)}>
              <Download className="w-3.5 h-3.5" />
              {t('importFromAmux')}
            </Button>
            <Button variant="primary" size="sm" onPress={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              {t('addModel')}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 rounded-xl animate-pulse bg-default-100" />
                ))}
              </div>
            )}

            {!loading && models.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Globe className="w-12 h-12 opacity-20 text-foreground/50" />
                <p className="text-sm text-foreground/50">{t('noModelsHint')}</p>
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

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40" onClick={closeDrawer}>
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 z-50 h-full flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: '460px',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          backgroundColor: 'var(--panel, #1a1a1a)',
          borderLeft: '1px solid var(--border)',
          boxShadow: drawerOpen ? '-8px 0 30px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between flex-shrink-0 h-14 px-6 border-b border-default">
          <h3 className="text-sm font-semibold text-foreground">
            {editing.id ? t('editModel') : t('addModel')}
          </h3>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t('closeLabel')}
            onPress={closeDrawer}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
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
                  variant={editing.capabilities.includes(value) ? 'primary' : 'ghost'}
                  onPress={() => {
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
            <Checkbox
              isSelected={editing.isDefault}
              onChange={(checked: boolean) => setEditing({ ...editing, isDefault: checked })}
            >
              <span className="text-sm">{t('setDefaultModel')}</span>
            </Checkbox>
            <p className="text-xs text-foreground/40 mt-1 ml-6">{t('defaultTypeHint')}</p>
          </div>
        </div>

        {/* Drawer footer */}
        <div className="flex items-center justify-end gap-2 flex-shrink-0 px-6 py-4 border-t border-default">
          <Button variant="ghost" size="sm" onPress={closeDrawer}>
            {t('cancelLabel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            isDisabled={!editing.model}
            onPress={handleSave}
          >
            {editing.id ? t('saveLabel') : t('createLabel')}
          </Button>
        </div>
      </div>

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
      <label className="block text-xs font-medium text-foreground/60">{label}</label>
      <div>{children}</div>
      {description && (
        <p className="text-xs text-foreground/50">{description}</p>
      )}
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
      aria-label={label}
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
      placeholder={undefined}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((opt) => (
            <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
              {opt.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
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
      <div className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
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
    <div className="rounded-xl border border-default bg-default-50 p-4 flex flex-col gap-3 transition-colors hover:bg-default-100/50">
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
          <div className="text-xs text-foreground/40 mt-0.5 truncate font-mono">{model.model}</div>
        </div>

        {!readOnly && (isDeleting ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              isIconOnly
              size="sm"
              variant="primary"
              className="bg-danger text-white"
              onPress={() => onConfirmDelete(model.id)}
              aria-label={t('confirmDeleteLabel')}
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={onCancelDelete}
              aria-label={t('cancelLabel')}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => onEdit(model)}
              aria-label={t('editLabel')}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="hover:text-danger"
              onPress={() => onDelete(model.id)}
              aria-label={t('deleteLabel')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Provider + type row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground/50">{model.provider}</span>
        <span className="text-xs text-foreground/30">·</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-default-100 text-foreground/50">
          {model.type}
        </span>
      </div>

      {/* Capabilities */}
      {model.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.capabilities.map((c) => (
            <span
              key={c}
              className="text-[10px] px-1.5 py-0.5 rounded bg-default-100 text-foreground/50"
            >
              {capLabelMap[c] || c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
