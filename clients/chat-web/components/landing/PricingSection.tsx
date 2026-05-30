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
    <section id="pricing" className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55 }}
        >
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            {t('pricingTitle')}
          </h2>
          <div
            className="inline-flex flex-wrap justify-center items-center gap-3 mt-6 p-1 rounded-full"
            style={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border)' }}
          >
            {cycleOptions.map(({ value, label, badge }) => (
              <button
                key={value}
                onClick={() => setCycle(value)}
                className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                style={{
                  backgroundColor: cycle === value ? 'var(--surface)' : 'transparent',
                  color: cycle === value ? 'var(--foreground)' : 'var(--muted)',
                  boxShadow: cycle === value ? 'var(--shadow-soft)' : 'none',
                }}
              >
                {label}
                {badge && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--brand)', color: '#fff' }}
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
                className="rounded-2xl p-6 animate-pulse"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="h-4 w-20 rounded mb-3" style={{ backgroundColor: 'var(--surface-secondary)' }} />
                <div className="h-10 w-28 rounded mb-5" style={{ backgroundColor: 'var(--surface-secondary)' }} />
                <div className="space-y-2.5 mb-7">
                  {[0, 1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="h-4 rounded"
                      style={{ backgroundColor: 'var(--surface-secondary)', width: `${70 + j * 5}%` }}
                    />
                  ))}
                </div>
                <div className="h-10 rounded-xl" style={{ backgroundColor: 'var(--surface-secondary)' }} />
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
                  className="rounded-2xl p-6 relative"
                  style={{
                    backgroundColor: highlight ? 'var(--brand)' : 'var(--surface)',
                    border: highlight ? 'none' : '1px solid var(--border)',
                    boxShadow: highlight ? '0 8px 32px rgba(201,100,66,0.3)' : 'none',
                  }}
                >
                  {highlight && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] px-3 py-1 rounded-full font-semibold"
                      style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
                    >
                      {t('planRecommend')}
                    </span>
                  )}

                  <div className="mb-5">
                    <h3
                      className="text-xs font-semibold uppercase tracking-wide mb-3"
                      style={{ color: highlight ? 'rgba(255,255,255,0.75)' : 'var(--muted)' }}
                    >
                      {level.name}
                    </h3>

                    {plan ? (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span
                            className="text-4xl font-bold"
                            style={{ color: highlight ? '#fff' : 'var(--foreground)' }}
                          >
                            ¥{plan.price}
                          </span>
                          <span style={{ color: highlight ? 'rgba(255,255,255,0.6)' : 'var(--muted)', fontSize: '14px' }}>
                            {cycleSuffix[cycle]}
                          </span>
                        </div>

                        {plan.originalPrice !== plan.price && (
                          <p
                            className="text-xs line-through mt-1"
                            style={{ color: highlight ? 'rgba(255,255,255,0.5)' : 'var(--muted)' }}
                          >
                            {t('originalPrice')} ¥{plan.originalPrice}
                          </p>
                        )}

                        {plan.firstTimePrice && (
                          <span
                            className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: highlight ? 'rgba(255,255,255,0.2)' : 'var(--surface-secondary)',
                              color: highlight ? '#fff' : 'var(--brand)',
                            }}
                          >
                            {plan.firstTimeLabel || `${t('firstTimePrice')} ¥${plan.firstTimePrice}`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-4xl font-bold" style={{ color: highlight ? '#fff' : 'var(--foreground)' }}>
                        —
                      </span>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-7">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: highlight ? 'rgba(255,255,255,0.8)' : 'var(--success)' }}
                        />
                        <span style={{ color: highlight ? 'rgba(255,255,255,0.85)' : 'var(--muted)' }}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {plan && (
                    <div className="text-center mb-3">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{
                          backgroundColor: highlight ? 'rgba(255,255,255,0.15)' : 'var(--surface-secondary)',
                          color: highlight ? 'rgba(255,255,255,0.8)' : 'var(--muted)',
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
                      backgroundColor: highlight ? '#fff' : 'var(--brand)',
                      color: highlight ? 'var(--brand)' : '#fff',
                    }}
                  >
                    {ctaLabel}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>{t('trustTitle')}</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {['L\'ORÉAL', 'notion', 'ByteDance', 'P&G', 'vivo'].map((logo) => (
              <span key={logo} className="text-sm font-semibold tracking-tight" style={{ color: 'var(--muted)', opacity: 0.6 }}>
                {logo}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
