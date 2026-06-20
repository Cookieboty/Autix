'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Settings, Globe, Plus, Trash2, Edit2, Check, X, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
} from '../ui';
import {
  createModelConfig as createModelApi,
  deleteModelConfig as deleteModelApi,
  listAllModelConfigs,
  updateModelConfig as updateModelApi,
  type ModelConfigItem,
} from '@autix/shared-store';
import { AmuxImportDialog } from './AmuxImportDialog';

const CAPABILITY_KEYS: { value: string; key: string }[] = [
  { value: 'text', key: 'capText' },
  { value: 'vision', key: 'capVision' },
  { value: 'voice', key: 'capVoice' },
  { value: 'speech', key: 'capSpeech' },
  { value: 'code', key: 'capCode' },
  { value: 'reasoning', key: 'capReasoning' },
  { value: 'image', key: 'capImage' },
  { value: 'video', key: 'capVideo' },
  { value: 'embedding', key: 'capEmbedding' },
];

const DEFAULT_MODEL_TYPE_OPTIONS = ['general', 'code', 'intent', 'embedding', 'video'];

interface EditingModel {
  id?: string;
  name: string;
  model: string;
  provider: string;
  type: string;
  priority: number;
  isDefault: boolean;
  capabilities: string[];
  baseUrl: string;
  apiKey: string;
}

type ModelsViewVariant = 'web' | 'desktop';
type ModelsDrawerMode = 'sheet' | 'overlay';

interface ModelsViewProps {
  amuxHost: string;
  amuxClientId?: string;
  amuxModelImportEnabled?: boolean;
  drawerMode?: ModelsDrawerMode;
  headerLeading?: ReactNode;
  modelTypeOptions?: readonly string[];
  variant?: ModelsViewVariant;
}

const variantClasses = {
  web: {
    icon: 'ml-1 h-4 w-4 text-muted-foreground',
    countBadge: 'rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground',
    skeleton: 'h-32 animate-pulse rounded-xl bg-muted',
    emptyIcon: 'h-12 w-12 text-muted-foreground opacity-20',
    emptyText: 'text-sm text-muted-foreground',
    fieldLabel: 'block text-xs font-medium text-muted-foreground',
    helperText: 'text-xs text-muted-foreground',
    sectionTitle: 'text-xs font-semibold uppercase tracking-wider text-muted-foreground',
    card: 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50',
    cardModel: 'mt-0.5 truncate font-mono text-xs text-muted-foreground',
    providerText: 'text-xs text-muted-foreground',
    dividerText: 'text-xs text-muted-foreground/60',
    chip: 'rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground',
    capChip: 'rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground',
  },
  desktop: {
    icon: 'w-4 h-4 text-foreground/50',
    countBadge: 'text-xs px-1.5 py-0.5 rounded-full bg-default-100 text-foreground/50',
    skeleton: 'h-32 rounded-xl animate-pulse bg-default-100',
    emptyIcon: 'w-12 h-12 opacity-20 text-foreground/50',
    emptyText: 'text-sm text-foreground/50',
    fieldLabel: 'block text-xs font-medium text-foreground/60',
    helperText: 'text-xs text-foreground/50',
    sectionTitle: 'text-xs font-semibold uppercase tracking-wider text-foreground/50',
    card: 'rounded-xl border border-default bg-default-50 p-4 flex flex-col gap-3 transition-colors hover:bg-default-100/50',
    cardModel: 'text-xs text-foreground/40 mt-0.5 truncate font-mono',
    providerText: 'text-xs text-foreground/50',
    dividerText: 'text-xs text-foreground/30',
    chip: 'text-xs px-1.5 py-0.5 rounded bg-default-100 text-foreground/50',
    capChip: 'text-[10px] px-1.5 py-0.5 rounded bg-default-100 text-foreground/50',
  },
} as const;

function createEmptyEditing(amuxHost: string): EditingModel {
  return {
    name: '',
    model: '',
    provider: 'amux',
    type: 'general',
    priority: 0,
    isDefault: false,
    capabilities: ['text'],
    baseUrl: `${amuxHost.replace(/\/$/, '')}/v1`,
    apiKey: '',
  };
}

function editingFromModel(model: ModelConfigItem): EditingModel {
  const metadata = model.metadata as { baseUrl?: string; apiKey?: string } | undefined;
  return {
    id: model.id,
    name: model.name,
    model: model.model,
    provider: model.provider,
    type: model.type,
    priority: model.priority,
    isDefault: model.isDefault,
    capabilities: model.capabilities,
    baseUrl: model.baseUrl ?? metadata?.baseUrl ?? '',
    apiKey: model.apiKey ?? metadata?.apiKey ?? '',
  };
}

export function ModelsView({
  amuxHost,
  amuxClientId,
  amuxModelImportEnabled = true,
  drawerMode = 'sheet',
  headerLeading,
  modelTypeOptions = DEFAULT_MODEL_TYPE_OPTIONS,
  variant = 'web',
}: ModelsViewProps) {
  const t = useTranslations('models');
  const classes = variantClasses[variant];
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EditingModel>(() => createEmptyEditing(amuxHost));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [amuxImportOpen, setAmuxImportOpen] = useState(false);

  const loadModels = useCallback(() => {
    setLoading(true);
    listAllModelConfigs()
      .then((data) => setModels(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const openCreate = () => {
    setEditing(createEmptyEditing(amuxHost));
    setDrawerOpen(true);
  };

  const openEdit = (model: ModelConfigItem) => {
    setEditing(editingFromModel(model));
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(createEmptyEditing(amuxHost));
  };

  const handleSave = async () => {
    const payload = {
      name: editing.name || editing.model,
      model: editing.model,
      provider: editing.provider,
      type: editing.type as any,
      priority: editing.priority,
      isDefault: editing.isDefault,
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

  const drawerBody = (
    <ModelDrawerBody
      editing={editing}
      onEditingChange={setEditing}
      modelTypeOptions={modelTypeOptions}
      variant={variant}
    />
  );
  const drawerFooter = (
    <>
      <Button variant="ghost" size="sm" onClick={closeDrawer}>
        {t('cancelLabel')}
      </Button>
      <Button size="sm" disabled={!editing.model} onClick={handleSave}>
        {editing.id ? t('saveLabel') : t('createLabel')}
      </Button>
    </>
  );

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            {headerLeading}
            <Settings className={classes.icon} />
            <span className="text-sm font-semibold text-foreground">{t('title')}</span>
            {models.length > 0 && (
              <span className={classes.countBadge}>
                {models.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {amuxModelImportEnabled && (
              <Button variant="ghost" size="sm" onClick={() => setAmuxImportOpen(true)}>
                <Download className="w-3.5 h-3.5" />
                {t('importFromAmux')}
              </Button>
            )}
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              {t('addModel')}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {loading && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={classes.skeleton} />
                ))}
              </div>
            )}

            {!loading && models.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Globe className={classes.emptyIcon} />
                <p className={classes.emptyText}>{t('noModelsHint')}</p>
              </div>
            )}

            {!loading && models.length > 0 && (
              <ModelSection
                title={t('privateModels')}
                models={models}
                onEdit={openEdit}
                onDelete={(id) => setDeletingId(id)}
                deletingId={deletingId}
                onConfirmDelete={handleDelete}
                onCancelDelete={() => setDeletingId(null)}
                variant={variant}
              />
            )}
          </div>
        </div>
      </div>

      {drawerMode === 'sheet' ? (
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
              {drawerBody}
            </div>

            <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-border px-6 py-4">
              {drawerFooter}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <OverlayDrawer
          open={drawerOpen}
          title={editing.id ? t('editModel') : t('addModel')}
          onClose={closeDrawer}
          footer={drawerFooter}
        >
          {drawerBody}
        </OverlayDrawer>
      )}

      {amuxModelImportEnabled && (
        <AmuxImportDialog
          open={amuxImportOpen}
          onClose={() => setAmuxImportOpen(false)}
          onImported={loadModels}
          amuxHost={amuxHost}
          amuxClientId={amuxClientId}
        />
      )}
    </div>
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
        <p className={`ml-6 mt-1 ${classes.helperText}`}>
          {t('defaultTypeHint')}
        </p>
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
          <h3 className="text-sm font-semibold text-foreground">
            {title}
          </h3>
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

function ModelSection({
  title,
  models,
  onEdit,
  onDelete,
  deletingId,
  onConfirmDelete,
  onCancelDelete,
  readOnly,
  variant,
}: {
  title: string;
  models: ModelConfigItem[];
  onEdit: (model: ModelConfigItem) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  readOnly?: boolean;
  variant: ModelsViewVariant;
}) {
  const t = useTranslations('models');
  const classes = variantClasses[variant];
  const capLabelMap: Record<string, string> = Object.fromEntries(
    CAPABILITY_KEYS.map((option) => [option.value, t(option.key)]),
  );

  return (
    <div className="space-y-3">
      <div className={classes.sectionTitle}>
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            capLabelMap={capLabelMap}
            onEdit={onEdit}
            onDelete={onDelete}
            deletingId={deletingId}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
            readOnly={readOnly}
            variant={variant}
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
  variant,
}: {
  model: ModelConfigItem;
  capLabelMap: Record<string, string>;
  onEdit: (model: ModelConfigItem) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  readOnly?: boolean;
  variant: ModelsViewVariant;
}) {
  const t = useTranslations('models');
  const classes = variantClasses[variant];
  const isDeleting = deletingId === model.id;

  return (
    <div className={classes.card}>
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
          <div className={classes.cardModel}>{model.model}</div>
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

      <div className="flex items-center gap-2">
        <span className={classes.providerText}>{model.provider}</span>
        <span className={classes.dividerText}>·</span>
        <span className={classes.chip}>
          {model.type}
        </span>
      </div>

      {model.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.capabilities.map((capability) => (
            <span
              key={capability}
              className={classes.capChip}
            >
              {capLabelMap[capability] || capability}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
