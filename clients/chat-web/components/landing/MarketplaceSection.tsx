'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
  // Sparkles,
  // Wrench,
  Bot,
  ImageIcon,
  Video,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface CategoryCard {
  slug: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
  color: string;
}

const CATEGORIES: CategoryCard[] = [
  // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
  // {
  //   slug: 'skills',
  //   titleKey: 'mktSkillsTitle',
  //   descKey: 'mktSkillsDesc',
  //   icon: Sparkles,
  //   color: '#7c3aed',
  // },
  // {
  //   slug: 'mcp',
  //   titleKey: 'mktMcpTitle',
  //   descKey: 'mktMcpDesc',
  //   icon: Wrench,
  //   color: '#0891b2',
  // },
  {
    slug: 'agents',
    titleKey: 'mktAgentsTitle',
    descKey: 'mktAgentsDesc',
    icon: Bot,
    color: '#0ea5e9',
  },
  {
    slug: 'image-templates',
    titleKey: 'mktImageTitle',
    descKey: 'mktImageDesc',
    icon: ImageIcon,
    color: '#22c55e',
  },
  {
    slug: 'video-templates',
    titleKey: 'mktVideoTitle',
    descKey: 'mktVideoDesc',
    icon: Video,
    color: '#f59e0b',
  },
];

interface PromoCard {
  type: 'SKILL' | 'MCP' | 'AGENT' | 'IMAGE_TEMPLATE' | 'VIDEO_TEMPLATE';
  titleKey: string;
  category: string;
  cover: string;
  pointsCost: number;
}

/**
 * 静态精选 6 卡。后续可由运营在管理后台手动配置。
 */
const PROMOS: PromoCard[] = [
  {
    type: 'IMAGE_TEMPLATE',
    titleKey: 'mktPromoImage1',
    category: '人像',
    cover:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=450&fit=crop',
    pointsCost: 5,
  },
  // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
  // {
  //   type: 'SKILL',
  //   titleKey: 'mktPromoSkill1',
  //   category: '研发',
  //   cover:
  //     'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=450&fit=crop',
  //   pointsCost: 0,
  // },
  {
    type: 'AGENT',
    titleKey: 'mktPromoAgent1',
    category: '产品',
    cover:
      'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=600&h=450&fit=crop',
    pointsCost: 480,
  },
  // {
  //   type: 'MCP',
  //   titleKey: 'mktPromoMcp1',
  //   category: '数据',
  //   cover:
  //     'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=450&fit=crop',
  //   pointsCost: 0,
  // },
  {
    type: 'VIDEO_TEMPLATE',
    titleKey: 'mktPromoVideo1',
    category: '营销',
    cover:
      'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&h=450&fit=crop',
    pointsCost: 50,
  },
  {
    type: 'IMAGE_TEMPLATE',
    titleKey: 'mktPromoImage2',
    category: '场景',
    cover:
      'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=600&h=450&fit=crop',
    pointsCost: 5,
  },
];

const TYPE_BADGE: Record<PromoCard['type'], { label: string; color: string }> = {
  SKILL: { label: 'Skill', color: '#7c3aed' },
  MCP: { label: 'MCP', color: '#0891b2' },
  AGENT: { label: 'Agent', color: '#0ea5e9' },
  IMAGE_TEMPLATE: { label: '图片', color: '#22c55e' },
  VIDEO_TEMPLATE: { label: '视频', color: '#f59e0b' },
};

const TYPE_TO_SLUG: Record<PromoCard['type'], string> = {
  SKILL: 'skills',
  MCP: 'mcp',
  AGENT: 'agents',
  IMAGE_TEMPLATE: 'image-templates',
  VIDEO_TEMPLATE: 'video-templates',
};

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
    <section className="py-24 relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, color-mix(in srgb, var(--brand) 8%, transparent), transparent)',
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
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--foreground)' }}
          >
            {t('mktTitle')}
          </h2>
          <p
            className="mt-3 text-sm max-w-2xl mx-auto"
            style={{ color: 'var(--muted)' }}
          >
            {t('mktDesc')}
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-14"
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
                  className="block rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg group"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: c.color, color: '#fff' }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div
                    className="font-semibold text-sm"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {t(c.titleKey)}
                  </div>
                  <div
                    className="text-xs mt-1 leading-relaxed"
                    style={{ color: 'var(--muted)' }}
                  >
                    {t(c.descKey)}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-lg font-semibold"
            style={{ color: 'var(--foreground)' }}
          >
            {t('mktHotTitle')}
          </h3>
          <Link
            href="/marketplace"
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: 'var(--brand)' }}
          >
            {t('mktViewAll')} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          {PROMOS.map((p, i) => {
            const badge = TYPE_BADGE[p.type];
            const slug = TYPE_TO_SLUG[p.type];
            return (
              <motion.div key={i} variants={itemVariants}>
                <Link
                  href={`/marketplace/${slug}`}
                  className="block rounded-xl overflow-hidden transition-all group"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <span
                      className="absolute top-2 left-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: badge.color, color: '#fff' }}
                    >
                      {badge.label}
                    </span>
                    <Image
                      src={p.cover}
                      alt={t(p.titleKey)}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {t(p.titleKey)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor:
                            p.pointsCost === 0
                              ? '#22c55e'
                              : 'var(--surface-secondary)',
                          color:
                            p.pointsCost === 0
                              ? '#fff'
                              : 'var(--muted)',
                        }}
                      >
                        {p.pointsCost === 0
                          ? t('mktFree')
                          : t('mktPointsCost', { count: p.pointsCost })}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ color: 'var(--muted)' }}
                      >
                        {p.category}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="text-center mt-10">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: 'var(--brand)', color: '#fff' }}
          >
            {t('mktExploreCta')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
