'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useInsufficientPointsStore,
  useMembershipPackagesController,
  useMembershipUpgradeController,
  useMyMembershipQuery,
  type PointsPackage,
} from '@autix/shared-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from '../ui';
import { GROWTH_CTA_FOCUS } from '../growth/dialog-styles';
import {
  buildPricingPlans,
  normalizePointsPackages,
  type PricingPlan,
} from '../growth/public-pricing-helpers';
import { BillingCycleSwitch, PlanCard } from '../growth/pricing/PlanCards';
import { TopUpGrid } from '../growth/pricing/TopUpPacks';

type GateView = 'plans' | 'packages';

/** 加载占位。形状贴近真实卡片，避免数据到位时布局跳动 */
function CardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-white/10 bg-white/[0.025] p-5 ${compact ? 'h-56' : 'h-[520px]'}`}
    >
      <div className="h-6 w-1/2 rounded bg-white/10" />
      <div className="mt-4 h-20 rounded-xl bg-white/[0.06]" />
      <div className="mt-5 h-9 w-2/3 rounded bg-white/10" />
      <div className="mt-4 h-11 rounded-lg bg-white/[0.08]" />
    </div>
  );
}

type GateProps = {
  onNavigateOrder?: (orderId: string) => void;
  onNavigateUpgrade?: () => void;
  onNavigatePackages?: () => void;
  /** 「查看全部套餐」的去向，通常是 /pricing */
  onNavigatePricing?: () => void;
};

/**
 * 计费拦截全屏页。档位卡 / 周期切换 / 积分包卡一律复用 /pricing 的组件
 * （PlanCard、BillingCycleSwitch、TopUpGrid），不再另写一套近似样式 ——
 * 定价页改版时这里自动跟随，不会漂移。
 */
export function InsufficientPointsDialog(props: GateProps) {
  const open = useInsufficientPointsStore((s) => s.open);
  const closeDialog = useInsufficientPointsStore((s) => s.closeDialog);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) closeDialog(); }}>
      <DialogContent variant="fullscreen" className="px-4 py-14 md:px-6">
        {/* 计费 query 全部收在 GateBody 里：本组件常驻于 Providers，
            而 levels/packages 查询不支持 enabled，挂在顶层会让每次页面加载都白拉一轮。 */}
        {open ? <GateBody {...props} onClose={closeDialog} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function GateBody({
  onNavigateOrder,
  onNavigatePricing,
  onClose,
}: GateProps & { onClose: () => void }) {
  const t = useTranslations('insufficientPoints');
  const tPricing = useTranslations('publicGrowth.pricing');
  const tCommon = useTranslations('common');
  const payload = useInsufficientPointsStore((s) => s.payload);

  const membershipQuery = useMyMembershipQuery();
  const membership = membershipQuery.data?.membership ?? null;
  const pointsBalance = membershipQuery.data?.pointsBalance ?? null;

  const [view, setView] = useState<GateView>('plans');

  const {
    levels,
    cycle,
    setCycle,
    isLoading: plansLoading,
    purchasingId: purchasingPlanId,
    purchasePlan,
  } = useMembershipUpgradeController({
    navigateToOrder: onNavigateOrder,
  });

  const {
    packages: rawPackages,
    isLoading: packagesLoading,
    purchasingId: purchasingPackageId,
    purchasePackage,
  } = useMembershipPackagesController({
    requirePaidLevel: false,
    navigateToOrder: onNavigateOrder,
  });

  // 与 /pricing 同源：主卡片区只展示付费档，无付费档时回退到全部
  const allPlans = useMemo(() => buildPricingPlans(levels, cycle), [levels, cycle]);
  const plans = useMemo(() => {
    const paid = allPlans.filter((plan) => !plan.isFree);
    return paid.length ? paid : allPlans;
  }, [allPlans]);
  const packages = useMemo(() => normalizePointsPackages(rawPackages), [rawPackages]);

  const isPaidMember = useMemo(() => {
    if (!membership) return false;
    if (membership.status !== 'ACTIVE') return false;
    if (new Date(membership.expiresAt) <= new Date()) return false;
    return Number(membership.level?.level ?? 0) > 0;
  }, [membership]);

  const handlePurchasePlan = async (plan: PricingPlan) => {
    if (!plan.planId) {
      toast.message(tPricing('selectedPlan'));
      return;
    }
    try {
      await purchasePlan(plan.planId);
    } catch (e) {
      console.error(e);
      toast.error(tCommon('operationFailed'));
    }
  };

  const handlePurchasePackage = async (pkg: PointsPackage) => {
    try {
      await purchasePackage(pkg.id);
    } catch (e) {
      console.error(e);
      toast.error(tCommon('operationFailed'));
    }
  };

  const required = payload?.required ?? null;
  const available = payload?.available ?? pointsBalance;

  // 标题跟着触发来源走：知道被拦下的是哪个模型就说「解锁 XXX」，否则退回通用文案。
  const featureName = payload?.context?.featureName?.trim();
  const title = featureName ? t('unlockFeature', { name: featureName }) : t('unlockGeneric');
  const subtitle = featureName
    ? t('unlockFeatureDesc', { name: featureName })
    : isPaidMember
      ? t('descriptionPaid')
      : t('descriptionFree');

  // 与 /pricing 一致的列宽策略：档位少时收窄，避免卡片被拉得过宽
  const planGridClass =
    plans.length === 1
      ? 'grid gap-4 mx-auto max-w-md'
      : plans.length === 2
        ? 'grid gap-4 md:grid-cols-2 mx-auto max-w-3xl'
        : plans.length === 3
          ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
          : 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';

  return (
    <>
      <DialogHeader className="mx-auto w-full max-w-6xl items-center text-center">
        <DialogTitle className="text-3xl font-black uppercase tracking-tight text-foreground md:text-4xl">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-3 max-w-2xl text-sm leading-6 text-foreground/55">
          {subtitle}
        </DialogDescription>
        {typeof required === 'number' && typeof available === 'number' ? (
          <p className="mt-2 text-xs text-foreground/45">
            {t('shortfallSummary', {
              required,
              available,
              shortfall: Math.max(0, required - available),
            })}
          </p>
        ) : null}
      </DialogHeader>

      <div className="mx-auto mt-8 flex w-full max-w-6xl flex-col items-center">
        {view === 'plans' ? (
          <>
            <BillingCycleSwitch
              cycle={cycle}
              monthlyLabel={tPricing('billingMonthly')}
              yearlyLabel={tPricing('billingYearly')}
              onCycleChange={setCycle}
            />
            {plansLoading ? (
              <div className="mt-7 grid w-full gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
              </div>
            ) : plans.length ? (
              <div className={`mt-7 w-full ${planGridClass}`}>
                {plans.map((plan, index) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    tagline={index < 3 ? tPricing(`taglines.${index}`) : undefined}
                    showYearlyHint={cycle === 'YEARLY'}
                    purchasing={Boolean(plan.planId) && purchasingPlanId === plan.planId}
                    onPurchase={() => handlePurchasePlan(plan)}
                    t={tPricing}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-10 text-sm text-foreground/45">{tCommon('noData')}</p>
            )}
          </>
        ) : (
          <div className="w-full">
            {packagesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} compact />)}
              </div>
            ) : packages.length ? (
              <TopUpGrid
                packages={packages}
                purchasingId={purchasingPackageId}
                onPurchase={handlePurchasePackage}
              />
            ) : (
              <p className="text-center text-sm text-foreground/45">{tCommon('noData')}</p>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto mt-12 flex w-full max-w-6xl flex-col items-center gap-5">
        <p className="max-w-3xl text-center text-xs leading-5 text-foreground/40">
          {t('footnote')}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {onNavigatePricing ? (
            <button
              type="button"
              className={`inline-flex min-h-11 min-w-56 cursor-pointer items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] px-6 text-sm font-semibold text-foreground transition hover:bg-white/[0.08] ${GROWTH_CTA_FOCUS}`}
              onClick={() => {
                onClose();
                onNavigatePricing();
              }}
            >
              {t('viewPlansSecondary')}
            </button>
          ) : null}
          <button
            type="button"
            className={`inline-flex min-h-11 min-w-56 cursor-pointer items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] px-6 text-sm font-semibold text-foreground transition hover:bg-white/[0.08] ${GROWTH_CTA_FOCUS}`}
            onClick={() => setView(view === 'plans' ? 'packages' : 'plans')}
          >
            {view === 'plans' ? t('buyPacks') : t('plansHeading')}
          </button>
        </div>
      </div>
    </>
  );
}

export function InsufficientPointsGate(props: {
  onNavigateOrder?: (orderId: string) => void;
  onNavigateUpgrade?: () => void;
  onNavigatePackages?: () => void;
  onNavigatePricing?: () => void;
}) {
  return <InsufficientPointsDialog {...props} />;
}
