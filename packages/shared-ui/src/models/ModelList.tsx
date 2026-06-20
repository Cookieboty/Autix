'use client';

import { type ReactNode } from 'react';
import { Check, Download, Edit2, Globe, Plus, Settings, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';
import type { ModelConfigItem } from '@autix/shared-store';
import {
  CAPABILITY_KEYS,
  type ModelsViewVariant,
  variantClasses,
} from './model-editing';

interface ModelsHeaderProps {
  headerLeading?: ReactNode;
  importEnabled: boolean;
  modelCount: number;
  onCreate: () => void;
  onImportFromAmux: () => void;
  variant: ModelsViewVariant;
}

export function ModelsHeader({
  headerLeading,
  importEnabled,
  modelCount,
  onCreate,
  onImportFromAmux,
  variant,
}: ModelsHeaderProps) {
  const t = useTranslations('models');
  const classes = variantClasses[variant];

  return (
    <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        {headerLeading}
        <Settings className={classes.icon} />
        <span className="text-sm font-semibold text-foreground">{t('title')}</span>
        {modelCount > 0 && (
          <span className={classes.countBadge}>
            {modelCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {importEnabled && (
          <Button variant="ghost" size="sm" onClick={onImportFromAmux}>
            <Download className="w-3.5 h-3.5" />
            {t('importFromAmux')}
          </Button>
        )}
        <Button size="sm" onClick={onCreate}>
          <Plus className="w-3.5 h-3.5" />
          {t('addModel')}
        </Button>
      </div>
    </div>
  );
}

interface ModelsContentProps {
  loading: boolean;
  models: ModelConfigItem[];
  deletingId: string | null;
  onEdit: (model: ModelConfigItem) => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  variant: ModelsViewVariant;
}

export function ModelsContent({
  loading,
  models,
  deletingId,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  variant,
}: ModelsContentProps) {
  const t = useTranslations('models');
  const classes = variantClasses[variant];

  return (
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
            onEdit={onEdit}
            onDelete={onDelete}
            deletingId={deletingId}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
            variant={variant}
          />
        )}
      </div>
    </div>
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
            <span key={capability} className={classes.capChip}>
              {capLabelMap[capability] || capability}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
