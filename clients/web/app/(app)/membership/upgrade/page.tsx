'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, SidebarTrigger, toast } from '@autix/shared-ui/ui';
import { Crown } from 'lucide-react';
import {
  membershipApi,
  orderApi,
  type MembershipInfo,
  type MembershipLevel,
  type MembershipPlan,
} from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

const CYCLE_KEYS: Record<BillingCycle, string> = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
};

function featureLabels(features: MembershipLevel['features'], t: (key: string, values?: Record<string, any>) => string) {
  if (!features) return [];
  if (Array.isArray(features)) return features;
  const f = features as Record<string, any>;
  const seedance = f.seedance as Record<string, any> | undefined;
  return [
    f.removeWatermark ? t('featureRemoveWatermark') : null,
    f.commercialLicense ? t('featureCommercialLicense') : null,
    seedance?.enabled
      ? t('featureSeedanceEnabled', { resolution: seedance.maxResolution ?? '720p', duration: seedance.maxDurationSeconds ?? 5 })
      : t('featureSeedanceDisabled'),
    f.queuePriority ? t('featureQueuePriority', { priority: f.queuePriority }) : null,
    f.batchGeneration ? t('featureBatchGeneration', { batch: f.batchGeneration }) : null,
    f.historyRetentionDays ? t('featureHistoryRetention', { days: f.historyRetentionDays }) : null,
    f.teamSpace ? t('featureTeamSpace') : null,
    f.invoice ? t('featureInvoice', { invoice: f.invoice }) : null,
  ].filter(Boolean) as string[];
}

export default function UpgradePage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [autoRenew, setAutoRenew] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipInfo['membership']>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    Promise.all([membershipApi.getLevels(), membershipApi.getMe()])
      .then(([levelsRes, meRes]) => {
        const data = levelsRes.data as any;
        setLevels(data.levels ?? data ?? []);
        setIsFirstTime(data.isFirstTime ?? false);
        setMembership((meRes.data as MembershipInfo).membership);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getPlan = (level: MembershipLevel): MembershipPlan | undefined =>
    level.plans.find((p) => p.billingCycle === cycle && p.autoRenew === autoRenew);

  const currentLevelValue = membership?.level?.level ?? 0;
  const isDowngradeLevel = (level: MembershipLevel) =>
    membership?.status === 'ACTIVE' &&
    membership?.expiresAt &&
    new Date(membership.expiresAt) > new Date() &&
    level.level < currentLevelValue;

  const handlePurchase = async (planId: string, level: MembershipLevel) => {
    if (isDowngradeLevel(level)) {
      toast.error(t('downgradeUnavailableHint'));
      return;
    }
    setPurchasing(planId);
    try {
      const res = await orderApi.createStripeCheckout({
        orderType: 'MEMBERSHIP',
        productId: planId,
      });
      const checkout = res.data;
      if (checkout.checkoutUrl) {
        window.location.assign(checkout.checkoutUrl);
        return;
      }
      router.push('/membership/orders');
    } catch (e) {
      console.error(e);
      toast.error(tCommon('operationFailed'));
    } finally {
      setPurchasing(null);
    }
  };

  const handleCancelAtPeriodEnd = async () => {
    setCancelling(true);
    try {
      const res = await membershipApi.cancelAtPeriodEnd();
      setMembership(res.data as MembershipInfo['membership']);
    } catch (e) {
      console.error(e);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 h-12 px-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <SidebarTrigger className="-ml-1" />
        <h1 className="ml-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('upgradeMembership')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div
          className="rounded-lg p-4 mb-5"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('upgradeTip')}
          </p>
        </div>

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
                <div className="mt-1 text-xs" style={{ color: 'var(--warning)' }}>
                  {t('pendingPlanChange')} {new Date(membership.pendingChangeEffectiveAt).toLocaleDateString()}
                </div>
              )}
            </div>
            {!membership.cancelAtPeriodEnd && membership.status === 'ACTIVE' && (
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                disabled={cancelling}
                onClick={handleCancelAtPeriodEnd}
              >
                {t('cancelAtPeriodEnd')}
              </Button>
            )}
          </div>
        )}

        {/* Billing cycle tabs */}
        <div className="flex gap-2 mb-4">
          {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: cycle === c ? 'var(--brand)' : 'var(--surface)',
                color: cycle === c ? 'var(--brand-foreground)' : 'var(--foreground)',
                border: cycle === c ? 'none' : '1px solid var(--border)',
              }}
            >
              {t(CYCLE_KEYS[c])}
            </button>
          ))}
        </div>

        {/* Auto-renew toggle */}
        <div className="flex gap-2 mb-6">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              onClick={() => setAutoRenew(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: autoRenew === v ? 'var(--brand)' : 'var(--surface)',
                color: autoRenew === v ? 'var(--brand-foreground)' : 'var(--foreground)',
                border: autoRenew === v ? 'none' : '1px solid var(--border)',
              }}
            >
              {v ? t('autoRenewLabel') : t('oneTimeLabel')}
            </button>
          ))}
        </div>

        {/* Level cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {levels.map((level) => {
            const plan = getPlan(level);
            const isHighlight = level.level === 2;
            const isDowngrade = isDowngradeLevel(level);
            const isCurrent =
              membership?.status === 'ACTIVE' && level.level === currentLevelValue;
            const labels = featureLabels(level.features, t);
            return (
              <div
                key={level.id}
                className="rounded-xl p-5 flex flex-col"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: isHighlight ? '2px solid var(--brand)' : '1px solid var(--border)',
                  opacity: isDowngrade ? 0.6 : 1,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Crown
                    className="w-4 h-4"
                    style={{ color: isHighlight ? 'var(--brand)' : 'var(--muted)' }}
                  />
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {level.name}
                  </span>
                  {isHighlight && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
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
                          style={{ backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}
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
                    {labels.map((f, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--foreground)' }}>
                        <span style={{ color: 'var(--success)' }}>✓</span>
                        {f}
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
                  disabled={!plan || purchasing === plan?.id || isDowngrade || isCurrent}
                  onClick={() => plan && handlePurchase(plan.id, level)}
                >
                  {isDowngrade ? t('downgradeUnavailable') : isCurrent ? t('currentPlan') : t('subscribe')}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
