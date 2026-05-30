'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'] as const;

export function WorkflowSection() {
  const t = useTranslations('landing');

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 50%, color-mix(in srgb, var(--brand) 6%, transparent), transparent)' }} />

      <div className="relative max-w-5xl mx-auto px-6">
        <motion.div className="text-center mb-14" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55 }}>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{t('workflowTitle')}</h2>
          <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>{t('workflowDesc')}</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative">
          <div className="absolute top-10 left-[12.5%] right-[12.5%] h-px hidden md:block" style={{ backgroundColor: 'var(--border)' }} />
          {STEP_KEYS.map((key, i) => (
            <motion.div key={key} className="text-center relative" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 0.61, 0.36, 1] }}>
              <div className="flex justify-center mb-4">
                <div className="relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10" style={{ backgroundColor: i === 0 ? 'var(--brand)' : 'var(--surface)', color: i === 0 ? '#fff' : 'var(--foreground)', border: `2px solid ${i === 0 ? 'var(--brand)' : 'var(--border)'}` }}>
                  {i + 1}
                </div>
              </div>
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>{i + 1}. {t(`${key}Title`)}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{t(`${key}Desc`)}</p>
            </motion.div>
          ))}
        </div>

        {/* Product screenshot placeholder */}
        <motion.div className="mt-14 rounded-2xl overflow-hidden" initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }} style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
            <div className="flex-1 mx-4 h-6 rounded px-3 text-xs flex items-center" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--muted)' }}>
              app.imageagent.ai/workspace
            </div>
          </div>
          <img
            src="https://images.unsplash.com/photo-1542744094-3a31f272c490?w=1200&h=500&fit=crop"
            alt="Platform preview"
            className="w-full h-64 object-cover"
          />
        </motion.div>
      </div>
    </section>
  );
}
