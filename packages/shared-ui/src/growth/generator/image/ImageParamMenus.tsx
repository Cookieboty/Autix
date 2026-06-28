'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-store';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';

export function ImageParamButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background/22 px-3 text-sm font-semibold text-foreground/78">
      <span className="text-growth-accent">{icon}</span>
      <span>{label}</span>
      <ChevronDown className="size-3.5 text-foreground/38" />
    </span>
  );
}

export function ImageModelParamMenu({
  icon,
  label,
  models,
  selectedModelId,
  loading,
  onChange,
  fallbackLabel,
}: {
  icon: ReactNode;
  label: string;
  models: ModelConfigItem[];
  selectedModelId: string | null;
  loading: boolean;
  onChange: (modelId: string) => void;
  fallbackLabel: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [open, setOpen] = useState(false);

  if (models.length === 0) {
    return (
      <ImageParamButton
        icon={icon}
        label={loading ? t('modelLoading') : label || fallbackLabel}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer text-left">
          <ImageParamButton icon={icon} label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 gap-0 overflow-hidden rounded-md border-border bg-card p-1 text-foreground shadow-2xl"
      >
        <div className="px-3 py-2 text-xs font-semibold text-foreground/45">{t('selectModel')}</div>
        <div className="max-h-72 overflow-y-auto">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
              className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left transition ${selectedModelId === model.id
                ? 'bg-secondary text-growth-accent'
                : 'text-foreground/82 hover:bg-secondary'
                }`}
            >
              <Sparkles className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{model.name}</span>
                <span className="block truncate text-xs text-foreground/38">
                  {model.model} · {model.provider}
                </span>
              </span>
              {selectedModelId === model.id ? <Check className="size-4 shrink-0" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ImageOptionParamMenu({
  icon,
  label,
  title,
  options,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (options.length <= 1) {
    return <ImageParamButton icon={icon} label={label} />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer text-left">
          <ImageParamButton icon={icon} label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 gap-0 overflow-hidden rounded-md border-border bg-card p-1 text-foreground shadow-2xl"
      >
        <div className="px-3 py-2 text-xs font-semibold text-foreground/45">{title}</div>
        <div className="max-h-72 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition ${value === option.value
                ? 'bg-secondary text-growth-accent'
                : 'text-foreground/82 hover:bg-secondary'
                }`}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {value === option.value ? <Check className="size-4 shrink-0" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
