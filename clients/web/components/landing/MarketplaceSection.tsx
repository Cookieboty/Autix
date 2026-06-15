'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
  // Sparkles,
  // Wrench,
  // Bot,
  ImageIcon,
  Video,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { VIDEO_DEMO_CDN } from '@/lib/constants';

interface CategoryCard {
  slug: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
}

const CATEGORIES: CategoryCard[] = [
  // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
  // {
  //   slug: 'skills',
  //   titleKey: 'mktSkillsTitle',
  //   descKey: 'mktSkillsDesc',
  //   icon: Sparkles,
  // },
  // {
  //   slug: 'mcp',
  //   titleKey: 'mktMcpTitle',
  //   descKey: 'mktMcpDesc',
  //   icon: Wrench,
  // },
  // {
  //   slug: 'agents',
  //   titleKey: 'mktAgentsTitle',
  //   descKey: 'mktAgentsDesc',
  //   icon: Bot,
  // },
  {
    slug: 'image-templates',
    titleKey: 'mktImageTitle',
    descKey: 'mktImageDesc',
    icon: ImageIcon,
  },
  {
    slug: 'video-templates',
    titleKey: 'mktVideoTitle',
    descKey: 'mktVideoDesc',
    icon: Video,
  },
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
    <section className="relative overflow-hidden bg-black py-24 text-white md:py-32">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-25"
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
            'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 44%, rgba(0,0,0,0.94) 100%)',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55 }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--brand)' }}
          >
            + {t('mktLabel')}
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
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
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
                  className="group block rounded-lg border border-white/12 bg-white/[0.075] p-5 backdrop-blur-xl transition-transform hover:-translate-y-1"
                >
                  <div
                    className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950 transition-transform group-hover:scale-105"
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div
                    className="text-sm font-semibold text-white"
                  >
                    {t(c.titleKey)}
                  </div>
                  <div
                    className="mt-1 text-xs leading-relaxed text-white/56"
                  >
                    {t(c.descKey)}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="text-center mt-10">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
          >
            {t('mktExploreCta')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
