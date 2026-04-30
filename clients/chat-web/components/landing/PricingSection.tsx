'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function PricingSection() {
  const t = useTranslations('landing');
  const [yearly, setYearly] = useState(false);

  const plans = [
    {
      name: t('planBasic'),
      price: { monthly: '¥29', yearly: '¥23' },
      period: '/月',
      features: ['2,000 积分/月', '高清图片导出', '作品私有存储', '基础模板与提示词库', '优先无感通道'],
      cta: t('planSubscribe'),
      highlight: false,
    },
    {
      name: t('planPro'),
      price: { monthly: '¥79', yearly: '¥63' },
      period: '/月',
      badge: t('planRecommend'),
      features: ['8,000 积分/月', '高速模板与提示词库', '高清授权', '优先无感通道', '快速响应客服'],
      cta: t('planSubscribe'),
      highlight: true,
    },
    {
      name: t('planEnterprise'),
      price: { monthly: '定制', yearly: '定制' },
      period: '',
      features: ['专属服务团队', '团队多步号管理', 'API 接入支持', '私有化部署', '私有化模板资源'],
      cta: t('planContactUs'),
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div className="text-center mb-14" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55 }}>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{t('pricingTitle')}</h2>
          <div className="inline-flex items-center gap-3 mt-6 p-1 rounded-full" style={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>
            <button onClick={() => setYearly(false)} className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer" style={{ backgroundColor: !yearly ? 'var(--surface)' : 'transparent', color: !yearly ? 'var(--foreground)' : 'var(--muted)', boxShadow: !yearly ? 'var(--shadow-soft)' : 'none' }}>
              {t('pricingMonthly')}
            </button>
            <button onClick={() => setYearly(true)} className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5" style={{ backgroundColor: yearly ? 'var(--surface)' : 'transparent', color: yearly ? 'var(--foreground)' : 'var(--muted)', boxShadow: yearly ? 'var(--shadow-soft)' : 'none' }}>
              {t('pricingYearly')}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>{t('pricingSave')}</span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map(({ name, price, period, badge, features, cta, highlight }, i) => (
            <motion.div key={name} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.1 }} className="rounded-2xl p-6 relative" style={{ backgroundColor: highlight ? 'var(--accent)' : 'var(--surface)', border: highlight ? 'none' : '1px solid var(--border)', boxShadow: highlight ? '0 8px 32px rgba(201,100,66,0.3)' : 'none' }}>
              {badge && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] px-3 py-1 rounded-full font-semibold" style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}>{badge}</span>}
              <div className="mb-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: highlight ? 'rgba(255,255,255,0.75)' : 'var(--muted)' }}>{name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold" style={{ color: highlight ? '#fff' : 'var(--foreground)' }}>{yearly ? price.yearly : price.monthly}</span>
                  {period && <span style={{ color: highlight ? 'rgba(255,255,255,0.6)' : 'var(--muted)', fontSize: '14px' }}>{period}</span>}
                </div>
              </div>
              <ul className="space-y-2.5 mb-7">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: highlight ? 'rgba(255,255,255,0.8)' : 'var(--success)' }} />
                    <span style={{ color: highlight ? 'rgba(255,255,255,0.85)' : 'var(--muted)' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="block text-center py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ backgroundColor: highlight ? '#fff' : 'var(--accent)', color: highlight ? 'var(--accent)' : '#fff' }}>{cta}</Link>
            </motion.div>
          ))}
        </div>

        <motion.div className="mt-16 text-center" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }}>
          <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>{t('trustTitle')}</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {['L\'ORÉAL', 'notion', 'ByteDance', 'P&G', 'vivo'].map((logo) => (
              <span key={logo} className="text-sm font-semibold tracking-tight" style={{ color: 'var(--muted)', opacity: 0.6 }}>{logo}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
