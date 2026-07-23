'use client';

import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import {
  ImageIcon,
  Video,
  ArrowRight,
  Check,
  Coins,
  Layers3,
  Play,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { VIDEO_DEMO_CDN } from '@/lib/constants';

interface CategoryCard {
  slug: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
  previewType: 'image' | 'video';
  previewUrl: string;
  metaKeys: string[];
  accent: string;
}

const CATEGORIES: CategoryCard[] = [
  {
    slug: 'image-templates',
    titleKey: 'mktImageTitle',
    descKey: 'mktImageDesc',
    icon: ImageIcon,
    previewType: 'image',
    previewUrl: 'https://images.unsplash.com/photo-1633177317976-3f9bc45e1d1d?w=900&h=620&fit=crop',
    metaKeys: ['mktImageMetaCover', 'mktImageMetaCommerce', 'mktImageMetaPoster'],
    accent: '#38bdf8',
  },
  {
    slug: 'video-templates',
    titleKey: 'mktVideoTitle',
    descKey: 'mktVideoDesc',
    icon: Video,
    previewType: 'video',
    previewUrl: `${VIDEO_DEMO_CDN}/1770627047985_WYEvEd7j.mp4`,
    metaKeys: ['mktVideoMetaShort', 'mktVideoMetaMarketing', 'mktVideoMetaStoryboard'],
    accent: '#a78bfa',
  },
];

const MARKETPLACE_STEPS = [
  { icon: Layers3, labelKey: 'mktStepTemplate' },
  { icon: Coins, labelKey: 'mktStepPoints' },
  { icon: Check, labelKey: 'mktStepActivate' },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 0.61, 0.36, 1] as [number, number, number, number] },
  },
};

export function MarketplaceSection() {
  const t = useTranslations('landing');

  return (
    <section className="relative overflow-hidden bg-black py-20 text-white md:py-28">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-[0.18]"
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src={`${VIDEO_DEMO_CDN}/02.mp4`} type="video/mp4" />
      </video>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(2,6,23,0.86) 42%, rgba(0,0,0,0.96) 100%)',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          className="mx-auto mb-10 max-w-4xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55 }}
        >
          <p
            className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/56"
          >
            <span className="h-px w-8 bg-white/42" />
            {t('mktLabel')}
          </p>
          <h2
            className="text-4xl font-bold tracking-tight text-white md:text-6xl"
          >
            {t('mktTitle')}
          </h2>
          <p
            className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/62"
          >
            {t('mktDesc')}
          </p>
        </motion.div>

        <motion.div
          className="mx-auto mb-8 grid max-w-3xl grid-cols-1 overflow-hidden rounded-lg border border-white/12 bg-white/[0.07] backdrop-blur-xl sm:grid-cols-3"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          {MARKETPLACE_STEPS.map(({ icon: Icon, labelKey }) => (
            <div
              key={labelKey}
              className="flex items-center justify-center gap-2 border-white/10 px-4 py-3 text-xs font-medium text-white/72 sm:border-r last:sm:border-r-0"
            >
              <Icon className="size-4 text-white" />
              {t(labelKey)}
            </div>
          ))}
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-5 lg:grid-cols-2"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <motion.div key={c.slug} variants={itemVariants}>
                <Link
                  href={`/marketplace/${c.slug}`}
                  className="group block overflow-hidden rounded-lg border border-white/12 bg-white/[0.075] backdrop-blur-xl transition-transform hover:-translate-y-1"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-slate-950">
                    {c.previewType === 'video' ? (
                      <video
                        className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                        muted
                        loop
                        autoPlay
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                      >
                        <source src={c.previewUrl} type="video/mp4" />
                      </video>
                    ) : (
                      <div
                        className="h-full w-full bg-cover bg-center opacity-85 transition-transform duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url(${c.previewUrl})` }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    <div className="absolute left-4 top-4 flex items-center gap-2">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-white text-slate-950">
                        <Icon className="size-5" />
                      </span>
                      {c.previewType === 'video' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-950">
                          <Play className="size-3" />
                          {t('mktLivePreviewBadge')}
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {c.metaKeys.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white/80"
                          >
                            {t(item)}
                          </span>
                        ))}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/12">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: c.previewType === 'image' ? '72%' : '86%', backgroundColor: c.accent }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-4 p-5">
                    <div>
                      <div className="text-base font-semibold text-white">
                        {t(c.titleKey)}
                      </div>
                      <div className="mt-1 max-w-sm text-xs leading-relaxed text-white/56">
                        {t(c.descKey)}
                      </div>
                    </div>
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 transition-transform group-hover:translate-x-1"
                    >
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="text-center mt-10">
          <Link
            href="/marketplace/image-templates"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
          >
            {t('mktExploreCta')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
