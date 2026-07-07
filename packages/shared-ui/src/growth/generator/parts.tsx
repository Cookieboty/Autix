'use client';

import { useState } from 'react';
import { ArrowUpRight, History, WandSparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { buildDiscountTranslationValues } from '../discount';
import type { ImageStudioMode, TemplateDensity } from './generator-studio-helpers';

const TEMPLATE_DENSITY_VALUES: TemplateDensity[] = ['relaxed', 'normal', 'dense'];

export function ModeTabs({
  active,
  onChange,
}: {
  active: ImageStudioMode;
  onChange: (next: ImageStudioMode) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tabs = [
    { id: 'history' as const, label: t('history'), icon: History },
    { id: 'templates' as const, label: t('templates'), icon: WandSparkles },
  ];

  return (
    <div className="inline-flex rounded-[11px] border border-border bg-secondary p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-[9px] px-3 text-xs font-bold transition ${active === tab.id ? 'bg-secondary text-foreground' : 'text-foreground/42 hover:text-foreground/76'
              }`}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function OfferStrip({
  label,
  premium,
  className = '',
}: {
  label: string;
  premium: string;
  className?: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tCommon = useTranslations('publicGrowth.common');
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div
      className={`growth-offer-strip flex min-h-10 items-center gap-2 rounded-[10px] border border-destructive/25 px-3 text-xs font-semibold text-foreground shadow-xl ${className}`}
    >
      <span className="rounded-[7px] bg-growth-accent px-2 py-1 text-[10px] font-black uppercase text-background">
        {t('goUnlimited')}
      </span>
      <span className="rounded-[7px] bg-hot px-2 py-1 text-[10px] font-black text-foreground">
        {tCommon('discountBadge', buildDiscountTranslationValues())}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="hidden text-foreground/40 md:inline">{premium}</span>
      <a
        href="/pricing"
        className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-[8px] bg-foreground px-2.5 text-xs font-bold text-background hover:bg-growth-accent"
      >
        {t('getUnlimited')}
        <ArrowUpRight className="size-3.5" />
      </a>
      <button
        type="button"
        className="grid size-7 shrink-0 place-items-center rounded-[8px] text-foreground/45 hover:bg-secondary hover:text-foreground"
        aria-label={t('close')}
        onClick={() => setOpen(false)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function StudioDensitySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TemplateDensity;
  onChange: (value: TemplateDensity) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full bg-background/28 px-2 py-1 shadow-lg backdrop-blur-md"
      role="group"
      aria-label={label}
    >
      {TEMPLATE_DENSITY_VALUES.map((option, index) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-label={`${label} ${index + 1}`}
            aria-pressed={active}
            className="grid h-5 w-8 cursor-pointer place-items-center rounded-full transition hover:bg-secondary"
            onClick={() => onChange(option)}
          >
            <span
              className={`h-1 rounded-full transition-all ${active ? 'w-6 bg-foreground' : 'w-4 bg-secondary'}`}
            />
          </button>
        );
      })}
    </div>
  );
}
