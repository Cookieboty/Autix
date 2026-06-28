'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Check, ChevronDown, SlidersHorizontal, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-store';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';

function VideoParamButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-[11px] border border-border bg-secondary px-2 text-xs font-bold text-foreground/78 transition hover:bg-accent">
      <span className="shrink-0 text-foreground/52">{icon}</span>
      <span className="min-w-0 truncate leading-none">{label}</span>
    </span>
  );
}

export function VideoModelParamMenu({
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
      <VideoStaticParamRow
        icon={icon}
        label={t('model')}
        value={loading ? t('modelLoading') : label || fallbackLabel}
        highlight
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="min-w-0 cursor-pointer text-left"
        >
          <VideoStaticParamRow
            icon={icon}
            label={t('model')}
            value={label}
            highlight
            trailing={<ChevronDown className="size-4 shrink-0 text-foreground/45" />}
          />
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
              <Video className="size-4 shrink-0" />
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

export function VideoOptionParamMenu({
  icon,
  label,
  title,
  options,
  value,
  onChange,
}: {
  icon?: ReactNode;
  label: string;
  title: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (options.length <= 1) {
    return (
      <button type="button" className="min-w-0 cursor-default text-left" disabled>
        <VideoParamButton icon={icon ?? <SlidersHorizontal className="size-4" />} label={label} />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="min-w-0 cursor-pointer text-left">
          <VideoParamButton icon={icon ?? <SlidersHorizontal className="size-4" />} label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 gap-0 overflow-hidden rounded-md border-border bg-card p-1 text-foreground shadow-2xl"
      >
        <div className="px-3 py-2 text-xs font-semibold text-foreground/45">{title}</div>
        <div className="max-h-80 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition ${value === option.value
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

export function VideoSliderParamMenu({
  icon,
  label,
  title,
  options,
  value,
  onChange,
  formatValue,
}: {
  icon?: ReactNode;
  label: string;
  title: string;
  options: number[];
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  const [open, setOpen] = useState(false);

  const safeOptions = useMemo(() => (options.length > 0 ? options : [value]), [options, value]);
  const maxIndex = Math.max(0, safeOptions.length - 1);
  const currentIndex = useMemo(() => {
    const idx = safeOptions.indexOf(value);
    return idx >= 0 ? idx : 0;
  }, [safeOptions, value]);
  const display = formatValue ?? ((v: number) => `${v}s`);

  if (safeOptions.length <= 1) {
    return (
      <button type="button" className="min-w-0 cursor-default text-left" disabled>
        <VideoParamButton icon={icon ?? <SlidersHorizontal className="size-4" />} label={label} />
      </button>
    );
  }

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = safeOptions[Number(event.target.value)];
    if (next != null) onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="min-w-0 cursor-pointer text-left">
          <VideoParamButton icon={icon ?? <SlidersHorizontal className="size-4" />} label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 gap-0 overflow-hidden rounded-md border-border bg-card p-3 text-foreground shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 pb-2 text-xs font-semibold text-foreground/45">
          <span>{title}</span>
          <span className="text-sm font-black text-growth-accent">{display(safeOptions[currentIndex] ?? value)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={maxIndex}
          step={1}
          value={currentIndex}
          onChange={handleSliderChange}
          aria-label={title}
          className="growth-range mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-growth-accent"
          style={{
            background: `linear-gradient(to right, var(--growth-accent, currentColor) 0%, var(--growth-accent, currentColor) ${(currentIndex / maxIndex) * 100}%, var(--secondary) ${(currentIndex / maxIndex) * 100}%, var(--secondary) 100%)`,
          }}
        />
        <div className="mt-2 flex justify-between text-[11px] font-bold text-foreground/45">
          {safeOptions.map((opt, idx) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`min-w-6 cursor-pointer rounded px-1 py-0.5 transition hover:text-foreground ${idx === currentIndex ? 'text-growth-accent' : ''}`}
            >
              {display(opt)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function VideoStaticParamRow({
  label,
  value,
  highlight = false,
  icon,
  trailing,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-2 rounded-[11px] border border-border bg-secondary px-2.5 text-left text-xs">
      <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-foreground/62">
        {icon ? <span className="shrink-0 text-foreground/42">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </span>
      <span className="ml-auto inline-flex min-w-0 items-center gap-2">
        <span className={highlight ? 'min-w-0 truncate font-black text-growth-accent' : 'min-w-0 truncate font-semibold text-foreground/60'}>{value}</span>
        {trailing}
      </span>
    </div>
  );
}
