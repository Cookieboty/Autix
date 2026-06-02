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
    <section className="relative overflow-hidden bg-black py-24 text-white md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.2),transparent_32%),linear-gradient(180deg,#000_0%,#06111f_55%,#000_100%)]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-14 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <motion.div
              className="mb-10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55 }}
            >
              <p className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                <span className="h-px w-8 bg-white/42" />
                Feedback
              </p>
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl">{t('testimonialsTitle')}</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/58">{t('testimonialsDesc')}</p>
            </motion.div>
            <div className="space-y-4">
              {testimonials.map(({ name, title, content }, i) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="rounded-lg border border-white/12 bg-white/[0.075] p-5 backdrop-blur-xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-950">
                      {name[1]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{name}</p>
                          <p className="text-[11px] text-white/42">{title}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, si) => (
                            <Star key={si} className="size-3.5 fill-current text-white" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs leading-6 text-white/58">{content}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div id="faq">
            <motion.div
              className="mb-10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55 }}
            >
              <p className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                <span className="h-px w-8 bg-white/42" />
                FAQ
              </p>
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl">{t('faqTitle')}</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/58">{t('faqDesc')}</p>
            </motion.div>
            <div className="space-y-3">
              {faqs.map(({ q, a }, i) => (
                <motion.details
                  key={q}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.07 }}
                  className="group overflow-hidden rounded-lg border border-white/12 bg-white/[0.075] backdrop-blur-xl"
                >
                  <summary className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-white">
                    <span>{q}</span>
                    <span className="text-lg text-white/46 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="border-t border-white/10 px-5 py-4 text-xs leading-6 text-white/56">{a}</div>
                </motion.details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
