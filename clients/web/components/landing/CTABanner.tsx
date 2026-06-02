'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

const ctaVideo = 'https://cdn.amux.ai/playground/video/video/demo/01.mp4';

export function CTABanner() {
  const t = useTranslations('landing');

  return (
    <section className="relative overflow-hidden bg-black px-6 py-20 text-white md:py-28">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="relative min-h-[420px] overflow-hidden rounded-lg border border-white/14 bg-black shadow-2xl"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-78"
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src={ctaVideo} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.84)_0%,rgba(0,0,0,0.55)_48%,rgba(0,0,0,0.22)_100%),linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.72)_100%)]" />

          <div className="relative flex min-h-[420px] flex-col justify-end p-6 md:p-12 lg:p-14">
            <p className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/64">
              <span className="h-px w-8 bg-white/45" />
              Start Building
            </p>
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div>
                <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                  {t('ctaTitle')}
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-white/68">
                  {t('ctaDesc')}。从第一个想法开始，把产品、内容和视频一起推进到可交付状态。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.03]">
                  {t('ctaButton')} <ArrowRight className="size-4" />
                </Link>
                <Link href="/video" className="inline-flex items-center gap-2 rounded-full border border-white/24 bg-white/10 px-7 py-3.5 text-sm font-medium text-white backdrop-blur-md transition-transform hover:scale-[1.03]">
                  视频创作 <Play className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
