'use client';

import { useState } from 'react';
import { ArrowUpRight, History, WandSparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '../../navigation';
import { buildDiscountTranslationValues } from '../discount';
import type { ImageStudioMode, TemplateDensity } from './generator-studio-helpers';

// 滑块从左到右 = 小图→大图（列多→列少）：右滑图片越大、列越少
const TEMPLATE_DENSITY_VALUES: TemplateDensity[] = ['xdense', 'dense', 'normal', 'relaxed', 'xrelaxed'];

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

  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === active));

  return (
    <div className="relative inline-flex rounded-lg bg-background/70 p-1 backdrop-blur">
      {/* 滑块指示器：随选中项平移，形成 segmented 切换动画 */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-md bg-secondary shadow-sm transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${tabs.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative z-10 inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-4 text-xs font-bold transition-colors ${isActive ? 'text-foreground' : 'text-foreground/45 hover:text-foreground/75'
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
      className={`growth-offer-strip flex min-h-10 items-center gap-2 rounded-xl border border-destructive/25 px-3 text-xs font-semibold text-foreground shadow-xl ${className}`}
    >
      <span className="rounded-[7px] bg-growth-accent px-2 py-1 text-[10px] font-black uppercase text-background">
        {t('goUnlimited')}
      </span>
      <span className="rounded-[7px] bg-hot px-2 py-1 text-[10px] font-black text-foreground">
        {tCommon('discountBadge', buildDiscountTranslationValues())}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="hidden text-foreground/40 md:inline">{premium}</span>
      <Link
        href="/pricing"
        className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-[8px] bg-foreground px-2.5 text-xs font-bold text-background hover:bg-growth-accent"
      >
        {t('getUnlimited')}
        <ArrowUpRight className="size-3.5" />
      </Link>
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
  const maxIndex = TEMPLATE_DENSITY_VALUES.length - 1;
  const index = Math.max(0, TEMPLATE_DENSITY_VALUES.indexOf(value));

  // 带步进的拖动滑块：深色 pill 容器 + 细轨道 + 白色圆形手柄，3 档（relaxed / normal / dense）
  return (
    <div className="flex h-7 w-36 items-center rounded-full bg-black/40 px-3">
      <input
        type="range"
        min={0}
        max={maxIndex}
        step={1}
        value={index}
        aria-label={label}
        onChange={(event) => {
          const next = TEMPLATE_DENSITY_VALUES[Number(event.target.value)];
          if (next) onChange(next);
        }}
        className="h-3.5 w-full cursor-pointer appearance-none bg-transparent outline-none
          [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white
          [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/25
          [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/25
          [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition"
      />
    </div>
  );
}
