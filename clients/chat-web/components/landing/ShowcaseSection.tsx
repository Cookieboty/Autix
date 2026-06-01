'use client';

import { motion } from 'framer-motion';
import { Coins, Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1633177317976-3f9bc45e1d1d?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1618172193622-ae2d025f4032?w=300&h=300&fit=crop',
];

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.55, delay, ease: [0.22, 0.61, 0.36, 1] as any },
  };
}

export function ShowcaseSection() {
  const t = useTranslations('landing');

  const pointItems = [
    { label: t('showcaseDailyCheckin'), points: '+10', status: t('showcaseCheckedIn'), color: 'var(--success)' },
    { label: t('showcaseCreateTask'), points: '+5', status: t('showcaseGoComplete'), color: 'var(--brand)' },
    { label: t('showcaseInvite'), points: '+200', status: t('showcaseGoInvite'), color: 'var(--brand)' },
  ];

  const planFeatures = [
    t('showcasePlanPoints'),
    t('featureExport'),
    t('tagPrivate'),
    t('featureTemplate'),
  ];

  return (
    <section className="py-20 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1 — Points */}
          <motion.div {...fadeUp(0)}>
            <div className="rounded-2xl p-5 h-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('showcasePoints')}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full cursor-pointer" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}>{t('showcasePointsDetail')}</span>
              </div>
              <div className="flex items-center gap-3 mb-5">
                <Coins className="w-8 h-8 flex-shrink-0" style={{ color: '#f59e0b' }} />
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>12,560</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('showcaseCurrentPoints')}</p>
                </div>
              </div>
              <Link href="/register" className="block text-center text-xs py-2 rounded-lg mb-5 font-medium transition-colors" style={{ backgroundColor: 'var(--brand)', color: '#fff' }}>{t('showcaseRecharge')}</Link>
              <div className="space-y-3">
                {pointItems.map(({ label, points, status, color }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: 'var(--success)' }}>{points}</span>
                      <span className="px-1.5 py-0.5 rounded text-[11px] cursor-pointer" style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>{status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Col 2 — Gallery */}
          <motion.div {...fadeUp(0.08)}>
            <div className="rounded-2xl p-5 h-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('showcaseGallery')}</h3>
                <Link href="/login" className="text-xs" style={{ color: 'var(--brand)' }}>{t('showcaseMore')}</Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {GALLERY_IMAGES.map((src, i) => (
                  <motion.div key={i} whileHover={{ scale: 1.04 }} transition={{ duration: 0.2 }} className="relative aspect-square rounded-lg overflow-hidden cursor-pointer">
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 30vw, 10vw"
                      className="object-cover"
                      unoptimized
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Col 3 — Pricing */}
          <motion.div {...fadeUp(0.16)}>
            <div className="rounded-2xl p-5 h-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('showcasePricing')}</h3>
                <Link href="#pricing" className="text-xs" style={{ color: 'var(--brand)' }}>{t('showcaseMorePricing')}</Link>
              </div>
              <div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('planBasic')}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>¥29</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{t('perMonth')}</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {planFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                      <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--success)' }} /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="block text-center text-xs py-2.5 rounded-lg font-medium transition-colors" style={{ backgroundColor: 'var(--brand)', color: '#fff' }}>{t('showcaseSubscribe')}</Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
