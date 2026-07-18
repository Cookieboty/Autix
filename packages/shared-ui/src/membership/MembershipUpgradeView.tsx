'use client';

import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  findRecommendedMembershipLevel,
  useMembershipUpgradeController,
  type MembershipBillingCycle,
  type MembershipLevel,
  type MembershipPlan,
} from '@autix/shared-store';
import { formatCurrency } from '../format';
import { TONE_ACCENT, type PlanTone } from '../growth/public-pricing-helpers';
import { GROWTH_CTA_FOCUS } from '../growth/dialog-styles';
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
  YEARLY: 'yearly',
};

const BILLING_CYCLES: MembershipBillingCycle[] = ['MONTHLY', 'YEARLY'];

/** 与 /pricing 的 PlanCards 保持同一套色调：neutral=白 / brand=品牌绿 / top=品红 */
const TONE_STYLE: Record<PlanTone, { accent: string; ctaText: string; tinted: boolean }> = {
  neutral: { accent: TONE_ACCENT.neutral, ctaText: 'var(--color-background)', tinted: false },
  brand: { accent: TONE_ACCENT.brand, ctaText: 'var(--color-background)', tinted: true },
  top: { accent: TONE_ACCENT.top, ctaText: '#ffffff', tinted: true },
};

/** 复刻 PlanCards 的着色卡片：品牌色描边 + 斜向微渐变 + 同色投影 */
function toneCardStyle(accent: string, tinted: boolean): CSSProperties {
  if (!tinted) return {};
  return {
    borderColor: `color-mix(in srgb, ${accent} 42%, transparent)`,
    backgroundImage: `linear-gradient(157deg, color-mix(in srgb, ${accent} 17%, transparent) 0%, color-mix(in srgb, ${accent} 5%, transparent) 42%, rgba(255,255,255,0.02) 100%)`,
    boxShadow: `0 24px 80px color-mix(in srgb, ${accent} 12%, transparent)`,
  };
}

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
    membership,
    isLoading,
    cycle,
    setCycle,
    autoRenew,
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

  const warningColor = activeColorVar === '--brand' ? 'var(--warning)' : '#f59e0b';
  const recommendedLevel = findRecommendedMembershipLevel(
    levels,
    (level) => level.plans.some((plan) => plan.billingCycle === cycle && plan.autoRenew === autoRenew),
  );
  // 最高付费档走 top 品红，与 /pricing 的分档规则一致
  const maxPaidLevel = Math.max(0, ...levels.map((level) => level.level));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1
          className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-black uppercase tracking-tight text-foreground`}
        >
          {t('upgradeMembership')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {descriptionVariant === 'card' ? (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-xs leading-5 text-foreground/60">{t(descriptionKey)}</p>
          </div>
        ) : (
          <p className="mb-5 text-xs leading-5 text-foreground/60">{t(descriptionKey)}</p>
        )}

        {membership && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold text-foreground">
                {t('currentPlan')}：{membership.level?.name ?? t('noMembership')}
              </div>
              <div className="mt-1 text-xs text-foreground/50">
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

        {/* 计费周期切换：对标 /pricing 的 BillingCycleSwitch */}
        <div className="mb-5 flex w-fit flex-wrap gap-2 rounded-xl border border-border bg-foreground/[0.05] p-1">
          {BILLING_CYCLES.map((nextCycle) => (
            <button
              key={nextCycle}
              type="button"
              onClick={() => setCycle(nextCycle)}
              className={`min-h-9 cursor-pointer rounded-md px-4 text-sm font-semibold transition ${cycle === nextCycle ? 'growth-billing-tab-active' : 'growth-billing-tab'}`}
            >
              {t(CYCLE_KEYS[nextCycle])}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {levels.map((level) => {
            const plan = getPlan(level);
            const isDowngrade = isDowngradeLevel(level);
            const isCurrent =
              membership?.status === 'ACTIVE' && level.level === currentLevelValue;
            const isRecommended = level.id === recommendedLevel?.id;
            const labels = featureLabels(level.features, t);
            const tone: PlanTone = isRecommended
              ? 'brand'
              : level.level > 0 && level.level === maxPaidLevel
                ? 'top'
                : 'neutral';
            const style = TONE_STYLE[tone];
            const disabled = !plan || purchasingId === plan?.id || isDowngrade || isCurrent;
            return (
              <div
                key={level.id}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border p-5 text-left transition duration-300 ${style.tinted ? '' : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]'} ${isDowngrade ? 'opacity-60' : ''}`}
                style={toneCardStyle(style.accent, style.tinted)}
              >
                {/* Header：名称 + 徽章 */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black uppercase tracking-tight text-foreground">
                    {level.name}
                  </h3>
                  {isCurrent ? (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase italic leading-none text-foreground/60 ring-1 ring-white/15">
                      {t('currentPlan')}
                    </span>
                  ) : isRecommended ? (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase italic leading-none"
                      style={{ backgroundColor: style.accent, color: style.ctaText }}
                    >
                      {t('recommendedBadge')}
                    </span>
                  ) : null}
                </div>

                {/* 积分盒子 */}
                {plan ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-lg font-bold text-foreground">
                      {plan.points} {t('pointsUnit')}
                    </div>
                  </div>
                ) : null}

                {/* 价格 */}
                <div className="mt-5 flex flex-wrap items-end gap-x-2">
                  {plan ? (
                    <>
                      {plan.originalPrice !== plan.price && (
                        <span className="pb-1 text-lg font-bold text-[#ff4f82] line-through">
                          {formatCurrency(plan.originalPrice)}
                        </span>
                      )}
                      <span className="text-3xl font-black text-foreground">
                        {formatCurrency(plan.price)}
                      </span>
                    </>
                  ) : (
                    <span className="text-3xl font-black text-foreground/40">-</span>
                  )}
                </div>

                {/* CTA */}
                <button
                  type="button"
                  className={`mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${GROWTH_CTA_FOCUS}`}
                  style={{ backgroundColor: style.accent, color: style.ctaText }}
                  disabled={disabled}
                  onClick={() => plan && handlePurchase(plan.id, level)}
                >
                  {isDowngrade
                    ? t('downgradeUnavailable')
                    : isCurrent
                      ? t('currentPlan')
                      : t('subscribe')}
                </button>

                {isDowngrade && (
                  <p className="mt-2 text-center text-xs text-foreground/45">
                    {t('downgradeUnavailableHint')}
                  </p>
                )}

                {/* 权益清单 */}
                {labels.length > 0 && (
                  <div className="mt-5 flex flex-1 flex-col gap-2.5 border-t border-white/10 pt-5">
                    {labels.map((label, index) => (
                      <div
                        key={`${level.id}-${index}`}
                        className="flex items-start gap-2 text-[13px] leading-5 text-foreground/80"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-foreground/70" />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
