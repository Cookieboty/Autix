'use client';

import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAuthStore,
  useCreateOrderMutation,
  useUiStore,
} from '@autix/shared-store';
import { toast } from '../ui';
import { PublicGrowthShell } from './PublicGrowthShell';
import {
  buildPricingPlans,
  normalizePointsPackages,
  type BillingCycle,
  type PricingPlan,
} from './public-pricing-helpers';
import type { MembershipLevel, PointsPackage } from '@autix/shared-store';
import { BillingCycleSwitch, PlanCard } from './pricing/PlanCards';
import { ComparisonTable } from './pricing/ComparisonTable';
import { TopUpSection } from './pricing/TopUpPacks';
import { UseCasesSection } from './pricing/UseCasesSection';

export function PublicPricingView({
  levels,
  pointsPackages,
}: {
  levels?: MembershipLevel[] | null;
  pointsPackages?: PointsPackage[] | null;
}) {
  const t = useTranslations('publicGrowth.pricing');
  const tCommon = useTranslations('common');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const checkoutMutation = useCreateOrderMutation();
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const plans = useMemo(() => buildPricingPlans(levels, cycle), [levels, cycle]);
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

  const planGridClass =
    plans.length === 1
      ? 'grid gap-4 xl:grid-cols-[minmax(0,560px)]'
      : plans.length === 2
        ? 'grid gap-4 lg:grid-cols-2'
        : 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';

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
      toast.message(plan.isFree ? t('currentFreeCta') : t('selectedPlan'));
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
    <PublicGrowthShell promo={{ label: t('promo'), href: '/membership/upgrade' }} showNav={false}>
      <main className="overflow-hidden bg-background">
        <section className="relative border-b border-foreground/10 bg-background">
          <div className="growth-pricing-grid-overlay" />
          <div className="relative mx-auto max-w-7xl px-4 py-7 md:px-6 md:py-9">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-growth-accent">
                  <Star className="size-4" />
                  {t('eyebrow')}
                </p>
                <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                  {t('purchaseTitle')}
                </h1>
                <p className="mt-2 text-sm leading-6 text-foreground/54">{t('purchaseBody')}</p>
              </div>
              <BillingCycleSwitch
                cycle={cycle}
                monthlyLabel={t('billingMonthly')}
                yearlyLabel={t('billingYearly')}
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
                  t={t}
                />
              ))}
            </div>
          </div>
        </section>

        <ComparisonTable plans={plans} />
        <TopUpSection packages={packages} />
        <UseCasesSection />
      </main>
    </PublicGrowthShell>
  );
}
