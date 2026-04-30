'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function HeroSection() {
  const t = useTranslations('landing');

  const featureTags = [
    t('tagWorkflow'), t('tagPrivate'), t('tagAutoArchive'),
    t('tagManualCredit'), t('tagMultiDevice'), t('tagCommercial'),
  ];

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--accent) 12%, transparent), transparent)' }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div className="space-y-8">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
                + {t('heroLabel')}
              </p>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight" style={{ color: 'var(--foreground)' }}>
                {t('heroTitle1')}
                <br />
                {t('heroTitle2')}
              </h1>
            </motion.div>

            <motion.p className="text-base leading-relaxed max-w-md" style={{ color: 'var(--muted)' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
              {t('heroDesc')}
            </motion.p>

            <motion.div className="flex flex-wrap gap-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                {t('heroCta')} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="#pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-colors" style={{ border: '1px solid var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}>
                {t('heroCtaSecondary')}
              </Link>
            </motion.div>

            <motion.div className="flex flex-wrap gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}>
              {featureTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--accent)' }} /> {tag}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right — Product preview card */}
          <motion.div initial={{ opacity: 0, x: 32, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}>
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-panel)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Image src="/logo.png" alt="Amux Design" width={20} height={20} className="rounded" />
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('brand')}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>AI</span>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold leading-tight" style={{ color: 'var(--foreground)' }}>
                    {t('previewGenerate')}<br />{t('previewDeliver')}
                  </h2>
                  <p className="text-sm mt-3" style={{ color: 'var(--muted)' }}>{t('previewSubtitle')}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {[{ value: '∞', label: t('statContinuous') }, { value: '100%', label: t('statArchive') }, { value: '⚡', label: t('statEfficient') }].map(({ value, label }) => (
                    <div key={label} className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                      <p className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{value}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{label}</p>
                    </div>
                  ))}
                </div>
                {/* Unsplash preview images */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop',
                    'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=200&h=200&fit=crop',
                    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=200&h=200&fit=crop',
                    'https://images.unsplash.com/photo-1633177317976-3f9bc45e1d1d?w=200&h=200&fit=crop',
                    'https://images.unsplash.com/photo-1618172193622-ae2d025f4032?w=200&h=200&fit=crop',
                    'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=200&h=200&fit=crop',
                  ].map((src, i) => (
                    <img key={i} src={src} alt="" className="aspect-square rounded-lg object-cover" />
                  ))}
                </div>
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer" style={{ border: '1px solid var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--surface-secondary)' }}>
                  <span className="w-4 h-4 flex items-center justify-center rounded-full" style={{ backgroundColor: 'var(--accent)' }}>
                    <span className="text-white text-[10px]">▶</span>
                  </span>
                  {t('previewCta')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
