'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  Crown,
  Gift,
  Minus,
  Package,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAuthStore,
  useCreateOrderMutation,
  useUiStore,
} from '@autix/shared-store';
import { formatCurrency } from '../format';
import { toast } from '../ui';
import { MagneticLink } from './GrowthInteractions';
import { PublicGrowthShell } from './PublicGrowthShell';
import {
  PLAN_ACCENTS,
  buildPricingPlans,
  enPricingCopy,
  formatCount,
  normalizePointsPackages,
  pointsPerDollar,
  usePricingCopy,
  type BillingCycle,
  type CompareValue,
  type PricingCopy,
  type PricingPlan,
} from './public-pricing-helpers';
import type { MembershipLevel, PointsPackage } from '@autix/shared-store';

function renderCompareValue(value: CompareValue, copy: PricingCopy) {
  if (value.kind === 'check') {
    return (
      <span className="inline-flex items-center gap-2 text-white">
        <Check className="size-4 text-[#c9ff82]" />
        <span>{value.text ?? copy.included}</span>
      </span>
    );
  }

  if (value.kind === 'dash') {
    return (
      <span className="inline-flex items-center gap-2 text-white/40">
        <Minus className="size-4" />
        <span>{value.text ?? copy.notIncluded}</span>
      </span>
    );
  }

  return <span className="text-white/74">{value.text}</span>;
}

function BillingCycleSwitch({
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
    <div className="flex w-fit flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.05] p-1">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className="min-h-9 cursor-pointer rounded-md px-4 text-sm font-semibold transition"
          style={{
            backgroundColor: cycle === value ? '#fff' : 'transparent',
            color: cycle === value ? '#050505' : 'rgba(255,255,255,0.66)',
          }}
          onClick={() => onCycleChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PlanCard({
  plan,
  showYearlyHint,
  selected,
  purchasing,
  onSelect,
  onPurchase,
}: {
  plan: PricingPlan;
  showYearlyHint: boolean;
  selected: boolean;
  purchasing: boolean;
  onSelect: () => void;
  onPurchase: () => void;
}) {
  const copy = usePricingCopy();
  const ctaLabel = plan.isFree ? copy.freeCta : copy.choosePlan;

  return (
    <div
      role="button"
      tabIndex={0}
      className="growth-tilt-card group relative flex min-h-[460px] cursor-pointer flex-col rounded-lg border bg-white/[0.045] p-5 text-left transition duration-300 hover:bg-white/[0.07] xl:min-h-[430px]"
      style={{
        borderColor: selected || plan.recommended ? plan.accent : 'rgba(255,255,255,0.1)',
        boxShadow: selected || plan.recommended
          ? `0 0 0 1px ${plan.accent}33, 0 24px 80px rgba(0,0,0,0.28)`
          : undefined,
      }}
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
            className="flex size-11 items-center justify-center rounded-full border bg-white/[0.06]"
            style={{ borderColor: `${plan.accent}55`, color: plan.accent }}
          >
            <Crown className="size-5" />
          </div>
          <div className="flex min-w-0 flex-col items-end gap-2">
            {selected ? (
              <span className="rounded-md border border-white/14 bg-white px-2 py-1 text-xs font-semibold text-black">
                {copy.selectedPlan}
              </span>
            ) : null}
            {plan.badge ? (
              <span
                className="max-w-full truncate rounded-md px-2 py-1 text-xs font-semibold text-black"
                style={{ backgroundColor: plan.accent }}
              >
                {plan.badge}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-8 flex-wrap items-center gap-2">
          <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
          {plan.yearlyDiscountLabel ? (
            <span className="rounded-md bg-[#ff0a68] px-2.5 py-1 text-xs font-black italic uppercase leading-none text-white shadow-[0_12px_28px_rgb(255_10_104/0.28)]">
              {plan.yearlyDiscountLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-y border-white/10 py-5">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-3">
          <span className="text-4xl font-semibold text-white 2xl:text-5xl">{plan.price}</span>
          <span className="pb-2 text-sm text-white/46">{plan.unit}</span>
        </div>
        {plan.originalPrice ? (
          <p className="mt-2 text-xs text-white/38 line-through">{plan.originalPrice}</p>
        ) : null}
        <p className="mt-3 text-sm font-semibold text-white/72">
          {formatCount(plan.points)} {copy.creditUnit}
        </p>
        {showYearlyHint && !plan.isFree ? (
          <p className="mt-2 text-xs text-white/46">
            {plan.yearlyDiscountLabel
              ? `${copy.yearlyDiscountCaption} · ${copy.yearlyHint}`
              : copy.yearlyHint}
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-start gap-2 text-sm leading-6 text-white/66">
            <Check className="mt-1 size-4 shrink-0" style={{ color: plan.accent }} />
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed"
          style={{
            backgroundColor: purchasing ? 'rgba(255,255,255,0.42)' : plan.accent,
            color: purchasing ? 'rgba(0,0,0,0.62)' : '#000',
          }}
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

function TopUpCard({ pkg, index }: { pkg: PointsPackage; index: number }) {
  const copy = usePricingCopy();

  return (
    <MagneticLink
      href="/membership/packages"
      className="group rounded-lg border border-white/10 bg-white/[0.045] p-5 transition duration-300 hover:border-white/22 hover:bg-white/[0.07]"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div
          className="flex size-10 items-center justify-center rounded-full bg-white/[0.08]"
          style={{ color: PLAN_ACCENTS[(index + 2) % PLAN_ACCENTS.length] }}
        >
          <Gift className="size-5" />
        </div>
        <span className="text-xs text-white/42">
          {copy.validDays.replace('{days}', String(pkg.validityDays ?? 180))}
        </span>
      </div>
      <h3 className="text-xl font-semibold text-white">{pkg.name}</h3>
      <p className="mt-2 min-h-10 text-sm leading-5 text-white/54">{pkg.description}</p>
      <div className="mt-5 border-y border-white/10 py-4">
        <p className="text-3xl font-semibold text-white">
          {formatCount(pkg.points)} <span className="text-sm text-white/46">{copy.creditUnit}</span>
        </p>
        <p className="mt-2 text-lg font-semibold text-white/84">{formatCurrency(pkg.price)}</p>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-white/58">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-white/34" />
          {copy.pointsPerDollar.replace('{ratio}', pointsPerDollar(pkg))}
        </div>
        <div className="flex items-center gap-2">
          <Minus className="size-4 text-white/34" />
          {copy.noPerks}
        </div>
      </div>
    </MagneticLink>
  );
}

export function PublicPricingView({
  levels,
  pointsPackages,
}: {
  levels?: MembershipLevel[] | null;
  pointsPackages?: PointsPackage[] | null;
}) {
  const t = useTranslations('publicGrowth.pricing');
  const tCommon = useTranslations('common');
  const copy = usePricingCopy();
  const isEnglish = copy === enPricingCopy;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const checkoutMutation = useCreateOrderMutation();
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const plans = useMemo(() => buildPricingPlans(levels, cycle, copy), [levels, cycle, copy]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const packages = useMemo(() => normalizePointsPackages(pointsPackages), [pointsPackages]);
  const selectedPlan = useMemo(
    () =>
      plans.find((plan) => plan.id === selectedPlanId) ??
      plans.find((plan) => plan.recommended) ??
      plans[0] ??
      null,
    [plans, selectedPlanId],
  );
  const purchaseTitle = isEnglish ? 'Membership purchase' : '会员购买';
  const purchaseBody = isEnglish ? 'Choose a plan and continue to checkout.' : '选择套餐，进入结账。';
  const planGridClass = plans.length === 1
    ? 'grid gap-4 xl:grid-cols-[minmax(0,560px)]'
    : plans.length === 2
      ? 'grid gap-4 lg:grid-cols-2'
      : 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';
  const compareRows: Array<{ key: keyof PricingPlan['comparison']; label: string }> = [
    { key: 'monthlyPoints', label: copy.monthlyCredits },
    { key: 'video', label: copy.videoCapability },
    { key: 'watermark', label: isEnglish ? 'Watermark removal' : '作品去水印' },
    { key: 'commercial', label: isEnglish ? 'Commercial rights' : '商用授权' },
    { key: 'queue', label: isEnglish ? 'Queue priority' : '队列优先级' },
    { key: 'batch', label: isEnglish ? 'Batch generation' : '批量生成' },
    { key: 'history', label: isEnglish ? 'History retention' : '历史保存' },
    { key: 'carryover', label: isEnglish ? 'Credit carryover' : '积分结转' },
    { key: 'team', label: isEnglish ? 'Team workspace' : '团队空间' },
    { key: 'invoice', label: isEnglish ? 'Invoice/contract' : '发票/合同' },
  ];

  useEffect(() => {
    if (!plans.length) {
      setSelectedPlanId(null);
      return;
    }
    setSelectedPlanId((current) => {
      if (current && plans.some((plan) => plan.id === current)) return current;
      return plans.find((plan) => plan.recommended)?.id ?? plans[0]?.id ?? null;
    });
  }, [plans]);

  const handlePurchase = async (plan: PricingPlan) => {
    setSelectedPlanId(plan.id);
    if (!isAuthenticated) {
      openAuthModal({ mode: plan.isFree ? 'register' : 'entry', returnTo: '/pricing' });
      return;
    }

    if (plan.isFree || !plan.planId) {
      toast.message(plan.isFree ? copy.currentFreeCta : copy.selectedPlan);
      return;
    }

    try {
      const checkout = await checkoutMutation.mutateAsync({
        orderType: 'MEMBERSHIP',
        productId: plan.planId,
      });
      if (checkout.checkoutUrl && typeof window !== 'undefined') {
        window.open(checkout.checkoutUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error(error);
      toast.error(tCommon('operationFailed'));
    }
  };

  return (
    <PublicGrowthShell promo={{ label: t('promo'), href: '/membership/upgrade' }}>
      <main className="overflow-hidden bg-[#050505]">
        <section className="relative border-b border-white/10 bg-[#050505]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:80px_80px]" />
          <div className="relative mx-auto max-w-7xl px-4 py-7 md:px-6 md:py-9">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#c9ff82]">
                  <Star className="size-4" />
                  {t('eyebrow')}
                </p>
                <h1 className="text-2xl font-semibold text-white md:text-3xl">{purchaseTitle}</h1>
                <p className="mt-2 text-sm leading-6 text-white/54">{purchaseBody}</p>
              </div>
              <BillingCycleSwitch
                cycle={cycle}
                monthlyLabel={copy.billingMonthly}
                yearlyLabel={copy.billingYearly}
                onCycleChange={setCycle}
              />
            </div>

            <div className={planGridClass}>
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  showYearlyHint={cycle === 'YEARLY'}
                  selected={selectedPlan?.id === plan.id}
                  purchasing={
                    checkoutMutation.isPending &&
                    Boolean(plan.planId) &&
                    checkoutMutation.variables?.productId === plan.planId
                  }
                  onSelect={() => setSelectedPlanId(plan.id)}
                  onPurchase={() => handlePurchase(plan)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#080b08]">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-14">
            <div className="mb-7 max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#7dd3fc]">
                <ShieldCheck className="size-4" />
                {copy.compareEyebrow}
              </p>
              <h2 className="text-3xl font-semibold text-white md:text-5xl">{copy.compareTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-white/60">{copy.compareBody}</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/30">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04]">
                    <th className="w-56 px-4 py-4 text-xs font-semibold text-white/50">
                      {copy.comparisonFeature}
                    </th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="px-4 py-4 text-sm font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className="block size-2 rounded-full"
                            style={{ backgroundColor: plan.accent }}
                          />
                          {plan.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.key} className="border-b border-white/10 last:border-b-0">
                      <td className="px-4 py-4 text-sm font-semibold text-white/70">{row.label}</td>
                      {plans.map((plan) => (
                        <td key={`${plan.id}-${row.key}`} className="px-4 py-4 text-sm">
                          {renderCompareValue(plan.comparison[row.key], copy)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-14">
          <div className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#fca5a5]">
                <Package className="size-4" />
                {copy.topUpMembershipOnly}
              </p>
              <h2 className="text-3xl font-semibold text-white md:text-5xl">{copy.topUpTitle}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">{copy.topUpBody}</p>
            </div>
            <MagneticLink
              href="/membership/packages"
              className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-md border border-white/14 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {copy.topUpCta}
              <ArrowRight className="size-4" />
            </MagneticLink>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {packages.slice(0, 4).map((pkg, index) => (
              <TopUpCard key={pkg.id} pkg={pkg} index={index} />
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#080808]">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
            <h2 className="text-3xl font-semibold text-white md:text-4xl">{copy.useCasesTitle}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {copy.useCases.map((item, index) => (
                <div key={item.title} className="rounded-lg border border-white/10 bg-black/35 p-5">
                  <div
                    className="mb-4 flex size-10 items-center justify-center rounded-full bg-white/[0.08]"
                    style={{ color: PLAN_ACCENTS[index % PLAN_ACCENTS.length] }}
                  >
                    <Sparkles className="size-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PublicGrowthShell>
  );
}
