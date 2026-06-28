'use client';

import type { CSSProperties } from 'react';
import { ArrowRight, Check, Crown } from 'lucide-react';
import { formatCount, type BillingCycle, type PricingPlan } from '../public-pricing-helpers';
import { renderFeatureItem, type TFunc } from './pricing-parts';

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
    <div className="flex w-fit flex-wrap gap-2 rounded-lg border border-border bg-foreground/[0.05] p-1">
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

export function PlanCard({
  plan,
  showYearlyHint,
  selected,
  purchasing,
  onSelect,
  onPurchase,
  t,
}: {
  plan: PricingPlan;
  showYearlyHint: boolean;
  selected: boolean;
  purchasing: boolean;
  onSelect: () => void;
  onPurchase: () => void;
  t: TFunc;
}) {
  const creditUnit = t('creditUnit');
  const planName = plan.isFree ? t('freePlanName') : plan.serverName;
  const badgeLabel =
    plan.badgeKey === 'popular'
      ? t('popular')
      : plan.badgeKey === 'free'
        ? t('freeBadge')
        : plan.badgeKey ?? null;
  const unit =
    plan.isFree || plan.billingCycle === 'MONTHLY' ? t('perMonth') : t('perYear');
  const ctaLabel = plan.isFree ? t('freeCta') : t('choosePlan');

  return (
    <div
      role="button"
      tabIndex={0}
      className={`growth-tilt-card group relative flex min-h-[460px] cursor-pointer flex-col rounded-lg border bg-foreground/[0.045] p-5 text-left transition duration-300 hover:bg-foreground/[0.07] xl:min-h-[430px] ${selected || plan.recommended ? 'growth-plan-card-featured' : 'growth-plan-card'}`}
      style={{ '--plan-accent': plan.accent } as CSSProperties}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="mb-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div
            className="flex size-11 items-center justify-center rounded-full border bg-foreground/[0.06] growth-plan-badge"
            style={{ color: plan.accent }}
          >
            <Crown className="size-5" />
          </div>
          <div className="flex min-w-0 flex-col items-end gap-2">
            {selected ? (
              <span className="rounded-md border border-foreground/14 bg-foreground px-2 py-1 text-xs font-semibold text-background">
                {t('selectedPlan')}
              </span>
            ) : null}
            {badgeLabel ? (
              <span
                className="max-w-full truncate rounded-md px-2 py-1 text-xs font-semibold text-background"
                style={{ backgroundColor: plan.accent }}
              >
                {badgeLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-8 flex-wrap items-center gap-2">
          <h3 className="text-2xl font-semibold text-foreground">{planName}</h3>
          {plan.hasYearlyDiscount ? (
            <span className="growth-discount-badge rounded-md px-2.5 py-1 text-xs font-black italic uppercase leading-none text-foreground">
              {t('yearlyDiscountBadge')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-y border-foreground/10 py-5">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-3">
          <span className="text-4xl font-semibold text-foreground 2xl:text-5xl">{plan.price}</span>
          <span className="pb-2 text-sm text-foreground/46">{unit}</span>
        </div>
        {plan.originalPrice ? (
          <p className="mt-2 text-xs text-foreground/38 line-through">{plan.originalPrice}</p>
        ) : null}
        <p className="mt-3 text-sm font-semibold text-foreground/72">
          {formatCount(plan.points)} {creditUnit}
        </p>
        {showYearlyHint && !plan.isFree ? (
          <p className="mt-2 text-xs text-foreground/46">
            {plan.hasYearlyDiscount
              ? `${t('yearlyDiscountCaption')} · ${t('yearlyHint')}`
              : t('yearlyHint')}
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        {plan.featureItems.map((item, idx) => {
          const label = renderFeatureItem(item, t, creditUnit);
          return (
            <div
              key={`${item.kind}-${idx}`}
              className="flex items-start gap-2 text-sm leading-6 text-foreground/66"
            >
              <Check className="mt-1 size-4 shrink-0" style={{ color: plan.accent }} />
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-semibold transition disabled:cursor-not-allowed growth-plan-cta"
          disabled={purchasing}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onPurchase();
          }}
        >
          {purchasing ? '...' : ctaLabel}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
