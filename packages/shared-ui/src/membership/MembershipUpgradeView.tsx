'use client';

import { Crown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  findRecommendedMembershipLevel,
  useMembershipUpgradeController,
  type MembershipBillingCycle,
  type MembershipLevel,
  type MembershipPlan,
} from '@autix/shared-store';
import { formatCurrency } from '../format';
import { Button, SidebarTrigger, toast } from '../ui';

type MembershipUpgradeViewProps = {
  showSidebarTrigger?: boolean;
  activeColorVar?: '--brand' | '--accent';
  descriptionKey?: 'upgradeTip' | 'choosePlan';
  descriptionVariant?: 'card' | 'plain';
  showDowngradeToast?: boolean;
  showOperationErrorToast?: boolean;
  onNavigateOrder?: (orderId: string) => void;
  onCheckoutFallback?: () => void;
};

const CYCLE_KEYS: Record<MembershipBillingCycle, string> = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
};

const BILLING_CYCLES: MembershipBillingCycle[] = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

function translationValue(value: unknown, fallback: string | number) {
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
    return value;
  }
  return fallback;
}

function featureLabels(
  features: MembershipLevel['features'],
  t: (key: string, values?: Record<string, string | number | Date>) => string,
) {
  if (!features) return [];
  if (Array.isArray(features)) return features;
  const f = features as Record<string, unknown>;
  const seedance = f.seedance as Record<string, unknown> | undefined;
  return [
    f.removeWatermark ? t('featureRemoveWatermark') : null,
    f.commercialLicense ? t('featureCommercialLicense') : null,
    seedance?.enabled
      ? t('featureSeedanceEnabled', {
        resolution: translationValue(seedance.maxResolution, '720p'),
        duration: translationValue(seedance.maxDurationSeconds, 5),
      })
      : t('featureSeedanceDisabled'),
    f.queuePriority
      ? t('featureQueuePriority', { priority: translationValue(f.queuePriority, '') })
      : null,
    f.batchGeneration
      ? t('featureBatchGeneration', { batch: translationValue(f.batchGeneration, '') })
      : null,
    f.historyRetentionDays
      ? t('featureHistoryRetention', { days: translationValue(f.historyRetentionDays, '') })
      : null,
    f.teamSpace ? t('featureTeamSpace') : null,
    f.invoice ? t('featureInvoice', { invoice: translationValue(f.invoice, '') }) : null,
  ].filter(Boolean) as string[];
}

export function MembershipUpgradeView({
  showSidebarTrigger = false,
  activeColorVar = '--brand',
  descriptionKey = 'upgradeTip',
  descriptionVariant = 'card',
  showDowngradeToast = true,
  showOperationErrorToast = true,
  onNavigateOrder,
  onCheckoutFallback,
}: MembershipUpgradeViewProps) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const {
    levels,
    isFirstTime,
    membership,
    isLoading,
    cycle,
    setCycle,
    autoRenew,
    setAutoRenew,
    purchasingId,
    isCancelling,
    purchasePlan,
    cancelAtPeriodEnd,
  } = useMembershipUpgradeController({
    onCheckoutFallback,
    navigateToOrder: onNavigateOrder,
  });

  const getPlan = (level: MembershipLevel): MembershipPlan | undefined =>
    level.plans.find((plan) => plan.billingCycle === cycle && plan.autoRenew === autoRenew);

  const currentLevelValue = membership?.level?.level ?? 0;
  const isDowngradeLevel = (level: MembershipLevel) =>
    membership?.status === 'ACTIVE' &&
    membership?.expiresAt &&
    new Date(membership.expiresAt) > new Date() &&
    level.level < currentLevelValue;

  const handlePurchase = async (planId: string, level: MembershipLevel) => {
    if (isDowngradeLevel(level)) {
      if (showDowngradeToast) toast.error(t('downgradeUnavailableHint'));
      return;
    }

    try {
      await purchasePlan(planId);
    } catch (e) {
      console.error(e);
      if (showOperationErrorToast) toast.error(tCommon('operationFailed'));
    }
  };

  const handleCancelAtPeriodEnd = async () => {
    try {
      await cancelAtPeriodEnd();
    } catch (e) {
      console.error(e);
      if (showOperationErrorToast) toast.error(tCommon('operationFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  const activeBackground = `var(${activeColorVar})`;
  const activeForeground =
    activeColorVar === '--brand' ? 'var(--brand-foreground)' : '#fff';
  const warningSoft =
    activeColorVar === '--brand' ? 'var(--warning-soft)' : '#f59e0b20';
  const warningColor = activeColorVar === '--brand' ? 'var(--warning)' : '#f59e0b';
  const recommendedLevel = findRecommendedMembershipLevel(
    levels,
    (level) => level.plans.some((plan) => plan.billingCycle === cycle && plan.autoRenew === autoRenew),
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 h-12 px-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1
          className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-semibold`}
          style={{ color: 'var(--foreground)' }}
        >
          {t('upgradeMembership')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {descriptionVariant === 'card' ? (
          <div
            className="rounded-lg p-4 mb-5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {t(descriptionKey)}
            </p>
          </div>
        ) : (
          <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
            {t(descriptionKey)}
          </p>
        )}

        {membership && (
          <div
            className="rounded-lg p-4 mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                {t('currentPlan')}：{membership.level?.name ?? t('noMembership')}
              </div>
              <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                {t('expiresAt')} {new Date(membership.expiresAt).toLocaleDateString()}
                {' · '}
                {membership.cancelAtPeriodEnd ? t('cancelAtPeriodEndOn') : t('cancelAtPeriodEndOff')}
              </div>
              {membership.pendingChangeEffectiveAt && (
                <div className="mt-1 text-xs" style={{ color: warningColor }}>
                  {t('pendingPlanChange')}{' '}
                  {new Date(membership.pendingChangeEffectiveAt).toLocaleDateString()}
                </div>
              )}
            </div>
            {!membership.cancelAtPeriodEnd && membership.status === 'ACTIVE' && (
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                disabled={isCancelling}
                onClick={handleCancelAtPeriodEnd}
              >
                {t('cancelAtPeriodEnd')}
              </Button>
            )}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {BILLING_CYCLES.map((nextCycle) => (
            <button
              key={nextCycle}
              onClick={() => setCycle(nextCycle)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: cycle === nextCycle ? activeBackground : 'var(--surface)',
                color: cycle === nextCycle ? activeForeground : 'var(--foreground)',
                border: cycle === nextCycle ? 'none' : '1px solid var(--border)',
              }}
            >
              {t(CYCLE_KEYS[nextCycle])}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {[true, false].map((nextAutoRenew) => (
            <button
              key={String(nextAutoRenew)}
              onClick={() => setAutoRenew(nextAutoRenew)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: autoRenew === nextAutoRenew ? activeBackground : 'var(--surface)',
                color: autoRenew === nextAutoRenew ? activeForeground : 'var(--foreground)',
                border: autoRenew === nextAutoRenew ? 'none' : '1px solid var(--border)',
              }}
            >
              {nextAutoRenew ? t('autoRenewLabel') : t('oneTimeLabel')}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {levels.map((level) => {
            const plan = getPlan(level);
            const isDowngrade = isDowngradeLevel(level);
            const isCurrent =
              membership?.status === 'ACTIVE' && level.level === currentLevelValue;
            const isRecommended = level.id === recommendedLevel?.id;
            const isHighlight = isCurrent || (!membership && isRecommended);
            const labels = featureLabels(level.features, t);
            return (
              <div
                key={level.id}
                className="rounded-xl p-5 flex flex-col"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: isHighlight
                    ? `2px solid var(${activeColorVar})`
                    : '1px solid var(--border)',
                  opacity: isDowngrade ? 0.6 : 1,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Crown
                    className="w-4 h-4"
                    style={{ color: isHighlight ? activeBackground : 'var(--muted)' }}
                  />
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {level.name}
                  </span>
                  {isRecommended && !isCurrent && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: activeBackground, color: activeForeground }}
                    >
                      {t('recommendedBadge')}
                    </span>
                  )}
                </div>

                {plan ? (
                  <>
                    <div className="mb-3">
                      <span className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                        {formatCurrency(plan.price)}
                      </span>
                      {plan.originalPrice !== plan.price && (
                        <span
                          className="text-xs ml-2 line-through"
                          style={{ color: 'var(--muted)' }}
                        >
                          {formatCurrency(plan.originalPrice)}
                        </span>
                      )}
                      {isFirstTime && plan.firstTimePrice && (
                        <span
                          className="text-[10px] ml-2 px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: warningSoft, color: warningColor }}
                        >
                          {t('firstTimeDiscount')} {formatCurrency(plan.firstTimePrice)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                      {plan.points} {t('pointsUnit')}
                    </p>
                  </>
                ) : (
                  <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>-</p>
                )}

                {labels.length > 0 && (
                  <ul className="space-y-1.5 mb-4 flex-1">
                    {labels.map((label, index) => (
                      <li
                        key={`${level.id}-${index}`}
                        className="text-xs flex items-start gap-1.5"
                        style={{ color: 'var(--foreground)' }}
                      >
                        <span style={{ color: 'var(--success)' }}>✓</span>
                        {label}
                      </li>
                    ))}
                  </ul>
                )}

                {isDowngrade && (
                  <p className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>
                    {t('downgradeUnavailableHint')}
                  </p>
                )}

                <Button
                  size="sm"
                  className="w-full mt-auto cursor-pointer"
                  disabled={!plan || purchasingId === plan?.id || isDowngrade || isCurrent}
                  onClick={() => plan && handlePurchase(plan.id, level)}
                >
                  {isDowngrade
                    ? t('downgradeUnavailable')
                    : isCurrent
                      ? t('currentPlan')
                      : t('subscribe')}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
