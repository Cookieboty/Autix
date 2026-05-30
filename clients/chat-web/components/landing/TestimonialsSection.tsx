'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

const TESTIMONIAL_IDS = [1, 2, 3] as const;
const FAQ_IDS = [1, 2, 3, 4, 5] as const;

export function TestimonialsSection() {
  const t = useTranslations('landing');

  const testimonials = TESTIMONIAL_IDS.map((n) => ({
    name: t(`testimonial${n}Name`),
    title: t(`testimonial${n}Title`),
    content: t(`testimonial${n}Content`),
  }));
  const faqs = FAQ_IDS.map((n) => ({ q: t(`faq${n}Q`), a: t(`faq${n}A`) }));

  return (
    <section className="py-20 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Testimonials */}
          <div>
            <motion.div className="mb-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55 }}>
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{t('testimonialsTitle')}</h2>
              <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{t('testimonialsDesc')}</p>
            </motion.div>
            <div className="space-y-4">
              {testimonials.map(({ name, title, content }, i) => (
                <motion.div key={name} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.1 }} className="rounded-xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}>{name[1]}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{name}</p>
                          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{title}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, si) => (
                            <Star key={si} className="w-3.5 h-3.5 fill-current" style={{ color: '#f59e0b' }} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{content}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div id="faq">
            <motion.div className="mb-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55 }}>
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{t('faqTitle')}</h2>
              <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{t('faqDesc')}</p>
            </motion.div>
            <div className="space-y-3">
              {faqs.map(({ q, a }, i) => (
                <motion.details key={q} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay: i * 0.07 }} className="group rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium select-none" style={{ color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}>
                    <span>{q}</span>
                    <span className="text-lg" style={{ color: 'var(--muted)' }}>+</span>
                  </summary>
                  <div className="px-5 pb-4 text-xs leading-relaxed" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--muted)' }}>{a}</div>
                </motion.details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
