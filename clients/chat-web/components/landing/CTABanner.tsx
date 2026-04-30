'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function CTABanner() {
  const t = useTranslations('landing');

  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="relative rounded-3xl overflow-hidden px-8 py-14 lg:px-14"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, #7c3aed) 100%)' }}
        >
          <div className="absolute right-10 top-1/2 -translate-y-1/2 w-56 h-56 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />
          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-white leading-tight">{t('ctaTitle')}</h2>
              <p className="mt-3 text-sm text-white/75">{t('ctaDesc')}</p>
            </div>
            <Link href="/register" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0" style={{ backgroundColor: '#fff', color: 'var(--accent)' }}>
              {t('ctaButton')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
