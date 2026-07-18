'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAuthStore,
  useCreateOrderMutation,
  useUiStore,
} from '@autix/shared-store';
import { toast } from '../ui';
import { PublicGrowthShell } from './PublicGrowthShell';
import { SetPublicTopPromo } from './PublicTopPromo';
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
  const allPlans = useMemo(() => buildPricingPlans(levels, cycle), [levels, cycle]);
  // 主卡片区只展示付费档（Plus/Pro/Max）——参考设计无独立免费卡；无付费档时回退到全部
  const plans = useMemo(() => {
    const paid = allPlans.filter((plan) => !plan.isFree);
    return paid.length ? paid : allPlans;
  }, [allPlans]);
  const packages = useMemo(() => normalizePointsPackages(pointsPackages), [pointsPackages]);

  const planGridClass =
    plans.length === 1
      ? 'grid gap-4 mx-auto max-w-md'
      : plans.length === 2
        ? 'grid gap-4 md:grid-cols-2 mx-auto max-w-3xl'
        : plans.length === 3
          ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
          : 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';

  const handlePurchase = async (plan: PricingPlan) => {
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
    <PublicGrowthShell promo={{ label: t('promo'), href: '/membership/upgrade' }} showNav={false} showPromo={false}>
      <SetPublicTopPromo label={t('promo')} href="/membership/upgrade" />
      <main className="bg-background">
        <section>
          <div className="mx-auto max-w-6xl px-4 pt-10 md:px-6 md:pt-12">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight text-foreground md:text-4xl">
                  {t('purchaseTitle')}
                </h1>
                <p className="mt-2 text-sm leading-6 text-foreground/54 md:text-base">{t('purchaseBody')}</p>
              </div>
              <BillingCycleSwitch
                cycle={cycle}
                monthlyLabel={t('billingMonthly')}
                yearlyLabel={t('billingYearly')}
                onCycleChange={setCycle}
              />
            </div>

            {plans.length ? (
              <div className={planGridClass}>
                {plans.map((plan, index) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    tagline={index < 3 ? t(`taglines.${index}`) : undefined}
                    showYearlyHint={cycle === 'YEARLY'}
                    purchasing={
                      checkoutMutation.isPending &&
                      Boolean(plan.planId) &&
                      checkoutMutation.variables?.productId === plan.planId
                    }
                    onPurchase={() => handlePurchase(plan)}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              // 兜底演示套餐已移除：拿不到真实档位时宁可空着，也不展示编造的价格
              <p className="py-16 text-center text-sm text-foreground/45">{tCommon('noData')}</p>
            )}
          </div>
        </section>

        <ComparisonTable plans={allPlans} />
        {packages.length ? <TopUpSection packages={packages} /> : null}
      </main>
    </PublicGrowthShell>
  );
}
