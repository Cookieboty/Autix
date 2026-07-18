'use client';

import type { CSSProperties } from 'react';
import { Check, X } from 'lucide-react';
import {
  formatCount,
  type BillingCycle,
  type PlanComparison,
  type PlanTone,
  type PricingPlan,
} from '../public-pricing-helpers';
import type { TFunc } from './pricing-parts';

/** 每档色调：neutral=白 CTA / brand=品牌绿 / top=品红。控制卡片微渐变、CTA 底色与文字对比色 */
const TONE_STYLE: Record<
  PlanTone,
  { accent: string; ctaText: string; tinted: boolean; badgeText: string }
> = {
  neutral: {
    accent: 'var(--color-foreground)',
    ctaText: 'var(--color-background)',
    tinted: false,
    badgeText: 'var(--color-background)',
  },
  brand: {
    accent: 'var(--growth-accent)',
    ctaText: 'var(--color-background)',
    tinted: true,
    badgeText: 'var(--color-background)',
  },
  top: {
    accent: '#ff2f87',
    ctaText: '#ffffff',
    tinted: true,
    badgeText: '#ffffff',
  },
};

export function BillingCycleSwitch({
  cycle,
  onCycleChange,
  monthlyLabel,
  yearlyLabel,
}: {
  cycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  monthlyLabel: string;
  yearlyLabel: string;
}) {
  const options: Array<[BillingCycle, string]> = [
    ['MONTHLY', monthlyLabel],
    ['YEARLY', yearlyLabel],
  ];

  return (
    <div className="flex w-fit flex-wrap gap-2 rounded-xl border border-border bg-foreground/[0.05] p-1">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={`min-h-9 cursor-pointer rounded-md px-4 text-sm font-semibold transition ${cycle === value ? 'growth-billing-tab-active' : 'growth-billing-tab'}`}
          onClick={() => onCycleChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type FeatureRow = { label: string; ok: boolean };

/** 由结构化对比数据生成 ✓/✗ 权益清单（全部来自真实会员等级 features） */
function buildFeatureRows(c: PlanComparison, t: TFunc): FeatureRow[] {
  const rows: FeatureRow[] = [];
  if (c.imageConcurrency || c.videoConcurrency) {
    rows.push({
      label: t('parallelGenerations', {
        videos: c.videoConcurrency ?? 0,
        images: c.imageConcurrency ?? 0,
      }),
      ok: true,
    });
  }
  rows.push({
    label: c.videoSpec ? t('features.video', { spec: c.videoSpec }) : t('compare.videoCapability'),
    ok: Boolean(c.videoSpec),
  });
  rows.push({ label: t('features.watermark'), ok: c.removeWatermark });
  rows.push({ label: t('features.commercial'), ok: c.commercialLicense });
  rows.push({
    label: t('features.batch', {
      level: t(`batchGeneration.${c.batchGeneration === 'disabled' ? 'limited' : c.batchGeneration}`),
    }),
    ok: c.batchGeneration !== 'disabled',
  });
  rows.push({
    label: t('features.queue', { priority: t(`queuePriority.${c.queuePriority}`) }),
    ok: true,
  });
  if (c.historyDays) {
    rows.push({ label: t('features.history', { days: c.historyDays }), ok: true });
  }
  rows.push({ label: t('compare.creditCarryover'), ok: Boolean(c.carryoverCycles) });
  rows.push({ label: t('compare.teamWorkspace'), ok: c.teamSpace });
  rows.push({ label: t('compare.invoiceContract'), ok: Boolean(c.invoiceStatus) });
  return rows;
}

export function PlanCard({
  plan,
  showYearlyHint,
  purchasing,
  onPurchase,
  t,
  tagline,
}: {
  plan: PricingPlan;
  showYearlyHint: boolean;
  purchasing: boolean;
  onPurchase: () => void;
  t: TFunc;
  tagline?: string;
}) {
  const style = TONE_STYLE[plan.tone];
  const planName = plan.isFree ? t('freePlanName') : plan.serverName;
  const rows = buildFeatureRows(plan.comparison, t);
  const priceUnit = showYearlyHint && !plan.isFree ? t('billedAnnually') : t('perMonthLabel');
  const ctaLabel = plan.isFree ? t('freeCta') : t('getPlan', { plan: planName });

  const cardStyle: CSSProperties = style.tinted
    ? {
        borderColor: `color-mix(in srgb, ${style.accent} 42%, transparent)`,
        backgroundImage: `linear-gradient(157deg, color-mix(in srgb, ${style.accent} 17%, transparent) 0%, color-mix(in srgb, ${style.accent} 5%, transparent) 42%, rgba(255,255,255,0.02) 100%)`,
        boxShadow: `0 24px 80px color-mix(in srgb, ${style.accent} 12%, transparent)`,
      }
    : {};

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border p-5 text-left transition duration-300 ${
        style.tinted ? '' : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]'
      }`}
      style={cardStyle}
    >
      {/* Header：名称 + 徽章 + tagline */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{planName}</h3>
          {plan.hasYearlyDiscount ? (
            <span className="growth-discount-badge rounded px-1.5 py-0.5 text-[10px] font-black uppercase italic leading-none text-foreground">
              {t('yearlyDiscountBadge', { percent: 20 })}
            </span>
          ) : null}
          {plan.recommended ? (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase italic"
              style={{ backgroundColor: style.accent, color: style.badgeText }}
            >
              {t('bestValue')}
            </span>
          ) : null}
        </div>
        {tagline ? <p className="mt-1 text-xs text-foreground/50">{tagline}</p> : null}
      </div>

      {/* 积分/额度盒子 */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="text-lg font-bold text-foreground">
          {t('creditsMo', { count: formatCount(plan.points) })}
        </div>
        {plan.comparison.videoSpec ? (
          <p className="mt-1 text-xs text-foreground/55">
            {t('features.video', { spec: plan.comparison.videoSpec })}
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-medium text-foreground/70">
          <Check className="size-3.5 shrink-0" style={{ color: style.accent }} />
          {t('fixedCredits', { count: formatCount(plan.points) })}
        </div>
      </div>

      {/* 价格 */}
      <div className="mt-5 flex flex-wrap items-end gap-x-2">
        {plan.originalPrice ? (
          <span className="pb-1 text-lg font-bold text-[#ff4f82] line-through">
            {plan.originalPrice}
          </span>
        ) : null}
        <span className="text-3xl font-black text-foreground">{plan.pricePerMonth}</span>
        <span className="pb-1 text-xs text-foreground/50">{priceUnit}</span>
      </div>

      {/* CTA */}
      <button
        type="button"
        className="mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: style.accent, color: style.ctaText }}
        disabled={purchasing}
        onClick={onPurchase}
      >
        {purchasing ? '...' : ctaLabel}
      </button>

      {/* 年付节省提示 */}
      {showYearlyHint && !plan.isFree ? (
        <p className="mt-2 text-center text-xs text-foreground/45">
          {plan.annualSavings ? t('saveVsMonthly', { amount: plan.annualSavings }) : t('noDiffVsMonthly')}
        </p>
      ) : null}

      {/* 权益清单 */}
      <div className="mt-5 flex flex-col gap-2.5 border-t border-white/10 pt-5">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2 text-[13px] leading-5 ${row.ok ? 'text-foreground/80' : 'text-foreground/35'}`}
          >
            {row.ok ? (
              <Check className="mt-0.5 size-4 shrink-0 text-foreground/70" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-foreground/25" />
            )}
            <span>{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
