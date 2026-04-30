'use client';

import { motion } from 'framer-motion';
import { Sparkles, LayoutTemplate, Archive, RefreshCw, Download, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

const ICONS = [Sparkles, LayoutTemplate, Archive, RefreshCw, Download, Users];
const KEYS = ['featureAi', 'featureTemplate', 'featureArchive', 'featureReuse', 'featureExport', 'featureTeam'] as const;

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as any } },
};

export function FeaturesSection() {
  const t = useTranslations('landing');

  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div className="text-center mb-14" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55 }}>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{t('featuresTitle')}</h2>
          <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>{t('featuresDesc')}</p>
        </motion.div>

        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}>
          {KEYS.map((key, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div key={key} variants={cardVariants} className="group rounded-xl p-5 transition-all duration-200" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--accent-soft)' }}>
                  <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>{t(key)}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{t(`${key}Desc`)}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
