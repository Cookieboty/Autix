'use client';

import { Check, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatCount, type PlanComparison, type PricingPlan } from '../public-pricing-helpers';
import type { TFunc } from './pricing-parts';

function renderCompareCell(
  key: keyof PlanComparison,
  comparison: PlanComparison,
  t: TFunc,
  creditUnit: string,
): React.ReactNode {
  switch (key) {
    case 'monthlyPoints':
      return (
        <span className="text-foreground/74">
          {formatCount(comparison.monthlyPoints)} {creditUnit}
        </span>
      );
    case 'videoSpec':
      if (!comparison.videoSpec)
        return (
          <span className="inline-flex items-center gap-2 text-foreground/40">
            <Minus className="size-4" />
            <span>{t('noVideo')}</span>
          </span>
        );
      return <span className="text-foreground/74">{comparison.videoSpec}</span>;
    case 'removeWatermark':
    case 'commercialLicense':
    case 'teamSpace': {
      const checked = comparison[key] as boolean;
      return checked ? (
        <span className="inline-flex items-center gap-2 text-foreground">
          <Check className="size-4 text-growth-accent" />
          <span>{t('included')}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 text-foreground/40">
          <Minus className="size-4" />
          <span>{t('notIncluded')}</span>
        </span>
      );
    }
    case 'queuePriority': {
      const p = comparison.queuePriority;
      return (
        <span className="text-foreground/74">
          {t(('queuePriority.' + p) as Parameters<TFunc>[0])}
        </span>
      );
    }
    case 'batchGeneration': {
      const b = comparison.batchGeneration;
      if (b === 'disabled')
        return (
          <span className="inline-flex items-center gap-2 text-foreground/40">
            <Minus className="size-4" />
            <span>{t('notIncluded')}</span>
          </span>
        );
      return (
        <span className="text-foreground/74">
          {t(('batchGeneration.' + b) as Parameters<TFunc>[0])}
        </span>
      );
    }
    case 'historyDays': {
      const days = comparison.historyDays;
      if (!days)
        return (
          <span className="inline-flex items-center gap-2 text-foreground/40">
            <Minus className="size-4" />
            <span>{t('notIncluded')}</span>
          </span>
        );
      return <span className="text-foreground/74">{t('historyDays', { days })}</span>;
    }
    case 'carryoverCycles': {
      const cycles = comparison.carryoverCycles;
      const maxPts = comparison.carryoverMaxPoints;
      if (!cycles)
        return (
          <span className="inline-flex items-center gap-2 text-foreground/40">
            <Minus className="size-4" />
            <span>{t('notIncluded')}</span>
          </span>
        );
      return (
        <span className="text-foreground/74">
          {t('carryover', { cycles, maxPoints: formatCount(maxPts ?? 0) })}
        </span>
      );
    }
    case 'invoiceStatus': {
      const s = comparison.invoiceStatus;
      if (!s)
        return (
          <span className="inline-flex items-center gap-2 text-foreground/40">
            <Minus className="size-4" />
            <span>{t('notIncluded')}</span>
          </span>
        );
      return (
        <span className="text-foreground/74">
          {t(('invoiceStatus.' + s) as Parameters<TFunc>[0])}
        </span>
      );
    }
    default:
      return null;
  }
}

export function ComparisonTable({ plans }: { plans: PricingPlan[] }) {
  const t = useTranslations('publicGrowth.pricing');
  const creditUnit = t('creditUnit');

  const compareRows: Array<{ key: keyof PlanComparison; label: string }> = [
    { key: 'monthlyPoints', label: t('compare.monthlyCredits') },
    { key: 'videoSpec', label: t('compare.videoCapability') },
    { key: 'removeWatermark', label: t('compare.watermarkRemoval') },
    { key: 'commercialLicense', label: t('compare.commercialRights') },
    { key: 'queuePriority', label: t('compare.queuePriority') },
    { key: 'batchGeneration', label: t('compare.batchGeneration') },
    { key: 'historyDays', label: t('compare.historyRetention') },
    { key: 'carryoverCycles', label: t('compare.creditCarryover') },
    { key: 'teamSpace', label: t('compare.teamWorkspace') },
    { key: 'invoiceStatus', label: t('compare.invoiceContract') },
  ];

  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 pt-24 md:px-6">
        <div className="mb-7 max-w-3xl">
          <h2 className="text-3xl font-black uppercase tracking-tight text-foreground md:text-4xl">
            {t('compareTitle')}
          </h2>
          <p className="mt-3 text-sm leading-6 text-foreground/60">{t('compareBody')}</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-background/30">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-foreground/10 bg-foreground/[0.04]">
                <th className="w-56 px-4 py-4 text-xs font-semibold text-foreground/50">
                  {t('comparisonFeature')}
                </th>
                {plans.map((plan) => (
                  <th key={plan.id} className="px-4 py-4 text-sm font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <span
                        className="block size-2 rounded-full"
                        style={{ backgroundColor: plan.accent }}
                      />
                      {plan.isFree ? t('freePlanName') : plan.serverName}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row) => (
                <tr key={row.key} className="border-b border-foreground/10 last:border-b-0">
                  <td className="px-4 py-4 text-sm font-semibold text-foreground/70">
                    {row.label}
                  </td>
                  {plans.map((plan) => (
                    <td key={`${plan.id}-${row.key}`} className="px-4 py-4 text-sm">
                      {renderCompareCell(row.key, plan.comparison, t, creditUnit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
