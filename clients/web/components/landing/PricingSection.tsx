'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '@autix/shared-ui/format';
import {
  findRecommendedMembershipLevel,
  membershipUserActions,
  useAuthStore,
  type MembershipLevel,
} from '@autix/shared-store';

type BillingCycle = 'MONTHLY' | 'YEARLY';

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getLandingPlan(level: MembershipLevel, cycle: BillingCycle) {
  return level.plans.find((plan) => plan.billingCycle === cycle && plan.autoRenew)
    ?? level.plans.find((plan) => plan.billingCycle === cycle);
}

export function PricingSection() {
  const t = useTranslations('landing');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    membershipUserActions
      .listPublicLevels()
      .then(setLevels)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cycleSuffix: Record<BillingCycle, string> = {
    MONTHLY: t('perMonth'),
    YEARLY: t('perYear'),
  };

  const cycleOptions: { value: BillingCycle; label: string; badge?: string }[] = [
    { value: 'MONTHLY', label: t('pricingMonthly') },
    { value: 'YEARLY', label: t('pricingYearly'), badge: t('pricingYearlySave') },
  ];

  const ctaHref = isAuthenticated ? '/membership/upgrade' : '/register';
  const ctaLabel = isAuthenticated ? t('planUpgrade') : t('planSubscribeNow');
  const sortedLevels = [...levels].sort((a, b) => (a.sort ?? a.level) - (b.sort ?? b.level));
  const displayedLevels = sortedLevels.slice(0, 3);
  const recommendedLevel = findRecommendedMembershipLevel(
    displayedLevels,
    (level) => Boolean(getLandingPlan(level, cycle)),
  );

  const formatFeatureItems = (features: MembershipLevel['features']) => {
    if (Array.isArray(features)) {
      return features.filter((feature): feature is string => Boolean(feature));
    }

    if (!features || typeof features !== 'object') {
      return [];
    }

    const source = features as Record<string, unknown>;
    const seedance = source.seedance && typeof source.seedance === 'object'
      ? source.seedance as Record<string, unknown>
      : {};
    const historyRetentionDays = readNumber(source.historyRetentionDays);
    const seedanceDuration = readNumber(seedance.maxDurationSeconds);
    const seedanceConcurrency = readNumber(seedance.concurrency);
    const items: string[] = [];

    if (source.removeWatermark) items.push(t('featureRemoveWatermark'));
    if (source.commercialLicense) items.push(t('featureCommercialLicense'));
    if (seedance.enabled) {
      items.push(t('featureVideoGeneration', {
        resolution: typeof seedance.maxResolution === 'string' ? seedance.maxResolution : '720p',
        duration: seedanceDuration ?? 5,
        concurrency: seedanceConcurrency ?? 1,
      }));
    }
    if (historyRetentionDays) {
      items.push(t('featureHistoryRetention', { days: historyRetentionDays }));
    }
    if (typeof source.queuePriority === 'string' && source.queuePriority) {
      items.push(t('featureQueuePriority', { value: source.queuePriority }));
    }
    if (typeof source.batchGeneration === 'string' && source.batchGeneration) {
      items.push(t('featureBatchGeneration', { value: source.batchGeneration }));
    }
    if (source.teamSpace) items.push(t('featureTeamSpace'));
    if (typeof source.invoice === 'string' && source.invoice) {
      items.push(t('featureInvoice', { value: source.invoice }));
    }

    return items;
  };

  return (
    <section id="pricing" className="relative overflow-hidden bg-black py-24 text-white md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.22),transparent_35%),linear-gradient(180deg,#000_0%,#07111f_52%,#000_100%)]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55 }}
        >
          <p className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
            <span className="h-px w-8 bg-white/42" />
            Membership
          </p>
          <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
            {t('pricingTitle')}
          </h2>
          <div
            className="mt-8 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.075] p-1 backdrop-blur-xl"
          >
            {cycleOptions.map(({ value, label, badge }) => (
              <button
                key={value}
                onClick={() => setCycle(value)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors"
                style={{ backgroundColor: cycle === value ? '#fff' : 'transparent', color: cycle === value ? '#020617' : 'rgba(255,255,255,0.58)' }}
              >
                {label}
                {badge && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ backgroundColor: cycle === value ? '#020617' : 'rgba(255,255,255,0.14)', color: cycle === value ? '#fff' : 'rgba(255,255,255,0.74)' }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-white/12 bg-white/[0.075] p-6"
              >
                <div className="mb-3 h-4 w-20 rounded bg-white/12" />
                <div className="mb-5 h-10 w-28 rounded bg-white/12" />
                <div className="space-y-2.5 mb-7">
                  {[0, 1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="h-4 rounded bg-white/12"
                      style={{ width: `${70 + j * 5}%` }}
                    />
                  ))}
                </div>
                <div className="h-10 rounded-xl bg-white/12" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {displayedLevels.map((level, i) => {
                const plan = getLandingPlan(level, cycle);
                const highlight = level.id === recommendedLevel?.id;
                const features = formatFeatureItems(level.features);

                return (
                  <motion.div
                    key={level.id}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="relative flex flex-col rounded-lg border p-6 backdrop-blur-xl"
                    style={{
                      backgroundColor: highlight ? '#fff' : 'rgba(255,255,255,0.075)',
                      borderColor: highlight ? '#fff' : 'rgba(255,255,255,0.12)',
                      color: highlight ? '#020617' : '#fff',
                    }}
                  >
                    {highlight && (
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] px-3 py-1 rounded-full font-semibold"
                        style={{ backgroundColor: '#020617', color: '#fff' }}
                      >
                        {t('planRecommend')}
                      </span>
                    )}

                    <div className="mb-5">
                      <h3
                        className="text-xs font-semibold uppercase tracking-wide mb-3"
                        style={{ color: highlight ? '#64748b' : 'rgba(255,255,255,0.5)' }}
                      >
                        {level.name}
                      </h3>

                      {plan ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span
                              className="text-4xl font-bold"
                              style={{ color: highlight ? '#020617' : '#fff' }}
                            >
                              {formatCurrency(plan.price)}
                            </span>
                            <span style={{ color: highlight ? '#64748b' : 'rgba(255,255,255,0.52)', fontSize: '14px' }}>
                              {cycleSuffix[cycle]}
                            </span>
                          </div>

                          {plan.originalPrice !== plan.price && (
                            <p
                              className="text-xs line-through mt-1"
                              style={{ color: highlight ? '#94a3b8' : 'rgba(255,255,255,0.42)' }}
                            >
                              {t('originalPrice')} {formatCurrency(plan.originalPrice)}
                            </p>
                          )}

                        </>
                      ) : (
                        <span className="text-4xl font-bold" style={{ color: highlight ? '#020617' : '#fff' }}>
                          —
                        </span>
                      )}
                    </div>

                    <ul className="space-y-2.5 mb-7">
                      {features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: highlight ? '#020617' : '#fff' }}
                          />
                          <span style={{ color: highlight ? '#475569' : 'rgba(255,255,255,0.62)' }}>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto">
                      {plan && (
                        <div className="text-center mb-3">
                          <span
                            className="text-xs px-2.5 py-1 rounded-full"
                            style={{
                              backgroundColor: highlight ? '#e2e8f0' : 'rgba(255,255,255,0.12)',
                              color: highlight ? '#475569' : 'rgba(255,255,255,0.62)',
                            }}
                          >
                            {t('planPointsIncluded', { points: plan.points.toLocaleString() })}
                          </span>
                        </div>
                      )}

                      <Link
                        href={ctaHref}
                        className="block text-center py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          backgroundColor: highlight ? '#020617' : '#fff',
                          color: highlight ? '#fff' : '#020617',
                        }}
                      >
                        {ctaLabel}
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <p className="mt-5 text-center text-xs leading-5 text-white/52">
              {t('higherPlanIncludesPrevious')}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
