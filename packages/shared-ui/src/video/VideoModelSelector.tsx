'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  isVideoModel,
  useModelConfigStore,
  type ModelConfigItem,
} from '@autix/shared-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface VideoModelSelectorProps {
  /** Current selected modelConfigId (UUID). Empty string uses the backend default. */
  value: string;
  /** Called when a model is selected; empty string clears to backend default. */
  onChange: (modelConfigId: string) => void;
  disabled?: boolean;
  models?: ModelConfigItem[];
  loading?: boolean;
}

const DEFAULT_MODEL_VALUE = '__default__';

export function VideoModelSelector({
  value,
  onChange,
  disabled,
  models,
  loading = false,
}: VideoModelSelectorProps) {
  const t = useTranslations('videoWorkbench.legacy.modelSelector');
  const [localModels, setLocalModels] = useState<ModelConfigItem[]>([]);
  const loadAvailableModels = useModelConfigStore((s) => s.loadAvailableModels);
  const resolvedModels = models ?? localModels;
  const controlledModels = models !== undefined;

  useEffect(() => {
    if (controlledModels) return;
    loadAvailableModels().then((availableModels) => {
      const videoModels = availableModels.filter(isVideoModel);
      setLocalModels(videoModels);
    });
  }, [controlledModels, loadAvailableModels]);

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{t('label')}</span>
      <Select
        value={value || DEFAULT_MODEL_VALUE}
        onValueChange={(nextValue) => {
          if (nextValue === DEFAULT_MODEL_VALUE) {
            onChange('');
          } else {
            onChange(nextValue);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 min-w-[132px] border-border bg-background px-2.5 text-xs shadow-none">
          <SelectValue placeholder={t('default')} />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[70] rounded-lg">
          <SelectItem value={DEFAULT_MODEL_VALUE} className="text-xs">{t('default')}</SelectItem>
          {loading && resolvedModels.length === 0 && (
            <SelectItem value="__loading__" disabled className="text-xs">{t('loading')}</SelectItem>
          )}
          {!loading && resolvedModels.length === 0 && (
            <SelectItem value="__empty__" disabled className="text-xs">
              {t('empty')}
            </SelectItem>
          )}
          {resolvedModels.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
