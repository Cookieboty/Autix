'use client';

import { motion } from 'framer-motion';
import { Check, Coins, ImageIcon, Layers3, Play, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const VIDEO_CDN = 'https://cdn.amux.ai/playground/video/video/demo';
const GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=360&h=360&fit=crop',
  'https://images.unsplash.com/photo-1633177317976-3f9bc45e1d1d?w=360&h=360&fit=crop',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=360&h=360&fit=crop',
  'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=360&h=360&fit=crop',
];

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.55, delay, ease: [0.22, 0.61, 0.36, 1] as any },
  };
}

export function ShowcaseSection() {
  const t = useTranslations('landing');

  const pointItems = [
    { label: t('showcaseDailyCheckin'), points: '+10', status: t('showcaseCheckedIn') },
    { label: t('showcaseCreateTask'), points: '+5', status: t('showcaseGoComplete') },
    { label: t('showcaseInvite'), points: '+200', status: t('showcaseGoInvite') },
  ];

  const planFeatures = [
    t('showcasePlanPoints'),
    t('featureExport'),
    t('tagPrivate'),
    t('featureTemplate'),
  ];

  return (
    <section className="relative overflow-hidden bg-black py-24 text-white md:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#000_0%,#06111f_48%,#000_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end" {...fadeUp(0)}>
          <div>
            <p className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
              <span className="h-px w-8 bg-white/42" />
              Studio Console
            </p>
            <h2 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              内容、积分和交付状态都在一个控制台里
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-white/58">
            精选作品、会员积分、套餐权益和视频预览统一呈现，让团队能快速判断下一步创作和交付动作。
          </p>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[0.92fr_1.16fr_0.92fr]">
          <motion.div {...fadeUp(0.04)}>
            <div className="h-full rounded-lg border border-white/12 bg-white/[0.075] p-5 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{t('showcasePoints')}</h3>
                <Link href="/register" className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">
                  {t('showcaseRecharge')}
                </Link>
              </div>
              <div className="mb-6 flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-full bg-white text-slate-950">
                  <Coins className="size-6" />
                </span>
                <div>
                  <p className="text-4xl font-bold">12,560</p>
                  <p className="text-xs text-white/48">{t('showcaseCurrentPoints')}</p>
                </div>
              </div>
              <div className="space-y-3">
                {pointItems.map(({ label, points, status }) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.055] px-3 py-3 text-xs">
                    <span className="text-white/58">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{points}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/58">{status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.1)}>
            <div className="overflow-hidden rounded-lg border border-white/12 bg-white/[0.075] shadow-2xl backdrop-blur-xl">
              <div className="relative aspect-video bg-black">
                <video className="absolute inset-0 h-full w-full object-cover" muted loop autoPlay playsInline preload="metadata">
                  <source src={`${VIDEO_CDN}/1770627047985_WYEvEd7j.mp4`} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-transparent to-black/18" />
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/48">{t('showcaseGallery')}</p>
                    <h3 className="mt-2 text-3xl font-bold">精选作品预览</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/62">图像模板、视频模板和 Agent 生成结果统一回到作品库。</p>
                  </div>
                  <span className="hidden items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 md:inline-flex">
                    <Play className="size-3" /> Live
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 p-4">
                {GALLERY_IMAGES.map((src, i) => (
                  <motion.div key={src} whileHover={{ scale: 1.04 }} transition={{ duration: 0.2 }} className="relative aspect-square overflow-hidden rounded-md bg-black">
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 25vw, 10vw"
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/10" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/42 px-2 py-0.5 text-[10px] text-white/74">0{i + 1}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.16)}>
            <div className="h-full rounded-lg border border-white/12 bg-white/[0.075] p-5 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{t('showcasePricing')}</h3>
                <Link href="#pricing" className="text-xs text-white/54">{t('showcaseMorePricing')}</Link>
              </div>
              <div className="rounded-lg bg-white p-5 text-slate-950">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('planBasic')}</p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-bold">¥29</span>
                  <span className="pb-1 text-sm text-slate-500">{t('perMonth')}</span>
                </div>
                <ul className="mt-5 space-y-3">
                  {planFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                      <Check className="size-3.5 shrink-0 text-slate-950" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                  {t('showcaseSubscribe')} <Sparkles className="size-4" />
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  [ImageIcon, '作品库'],
                  [Layers3, '模板资产'],
                ].map(([Icon, label]) => {
                  const TypedIcon = Icon as typeof ImageIcon;
                  return (
                    <div key={label as string} className="rounded-lg border border-white/10 bg-white/[0.055] p-3">
                      <TypedIcon className="mb-2 size-4 text-white/70" />
                      <p className="text-xs font-semibold text-white">{label as string}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
