'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Film, ImageIcon, Layers3, Play, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeLogo } from '@autix/shared-ui/brand';

const heroVideo = 'https://cdn.amux.ai/playground/video/video/demo/03.mp4';
const previewVideos = [
  'https://cdn.amux.ai/playground/video/video/demo/short-film-mini.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/high-impact-mini.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/1770627047985_WYEvEd7j.mp4',
] as const;

export function HeroSection() {
  const t = useTranslations('landing');

  const featureTags = [
    t('tagWorkflow'),
    t('tagVideoCreation'),
    t('tagTemplateMarket'),
    t('tagAutoArchive'),
    t('tagCommercial'),
  ];

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src={heroVideo} type="video/mp4" />
      </video>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.76) 0%, rgba(0,0,0,0.42) 48%, rgba(0,0,0,0.2) 100%), linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.76) 100%)',
        }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-end gap-12 px-6 py-20 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
              + {t('heroLabel')} / VIDEO STUDIO
            </p>
            <h1 className="max-w-4xl text-5xl font-bold leading-none tracking-tight text-white lg:text-7xl">
              {t('heroTitle1')}
              <br />
              {t('heroTitle2')}
            </h1>
          </motion.div>

          <motion.p
            className="max-w-2xl text-base leading-8 text-white/76 md:text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {t('heroDesc')} {t('heroVideoDescSuffix')}
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
            >
              {t('heroCta')} <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/video"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-md transition-transform hover:scale-[1.03]"
            >
              {t('heroVideoCta')} <Play className="size-4" />
            </Link>
            <Link
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-md transition-transform hover:scale-[1.03]"
            >
              {t('heroCtaSecondary')}
            </Link>
          </motion.div>

          <motion.div
            className="flex flex-wrap gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {featureTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/82 backdrop-blur-md"
              >
                <CheckCircle2 className="size-3 text-white" /> {tag}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 32, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.72, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
          className="rounded-lg border border-white/16 bg-black/30 p-4 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThemeLogo alt="Amux Studio" size={24} variant="dark" />
              <div>
                <p className="text-sm font-semibold">{t('brand')}</p>
                <p className="text-xs text-white/58">{t('previewWorkspace')}</p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">AI</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              <video className="absolute inset-0 h-full w-full object-cover" muted loop autoPlay playsInline preload="metadata">
                <source src={previewVideos[0]} type="video/mp4" />
              </video>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4">
                <p className="text-lg font-bold">{t('previewGenerate')}{t('previewDeliver')}</p>
                <p className="mt-1 text-xs text-white/70">{t('previewSubtitle')}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {previewVideos.slice(1).map((src, index) => (
                <div key={src} className="relative overflow-hidden rounded-lg bg-black" style={{ minHeight: 92 }}>
                  <video className="absolute inset-0 h-full w-full object-cover" muted loop autoPlay playsInline preload="metadata">
                    <source src={src} type="video/mp4" />
                  </video>
                  <div className="absolute inset-0 bg-black/18" />
                  <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[11px] text-white/78 backdrop-blur-md">
                    V{index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              { icon: Sparkles, label: t('statContinuous'), value: t('statAiGeneration') },
              { icon: Layers3, label: t('statArchive'), value: t('statTemplates') },
              { icon: Film, label: t('statEfficient'), value: t('statVideoDelivery') },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg bg-white/10 p-3">
                <Icon className="mb-2 size-4 text-white/78" />
                <p className="text-sm font-semibold">{value}</p>
                <p className="mt-1 text-xs text-white/55">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-white/12 bg-white/10 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm text-white/82">
              <ImageIcon className="size-4" /> {t('previewMaterialsReady')}
            </span>
            <span className="hidden rounded-full bg-white/12 px-3 py-1 text-xs text-white/72 md:inline-flex">
              {t('previewVideoFormat')}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
