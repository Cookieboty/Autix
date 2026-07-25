'use client';

import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Layers3,
  MessageSquareText,
  Play,
  Scissors,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useChatEnabled } from '@autix/shared-ui/hooks';
import { VIDEO_DEMO_CDN } from '@/lib/constants';

const heroVideos = [
  `${VIDEO_DEMO_CDN}/01.mp4`,
  `${VIDEO_DEMO_CDN}/02.mp4`,
  `${VIDEO_DEMO_CDN}/03.mp4`,
  `${VIDEO_DEMO_CDN}/04.mp4`,
  `${VIDEO_DEMO_CDN}/05.mp4`,
  `${VIDEO_DEMO_CDN}/06.mp4`,
] as const;

const showcaseVideos = [
  {
    titleKey: 'videoShowcaseNarrativeTitle',
    descKey: 'videoShowcaseNarrativeDesc',
    src: `${VIDEO_DEMO_CDN}/short-film-mini.mp4`,
  },
  {
    titleKey: 'videoShowcaseCameraTitle',
    descKey: 'videoShowcaseCameraDesc',
    src: `${VIDEO_DEMO_CDN}/03.mp4`,
  },
  {
    titleKey: 'videoShowcaseActionTitle',
    descKey: 'videoShowcaseActionDesc',
    src: `${VIDEO_DEMO_CDN}/action-v2-mini.mp4`,
  },
  {
    titleKey: 'videoShowcaseCampaignTitle',
    descKey: 'videoShowcaseCampaignDesc',
    src: `${VIDEO_DEMO_CDN}/compaign-mini.mp4`,
  },
  {
    titleKey: 'videoShowcaseProductTitle',
    descKey: 'videoShowcaseProductDesc',
    src: `${VIDEO_DEMO_CDN}/high-impact-mini.mp4`,
  },
  {
    titleKey: 'videoShowcaseAudioTitle',
    descKey: 'videoShowcaseAudioDesc',
    src: `${VIDEO_DEMO_CDN}/1770627047985_WYEvEd7j.mp4`,
  },
] as const;

const quickStartSteps = [
  {
    icon: Layers3,
    label: 'Templates',
    titleKey: 'videoQuickTemplatesTitle',
    descKey: 'videoQuickTemplatesDesc',
    metaKey: 'videoQuickTemplatesMeta',
  },
  {
    icon: MessageSquareText,
    label: 'Chat',
    titleKey: 'videoQuickChatTitle',
    descKey: 'videoQuickChatDesc',
    metaKey: 'videoQuickChatMeta',
  },
  {
    icon: WandSparkles,
    label: 'Agents',
    titleKey: 'videoQuickAgentsTitle',
    descKey: 'videoQuickAgentsDesc',
    metaKey: 'videoQuickAgentsMeta',
  },
  {
    icon: Film,
    label: 'Workflow',
    titleKey: 'videoQuickWorkflowTitle',
    descKey: 'videoQuickWorkflowDesc',
    metaKey: 'videoQuickWorkflowMeta',
  },
] as const;

const templateCardKeys = ['Opening', 'Product', 'Holiday', 'Talking'] as const;
const workflowKeys = ['Template', 'Materials', 'Director', 'Delivery'] as const;
const videoStatKeys = ['Templates', 'Materials', 'Output'] as const;
const shotKeys = ['One', 'Two', 'Three'] as const;

const contentClass = 'mx-auto max-w-[88rem] px-6';
const railPadding = {
  paddingLeft: 'max(1.5rem, calc((100vw - 88rem) / 2 + 1.5rem))',
  paddingRight: 'max(1.5rem, calc((100vw - 88rem) / 2 + 1.5rem))',
  scrollPaddingLeft: 'max(1.5rem, calc((100vw - 88rem) / 2 + 1.5rem))',
};

function useInViewOnce() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.16 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, inView] as const;
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [ref, inView] = useInViewOnce();

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ${
        inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--brand)' }}>
      <span className="h-px w-8" style={{ backgroundColor: 'var(--brand)', opacity: 0.55 }} />
      {children}
    </p>
  );
}

function HoverSoundVideo({ src, label, className = '' }: { src: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (typeof IntersectionObserver === 'undefined') {
      void video.play().catch(() => {});
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.24 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      aria-label={label}
      className={className}
      muted
      loop
      playsInline
      preload="metadata"
      onMouseEnter={() => {
        if (ref.current) ref.current.muted = false;
      }}
      onMouseLeave={() => {
        if (ref.current) ref.current.muted = true;
      }}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

function VideoHero() {
  const t = useTranslations('landing');
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [inView, setInView] = useState(true);
  const chatEnabled = useChatEnabled(false);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === active && inView) {
        video.muted = muted;
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [active, inView, muted]);

  useEffect(() => {
    const element = heroRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        setInView(visible);
        if (!visible) setMuted(true);
      },
      { threshold: 0.05 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const next = () => setActive((current) => (current + 1) % heroVideos.length);
  const stats = videoStatKeys.map((key) => ({ label: t(`videoHeroStat${key}Label`), value: t(`videoHeroStat${key}Value`) }));

  return (
    <section
      ref={heroRef}
      className="relative min-h-[640px] overflow-hidden"
      style={{ height: '100dvh' }}
      onMouseEnter={() => setMuted(false)}
      onMouseLeave={() => setMuted(true)}
    >
      <div
        className="fixed inset-0 bg-black transition-opacity duration-500"
        style={{ zIndex: 0, opacity: inView ? 1 : 0 }}
        aria-hidden="true"
      >
        {heroVideos.map((src, index) => (
          <video
            key={src}
            ref={(element) => {
              videoRefs.current[index] = element;
            }}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
            style={{ opacity: active === index ? 1 : 0 }}
            muted
            playsInline
            preload={index === 0 ? 'auto' : 'metadata'}
            onEnded={active === index ? next : undefined}
          >
            <source src={src} type="video/mp4" />
          </video>
        ))}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.08) 34%, rgba(0,0,0,0.7) 100%)',
          }}
        />
      </div>

      <div className="relative z-10 flex h-full items-end">
        <div className="w-full pb-10 md:pb-14" style={railPadding}>
          <motion.div
            className="grid gap-8 lg:grid-cols-[1fr_28rem] lg:items-end"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div>
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.26em] text-white/70">
                + {t('videoHeroEyebrow')}
              </p>
              <h1 className="max-w-5xl text-5xl font-bold leading-none tracking-tight text-white md:text-7xl">
                {t('videoHeroTitle1')}
                <br className="hidden md:block" />
                {t('videoHeroTitle2')}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/76 md:text-lg">
                {t('videoHeroDesc')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/marketplace/video-templates"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
                >
                  {t('videoHeroTemplatesCta')} <ArrowRight className="size-4" />
                </Link>
                {chatEnabled && (
                  <Link
                    href="/chat"
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-transform hover:scale-[1.03]"
                  >
                    {t('videoHeroWorkbenchCta')} <Play className="size-4" />
                  </Link>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-transform hover:scale-[1.03]"
                  onClick={() => setMuted((value) => !value)}
                >
                  {muted ? t('videoHeroUnmute') : t('videoHeroMute')}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/16 bg-black/28 p-4 text-white shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-md bg-white text-slate-950">
                    <Film className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t('videoHeroShotBoard')}</p>
                    <p className="text-xs text-white/58">{t('videoHeroShotBoardDesc')}</p>
                  </div>
                </div>
                <span className="rounded-full bg-white/12 px-2.5 py-1 text-xs text-white/76">1080p</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {heroVideos.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className="h-1.5 rounded-full transition-colors"
                    style={{ backgroundColor: active === index ? '#fff' : 'rgba(255,255,255,0.24)' }}
                    aria-label={t('videoHeroSwitchVideo', { index: index + 1 })}
                    onClick={() => setActive(index)}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                {stats.map(({ label, value }) => (
                  <div key={label} className="rounded-md bg-white/10 px-2 py-2">
                    <p className="text-white/56">{label}</p>
                    <p className="mt-1 font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function OverviewSection() {
  const t = useTranslations('landing');

  return (
    <section className="relative py-24 md:py-32">
      <Reveal className={contentClass}>
        <Eyebrow>{t('videoOverviewEyebrow')}</Eyebrow>
        <h2 className="max-w-5xl text-4xl font-bold leading-tight tracking-tight md:text-6xl" style={{ color: 'var(--foreground)' }}>
          {t('videoOverviewTitle')}
        </h2>
        <p className="mt-6 max-w-3xl text-base leading-8 md:text-xl" style={{ color: 'var(--muted)' }}>
          {t('videoOverviewDesc')}
        </p>
      </Reveal>
    </section>
  );
}

function ShowcaseRail() {
  const t = useTranslations('landing');
  const scroller = useRef<HTMLDivElement | null>(null);

  const scrollByCard = (direction: -1 | 1) => {
    const element = scroller.current;
    if (!element) return;
    const card = element.querySelector<HTMLElement>('[data-video-card]');
    const step = card ? card.offsetWidth + 20 : element.clientWidth * 0.82;
    element.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <section className="py-16 md:py-24">
      <Reveal className={`${contentClass} mb-10 md:mb-12`}>
        <Eyebrow>{t('videoShowcaseEyebrow')}</Eyebrow>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
              {t('videoShowcaseTitle')}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: 'var(--muted)' }}>
              {t('videoShowcaseDesc')}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              aria-label={t('videoShowcasePrev')}
              className="flex size-11 items-center justify-center rounded-full border transition-colors hover:bg-white/10"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              onClick={() => scrollByCard(-1)}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label={t('videoShowcaseNext')}
              className="flex size-11 items-center justify-center rounded-full border transition-colors hover:bg-white/10"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              onClick={() => scrollByCard(1)}
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      </Reveal>

      <div
        ref={scroller}
        className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto"
        style={railPadding}
      >
        {showcaseVideos.map((item) => {
          const title = t(item.titleKey);
          const desc = t(item.descKey);

          return (
          <article key={item.titleKey} data-video-card className="shrink-0 snap-start" style={{ width: 'clamp(320px, 54vw, 980px)' }}>
            <div className="group relative aspect-video overflow-hidden rounded-lg bg-black">
              <HoverSoundVideo
                src={item.src}
                label={title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 to-transparent p-5 text-white">
                <p className="text-lg font-semibold">{title}</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">{desc}</p>
              </div>
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs text-white/80 backdrop-blur-md">
                {t('videoShowcaseHoverSound')}
              </div>
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function StudioWorkflowSection() {
  const t = useTranslations('landing');
  const workflow = workflowKeys.map((key) => ({ title: t(`videoWorkflow${key}Title`), desc: t(`videoWorkflow${key}Desc`) }));
  const shots = shotKeys.map((key) => ({ title: t(`videoWorkflowShot${key}Title`), desc: t(`videoWorkflowShot${key}Desc`) }));

  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: 'var(--surface-secondary)' }}>
      <div className={contentClass}>
        <Reveal>
          <Eyebrow>{t('videoDirectorEyebrow')}</Eyebrow>
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
                {t('videoWorkflowTitle')}
              </h2>
              <p className="mt-5 text-base leading-8" style={{ color: 'var(--muted)' }}>
                {t('videoWorkflowDesc')}
              </p>
              <div className="mt-8 grid gap-3">
                {workflow.map((item, index) => (
                  <div key={item.title} className="flex gap-4 rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>{item.title}</h3>
                      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border shadow-2xl" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>
                    <Scissors className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('videoWorkflowMockTitle')}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('videoWorkflowMockMeta')}</p>
                  </div>
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--foreground)' }}>
                  {t('videoWorkflowMockFormat')}
                </span>
              </div>

              <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-3 border-b p-4 lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border)' }}>
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <p className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('videoWorkflowReference')}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {showcaseVideos.slice(0, 3).map((item) => {
                        const title = t(item.titleKey);

                        return (
                        <div key={item.titleKey} className="relative aspect-square overflow-hidden rounded-md bg-black">
                          <HoverSoundVideo src={item.src} label={t('videoWorkflowMaterialLabel', { title })} className="absolute inset-0 h-full w-full object-cover" />
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  {shots.map(({ title, desc }) => (
                    <div key={title} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{title}</p>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--muted)' }}>{desc}</p>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <Upload className="size-4" style={{ color: 'var(--brand)' }} />
                    <span className="text-xs" style={{ color: 'var(--foreground)' }}>{t('videoWorkflowMaterialsReady')}</span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                    <HoverSoundVideo src={showcaseVideos[4].src} label={t('videoWorkflowPreviewLabel')} className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 text-white">
                      <p className="text-2xl font-bold">{t('videoWorkflowPreviewTitle')}</p>
                      <p className="mt-2 max-w-xs text-sm text-white/75">{t('videoWorkflowPreviewDesc')}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs leading-5" style={{ color: 'var(--muted)' }}>
                      {t('videoWorkflowPrompt')}
                    </p>
                  </div>
                  <button
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
                    style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
                    type="button"
                  >
                    <Sparkles className="size-4" /> {t('videoWorkflowSend')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function TemplateSection() {
  const t = useTranslations('landing');
  const templateCards = templateCardKeys.map((key) => ({
    title: t(`videoTemplate${key}Title`),
    meta: t(`videoTemplate${key}Meta`),
    desc: t(`videoTemplate${key}Desc`),
  }));

  return (
    <section className="py-20 md:py-28">
      <div className={contentClass}>
        <Reveal>
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <Eyebrow>{t('videoTemplatesEyebrow')}</Eyebrow>
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
                {t('videoTemplatesTitle')}
              </h2>
            </div>
            <Link href="/marketplace/video-templates" className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--brand)' }}>
              {t('videoTemplatesViewAll')} <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {templateCards.map((item) => (
              <div key={item.title} className="rounded-lg border p-5 transition-transform hover:-translate-y-1" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                <div className="mb-5 flex size-10 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  <Layers3 className="size-5" />
                </div>
                <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--brand)' }}>{item.meta}</p>
                <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function QuickStartSection() {
  const t = useTranslations('landing');

  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: 'var(--surface-secondary)' }}>
      <div className={contentClass}>
        <Reveal className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow>{t('videoQuickEyebrow')}</Eyebrow>
            <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
              {t('videoQuickTitle')}
            </h2>
            <p className="mt-5 text-base leading-8" style={{ color: 'var(--muted)' }}>
              {t('videoQuickDesc')}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {quickStartSteps.map(({ icon: Icon, label, titleKey, descKey }) => (
                <div key={label} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--brand)' }}>{label}</span>
                    <span className="flex size-8 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}>
                      <Icon className="size-4" />
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t(titleKey)}</h3>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>{t(descKey)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border shadow-2xl" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-[#ff5f57]" />
                  <span className="size-3 rounded-full bg-[#febc2e]" />
                  <span className="size-3 rounded-full bg-[#28c840]" />
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Amux Video Workspace</span>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--foreground)' }}>
                {t('videoQuickNoApi')}
              </span>
            </div>
            <div className="grid gap-0 lg:grid-cols-[0.96fr_1.04fr]">
              <div className="border-b p-4 lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border)' }}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-black">
                  <HoverSoundVideo src={showcaseVideos[3].src} label={t('videoQuickPreviewLabel')} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/12 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 text-white">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/62">{t('videoQuickSelectedTemplate')}</p>
                    <h3 className="mt-2 text-2xl font-bold">{t('videoQuickPreviewTitle')}</h3>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-white/72">{t('videoQuickPreviewDesc')}</p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="space-y-3">
                  {quickStartSteps.map(({ icon: Icon, label, titleKey, metaKey }, index) => (
                    <div key={label} className="relative rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: index === 0 ? 'var(--brand-soft)' : 'var(--surface-secondary)' }}>
                      {index < quickStartSteps.length - 1 ? (
                        <span className="absolute -bottom-3 left-8 h-3 w-px" style={{ backgroundColor: 'var(--border)' }} />
                      ) : null}
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: index === 0 ? 'var(--brand)' : 'var(--surface)', color: index === 0 ? 'var(--brand-foreground)' : 'var(--foreground)' }}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Icon className="size-4" style={{ color: 'var(--brand)' }} />
                            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t(titleKey)}</p>
                          </div>
                          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--muted)' }}>{t(metaKey)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}>
                      <MessageSquareText className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('videoQuickChatInstruction')}</p>
                      <p className="mt-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>
                        {t('videoQuickPrompt')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCTASection() {
  const t = useTranslations('landing');
  const chatEnabled = useChatEnabled(false);

  return (
    <section className="py-20 md:py-28">
      <div className={contentClass}>
        <Reveal>
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="grid lg:grid-cols-2">
              <div className="flex flex-col justify-center px-6 py-12 md:px-12 md:py-16">
                <BadgeCheck className="mb-5 size-9" style={{ color: 'var(--brand)' }} />
                <h2 className="max-w-xl text-4xl font-bold leading-tight tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
                  {t('videoFinalTitle')}
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8" style={{ color: 'var(--muted)' }}>
                  {t('videoFinalDesc')}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/marketplace/video-templates"
                    className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
                    style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                  >
                    {t('videoFinalTemplatesCta')} <Layers3 className="size-4" />
                  </Link>
                  {chatEnabled && (
                    <Link
                      href="/chat"
                      className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      {t('videoFinalStartCta')} <Check className="size-4" />
                    </Link>
                  )}
                </div>
              </div>
              <div className="relative min-h-[300px] bg-black lg:min-h-[520px]">
                <HoverSoundVideo src={showcaseVideos[0].src} label={t('videoFinalPreviewLabel')} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-white">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs backdrop-blur-md">
                    <Play className="size-3" /> 00:08 / 00:15
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950">Amux Studio</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function VideoLanding() {
  return (
    <div className="w-full overflow-x-hidden">
      <VideoHero />
      <div className="relative z-[1]" style={{ backgroundColor: 'var(--background)' }}>
        <OverviewSection />
        <ShowcaseRail />
        <StudioWorkflowSection />
        <TemplateSection />
        <QuickStartSection />
        <FinalCTASection />
      </div>
    </div>
  );
}
