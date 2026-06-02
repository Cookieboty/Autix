'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { membershipApi, type MembershipLevel } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export function PricingSection() {
  const t = useTranslations('landing');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    membershipApi
      .getPublicLevels()
      .then((res) => setLevels(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cycleSuffix: Record<BillingCycle, string> = {
    MONTHLY: t('perMonth'),
    QUARTERLY: t('perQuarter'),
    YEARLY: t('perYear'),
  };

  const cycleOptions: { value: BillingCycle; label: string; badge?: string }[] = [
    { value: 'MONTHLY', label: t('pricingMonthly') },
    { value: 'QUARTERLY', label: t('pricingQuarterly'), badge: t('pricingQuarterlySave') },
    { value: 'YEARLY', label: t('pricingYearly'), badge: t('pricingYearlySave') },
  ];

  const ctaHref = isAuthenticated ? '/membership/upgrade' : '/register';
  const ctaLabel = isAuthenticated ? t('planUpgrade') : t('planSubscribeNow');

  return (
    <section id="pricing" className="relative overflow-hidden bg-black py-24 text-white md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.22),transparent_35%),linear-gradient(180deg,#000_0%,#07111f_52%,#000_100%)]" />
      <div className="relative mx-auto max-w-6xl px-6">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {levels.map((level, i) => {
              const plan = level.plans.find((p) => p.billingCycle === cycle && !p.autoRenew);
              const highlight = level.level === 2;
              const features: string[] = Array.isArray(level.features) ? level.features : [];

              return (
                <motion.div
                  key={level.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative rounded-lg border p-6 backdrop-blur-xl"
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
                            ¥{plan.price}
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
                            {t('originalPrice')} ¥{plan.originalPrice}
                          </p>
                        )}

                        {plan.firstTimePrice && (
                          <span
                            className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: highlight ? '#e2e8f0' : 'rgba(255,255,255,0.12)',
                              color: highlight ? '#020617' : '#fff',
                            }}
                          >
                            {plan.firstTimeLabel || `${t('firstTimePrice')} ¥${plan.firstTimePrice}`}
                          </span>
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
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
