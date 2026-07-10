'use client';

import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { Archive, ArrowRight, Download, ImageIcon, LayoutTemplate, RefreshCw, Sparkles, Users, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useChatEnabled } from '@autix/shared-ui/hooks';
import { VIDEO_DEMO_CDN } from '@/lib/constants';
const capabilityVideo = `${VIDEO_DEMO_CDN}/high-impact-mini.mp4`;

const ICONS = [Sparkles, LayoutTemplate, Archive, RefreshCw, Download, Users];
const KEYS = ['featureAi', 'featureTemplate', 'featureArchive', 'featureReuse', 'featureExport', 'featureTeam'] as const;

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as any } },
};

export function FeaturesSection() {
  const t = useTranslations('landing');
  const chatEnabled = useChatEnabled(false);

  return (
    <section className="relative overflow-hidden bg-black py-24 text-white md:py-32">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-30"
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src={capabilityVideo} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.62)_42%,rgba(0,0,0,0.9)_100%)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <p className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/62">
              <span className="h-px w-8 bg-white/45" />
              Product OS
            </p>
            <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              {t('featuresTitle')}
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/68 md:text-lg">
              {t('featuresDesc')} {t('featuresDescSuffix')}
            </p>
          </motion.div>

          <motion.div
            className="rounded-lg border border-white/14 bg-white/10 p-4 shadow-2xl backdrop-blur-xl"
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-[#ff5f57]" />
                <span className="size-3 rounded-full bg-[#febc2e]" />
                <span className="size-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">Live workspace</span>
            </div>
            <div className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                <video className="absolute inset-0 h-full w-full object-cover" muted loop autoPlay playsInline preload="metadata">
                  <source src={`${VIDEO_DEMO_CDN}/short-film-mini.mp4`} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-xl font-bold">AI Director</p>
                  <p className="mt-1 text-sm text-white/68">{t('featuresDirectorCaption')}</p>
                </div>
              </div>
              <div className="grid gap-3">
                {[
                  ['PRD', t('featuresStatusPrd')],
                  ['Code', t('featuresStatusCode')],
                  ['Video', t('featuresStatusVideo')],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/12 bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          {KEYS.map((key, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={key}
                variants={cardVariants}
                className="group rounded-lg border border-white/12 bg-white/[0.075] p-5 backdrop-blur-xl transition-transform hover:-translate-y-1"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-md bg-white text-slate-950">
                    <Icon className="size-5" />
                  </div>
                  <span className="text-xs text-white/38">0{i + 1}</span>
                </div>
                <h3 className="text-base font-semibold text-white">{t(key)}</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">{t(`${key}Desc`)}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {chatEnabled && (
          <motion.div
            className="mt-10 grid gap-4 lg:grid-cols-2"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <WorkbenchCta
              icon={<ImageIcon className="size-5" />}
              title={t('workbenchImageTitle')}
              desc={t('workbenchImageDesc')}
              href="/workbench/image"
              cta={t('workbenchImageCta')}
            />
            <WorkbenchCta
              icon={<Video className="size-5" />}
              title={t('workbenchVideoTitle')}
              desc={t('workbenchVideoDesc')}
              href="/workbench/video"
              cta={t('workbenchVideoCta')}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}

function WorkbenchCta({
  icon,
  title,
  desc,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-white/12 bg-white/[0.075] p-5 backdrop-blur-xl transition-transform hover:-translate-y-1"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-md bg-white text-slate-950">
          {icon}
        </div>
        <ArrowRight className="size-4 text-white/45 transition-transform group-hover:translate-x-1 group-hover:text-white" />
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/58">{desc}</p>
      <p className="mt-4 text-sm font-semibold text-white">{cta}</p>
    </Link>
  );
}
