'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Box,
  Clock3,
  Command,
  Copy,
  Crop,
  Diamond,
  Folder,
  Gem,
  Globe2,
  History,
  Image as ImageIcon,
  Layers3,
  Lock,
  Music,
  Pencil,
  Plus,
  SlidersHorizontal,
  Search,
  Sparkles,
  Upload,
  Video,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ImageModelCapability } from '@autix/domain/image';
import Link from 'next/link';
import { ThemeLogo } from '../brand';
import { ComingSoonControl } from './ComingSoonControl';
import { getFallbackItems } from './fallback';
import { MagneticLink, SpotlightPanel } from './GrowthInteractions';
import { resolveImageCapabilityFromModelParam, getImageCountControl } from './generator-image-presenters';
import { buildGeneratorNavItems } from './generator-nav-items';
import { buildGeneratorWorkbenchHref } from './generator-workbench-href';
import {
  DEFAULT_PUBLIC_VIDEO_MODEL,
  resolveVideoCapabilityFromModelParam,
} from './generator-video-presenters';
import {
  DEFAULT_VIDEO_PARAMS,
  RATIO_VALUES,
  VIDEO_DURATION_PRESETS,
} from '../video/workbench/constants';
import { MediaThumb } from './MediaBlocks';
import { PublicPromoBar } from './PublicPromoBar';
import type { PublicGrowthMediaItem } from './types';

type GeneratorKind = 'image' | 'video';

function parseImageSizeLabel(value: string, capability: ImageModelCapability) {
  const size = capability.sizes.find((option) => option.value === value);
  if (!size) return { aspect: '3:4', resolution: '1K' };
  const [aspect, resolution] = size.label.split(' ');
  return {
    aspect: aspect || '3:4',
    resolution: resolution || '1K',
  };
}

function repeatedItems(items: PublicGrowthMediaItem[], count: number) {
  if (!items.length) return [];
  return Array.from({ length: count }, (_, index) => items[index % items.length]!);
}

function GeneratorAppNav({ kind }: { kind: GeneratorKind }) {
  const t = useTranslations('publicGrowth.generator.studio');
  const navItems = buildGeneratorNavItems(kind).map((item) => ({
    label: t(`nav.${item.key}`),
    href: item.href,
    active: item.active,
    badge: item.badge ? t('nav.new') : undefined,
  }));

  return (
    <header className="relative z-30 border-b border-white/7 bg-[#080a09]/96 px-3 shadow-[0_16px_60px_rgb(0_0_0/0.35)] backdrop-blur-xl md:px-5">
      <div className="flex min-h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/" className="grid size-9 shrink-0 place-items-center rounded-md bg-white">
            <ThemeLogo alt="Amux Studio" size={28} variant="dark" />
          </a>
          <a href="/community" className="hidden text-sm font-semibold text-white/62 hover:text-white md:inline-flex">
            {t('nav.explore')}
          </a>
          <div className="hidden h-4 w-px bg-white/12 md:block" />
          <nav className="hide-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <a
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-semibold transition ${
                  item.active
                    ? 'bg-white/10 text-white'
                    : item.label === t('nav.supercomputer')
                      ? 'text-[#c9ff00]'
                      : 'text-white/55 hover:bg-white/8 hover:text-white'
                }`}
              >
                {item.label === t('nav.supercomputer') ? <Box className="size-3.5" /> : null}
                {item.label}
                {item.badge ? (
                  <span className="rounded bg-[#c9ff00]/18 px-1.5 py-0.5 text-[10px] font-bold text-[#c9ff00]">
                    {item.badge}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <div className="flex h-10 items-center gap-2 rounded-md border border-white/8 bg-white/[0.06] px-3 text-sm text-white/42">
            <Search className="size-4" />
            <span className="w-24">{t('nav.search')}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white/45">
              <Command className="inline size-3" /> K
            </span>
          </div>
          <a
            href="/pricing"
            className="relative inline-flex min-h-10 items-center gap-2 rounded-md border border-white/8 bg-white/[0.08] px-3 text-sm font-semibold text-white hover:bg-white/12"
          >
            <Gem className="size-4" />
            {t('nav.pricing')}
            <span className="absolute -bottom-4 left-3 rounded-md bg-[#ff1675] px-1.5 py-0.5 text-[10px] font-bold text-white">
              30% OFF
            </span>
          </a>
          <a
            href="/materials"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/8 bg-white/[0.08] px-3 text-sm font-semibold text-white hover:bg-white/12"
          >
            <Folder className="size-4 fill-[#8ad97c] text-[#8ad97c]" />
            {t('nav.assets')}
          </a>
          <a
            href="/login"
            className="grid size-10 place-items-center rounded-full border-2 border-[#c9ff00] bg-white/10 shadow-[0_0_24px_rgb(201_255_0/0.45)]"
            aria-label={t('nav.profile')}
          >
            <span className="size-6 rounded-full bg-[#d6ff2b]" />
          </a>
        </div>
      </div>
    </header>
  );
}

function ModeTabs({
  active,
  onChange,
}: {
  active: 'history' | 'community';
  onChange: (next: 'history' | 'community') => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tabs = [
    { id: 'history' as const, label: t('history'), icon: History },
    { id: 'community' as const, label: t('community'), icon: Globe2 },
  ];

  return (
    <div className="inline-flex rounded-md border border-white/5 bg-white/[0.035] p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold transition ${
              active === tab.id ? 'bg-white/8 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white/76'
            }`}
          >
            <Icon className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function OfferStrip({
  label,
  premium,
  className = '',
}: {
  label: string;
  premium: string;
  className?: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div
      className={`flex min-h-12 items-center gap-3 rounded-md border border-[#ff3b8d]/25 bg-[linear-gradient(90deg,#be0a52,#7d113f_58%,#32101d)] px-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgb(0_0_0/0.32)] ${className}`}
    >
      <span className="rounded-md bg-[#c9ff00] px-2 py-1 text-[11px] font-black uppercase text-black">
        {t('goUnlimited')}
      </span>
      <span className="rounded-md bg-[#ff1675] px-2 py-1 text-[11px] font-black text-white">
        30% OFF
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="hidden text-white/40 md:inline">{premium}</span>
      <a
        href="/pricing"
        className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md bg-white px-3 text-xs font-bold text-black hover:bg-[#c9ff00]"
      >
        {t('getUnlimited')}
        <ArrowUpRight className="size-3.5" />
      </a>
      <button
        type="button"
        className="grid size-8 shrink-0 place-items-center rounded-md text-white/45 hover:bg-white/10 hover:text-white"
        aria-label={t('close')}
        onClick={() => setOpen(false)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function StudioDensitySlider({ label }: { label: string }) {
  return (
    <div className="hidden items-center gap-3 rounded-full bg-black/28 px-3 py-2 shadow-[0_12px_36px_rgb(0_0_0/0.22)] backdrop-blur-md xl:flex">
      <span className="h-1 w-24 rounded-full bg-white/6">
        <span className="block h-1 w-2/3 rounded-full bg-white/14" />
      </span>
      <span className="size-3 rounded-full bg-white shadow-[0_0_16px_rgb(255_255_255/0.55)]" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function ImageHeroCollage({ items }: { items: PublicGrowthMediaItem[] }) {
  const collage = repeatedItems(items, 4);
  return (
    <div className="relative mx-auto mb-5 h-48 w-full max-w-[650px] md:h-52">
      <div className="absolute inset-x-[14%] top-12 h-28 rounded-full bg-[#78a7ff]/10 blur-3xl" />
      {collage.map((item, index) => (
        <a
          key={`${item.id}-${index}`}
          href={item.href}
          className={`growth-generator-card absolute top-6 block overflow-hidden rounded-md border-[5px] border-white/20 bg-black shadow-[0_28px_90px_rgb(40_120_255/0.16)] transition duration-500 hover:z-10 hover:scale-105 ${
            index === 0
              ? 'left-[2%] h-[7.5rem] w-[29%] -rotate-8'
              : index === 1
                ? 'left-[27%] h-36 w-[27%] rotate-3'
                : index === 2
                  ? 'left-[51%] h-36 w-[22%] rounded-full'
                  : 'right-[2%] h-[7.5rem] w-[29%] -rotate-3'
          }`}
          style={{ animationDelay: `${index * 160}ms` }}
          aria-label={item.title}
        >
          <MediaThumb item={item} eager={index < 2} autoPlay={index === 0} />
        </a>
      ))}
    </div>
  );
}

function ImageCommunityWall({ items }: { items: PublicGrowthMediaItem[] }) {
  const wallItems = repeatedItems(items, 18);
  return (
    <div className="pointer-events-auto absolute inset-x-0 top-0 columns-2 gap-2 opacity-95 md:columns-4 xl:columns-5">
      {wallItems.map((item, index) => (
        <a
          key={`${item.id}-wall-${index}`}
          href={item.href}
          className="growth-generator-masonry mb-2 block break-inside-avoid overflow-hidden bg-white/[0.04] transition duration-300 hover:scale-[1.01] hover:brightness-110"
          style={{ animationDelay: `${(index % 9) * 80}ms` }}
        >
          <div className={index % 5 === 0 ? 'aspect-[4/5]' : index % 4 === 0 ? 'aspect-[16/9]' : 'aspect-[3/4]'}>
            <MediaThumb item={item} eager={index < 8} autoPlay={index < 2} />
          </div>
        </a>
      ))}
    </div>
  );
}

function ImageComposer({
  communityMode,
  imageCapability,
  initialModel,
}: {
  communityMode: boolean;
  imageCapability: ImageModelCapability;
  initialModel?: string | null;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState(imageCapability.defaults.size);
  const [count, setCount] = useState(1);
  const sizeLabel = parseImageSizeLabel(size, imageCapability);
  const modelLabel = imageCapability.displayName;
  const countControl = getImageCountControl(imageCapability);
  const composerHref = buildGeneratorWorkbenchHref({
    kind: 'image',
    model: initialModel ?? undefined,
    prompt,
    size,
    quality: imageCapability.defaults.quality || undefined,
    count,
  });

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 pb-5">
      <OfferStrip
        label={t('imageOffer')}
        premium={t('premiumPlans')}
        className="mx-auto max-w-6xl"
      />
      <SpotlightPanel className="mx-auto rounded-md border border-white/10 bg-[#181b1c]/95 p-4 shadow-[0_22px_80px_rgb(0_0_0/0.45)] backdrop-blur-xl md:p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_174px]">
          <div className="min-w-0">
            <div className="flex min-h-12 items-center gap-3 rounded-md text-sm text-white/48">
              <Link
                href={composerHref}
                className="grid size-9 shrink-0 place-items-center rounded-md border border-[#c9ff00]/35 bg-[#c9ff00]/5 text-[#c9ff00] transition hover:bg-[#c9ff00]/12"
              >
                <Plus className="size-4" />
              </Link>
              <input
                className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/44"
                placeholder={communityMode ? t('templatePromptPlaceholder') : t('promptPlaceholder')}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <ImageParamMenu icon={<Sparkles className="size-4" />} label={modelLabel} />
              <ImageParamMenu icon={<Crop className="size-4" />} label={sizeLabel.aspect} />
              <ImageParamMenu icon={<Diamond className="size-4" />} label={sizeLabel.resolution} />
              {countControl.visible ? (
                <div className="inline-flex min-h-10 items-center rounded-md border border-white/8 bg-black/22 text-sm font-semibold text-white/78">
                  <button
                    type="button"
                    aria-label={t('decreaseCount')}
                    className="grid size-10 place-items-center rounded-l-md text-white/45 hover:bg-white/8 hover:text-white"
                    onClick={() => setCount((current) => Math.max(1, current - 1))}
                  >
                    -
                  </button>
                  <span className="min-w-14 px-2 text-center">{count}/{imageCapability.maxCount}</span>
                  <button
                    type="button"
                    aria-label={t('increaseCount')}
                    className="grid size-10 place-items-center rounded-r-md text-white/45 hover:bg-white/8 hover:text-white"
                    onClick={() => setCount((current) => Math.min(imageCapability.maxCount, current + 1))}
                  >
                    +
                  </button>
                </div>
              ) : null}
              <ComingSoonControl label={t('private')} icon={<Lock className="size-4" />} badgeLabel={t('comingSoon')} />
              <ComingSoonControl label={t('draw')} icon={<Pencil className="size-4" />} badgeLabel={t('comingSoon')} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 overflow-x-auto">
              {imageCapability.sizes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSize(option.value)}
                  className={`min-h-7 rounded-md px-2 text-[11px] font-bold transition ${
                    option.value === size
                      ? 'bg-[#c9ff00] text-black'
                      : 'bg-white/[0.055] text-white/42 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <MagneticLink
            href={composerHref}
            className="growth-generator-generate inline-flex min-h-24 items-center justify-center gap-2 rounded-md bg-[#c9ff00] px-5 text-lg font-black text-black shadow-[0_0_34px_rgb(201_255_0/0.22)] hover:bg-white"
          >
            {t('generate')}
            <Sparkles className="size-5 fill-black" />
          </MagneticLink>
        </div>
      </SpotlightPanel>
    </div>
  );
}

function ImageParamMenu({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/8 bg-black/22 px-3 text-sm font-semibold text-white/78">
      <span className="text-[#c9ff00]">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function ImageGeneratorStudio({
  items,
  imageCapability,
  initialModel,
}: {
  items: PublicGrowthMediaItem[];
  imageCapability: ImageModelCapability;
  initialModel?: string | null;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [mode, setMode] = useState<'history' | 'community'>('history');
  const communityMode = mode === 'community';

  return (
    <main className="relative min-h-[calc(100svh-104px)] overflow-hidden bg-[#080a09]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_34%,rgba(61,100,125,0.16),transparent_32%),linear-gradient(180deg,#101312,#080a09_46%,#111415)]" />
      <div className="growth-generator-noise absolute inset-0 opacity-[0.13]" />
      {communityMode ? <ImageCommunityWall items={items} /> : null}
      {communityMode ? <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,9,0.05),rgba(8,10,9,0.18)_55%,rgba(8,10,9,0.86))]" /> : null}

      <div className="relative z-10 flex items-start justify-between gap-3 px-1 pt-3 md:px-2">
        <ModeTabs active={mode} onChange={setMode} />
        <StudioDensitySlider label={t('density')} />
      </div>

      {!communityMode ? (
        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-374px)] max-w-4xl flex-col items-center justify-center px-4 pb-12 pt-12 text-center">
          <ImageHeroCollage items={items} />
          <h1 className="text-4xl font-black uppercase leading-[0.96] tracking-normal text-white md:text-5xl">
            {t('imageBlankTitle')}
            <span className="block text-[#c9ff00]">{t('imageBlankAccent')}</span>
          </h1>
          <p className="mt-4 max-w-xl text-base font-medium text-white/42">
            {t('imageBlankDescription')}
          </p>
        </section>
      ) : (
        <section className="relative z-10 min-h-[calc(100svh-320px)]" aria-label={t('templateMode')} />
      )}

      <div className="relative z-20">
        <ImageComposer communityMode={communityMode} imageCapability={imageCapability} initialModel={initialModel} />
      </div>
    </main>
  );
}

function VideoSidebar({
  items,
  initialModel,
}: {
  items: PublicGrowthMediaItem[];
  initialModel?: string | null;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const preview = items[0];
  const videoCapability = resolveVideoCapabilityFromModelParam(initialModel);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(DEFAULT_VIDEO_PARAMS.duration);
  const [resolution, setResolution] = useState(videoCapability.defaultResolution);
  const [ratio, setRatio] = useState<string>(DEFAULT_VIDEO_PARAMS.ratio);
  const [generateAudio, setGenerateAudio] = useState(DEFAULT_VIDEO_PARAMS.generateAudio);
  const model = initialModel ?? DEFAULT_PUBLIC_VIDEO_MODEL;
  const sidebarHref = buildGeneratorWorkbenchHref({
    kind: 'video',
    model,
    prompt,
    duration,
    resolution,
    ratio,
    generateAudio,
    mode: 'standard',
  });
  const storyboardHref = buildGeneratorWorkbenchHref({
    kind: 'video',
    model,
    prompt,
    duration,
    resolution,
    ratio,
    generateAudio,
    mode: 'storyboard',
  });

  return (
    <aside className="rounded-md border border-white/9 bg-[#111413] p-4 shadow-[0_18px_70px_rgb(0_0_0/0.32)] lg:sticky lg:top-24 lg:h-[calc(100svh-8rem)]">
      <div className="mb-4 grid grid-cols-3 gap-1 border-b border-white/10 pb-3">
        <button
          type="button"
          className="min-h-9 rounded-md px-2 text-sm font-bold bg-white/8 text-white"
        >
          {t('createVideo')}
        </button>
        <ComingSoonControl label={t('editVideo')} badgeLabel={t('comingSoon')} className="w-full justify-center" />
        <ComingSoonControl label={t('motionControl')} badgeLabel={t('comingSoon')} className="w-full justify-center" />
      </div>

      {preview ? (
        <a href={preview.href} className="group relative block aspect-[16/7] overflow-hidden rounded-md border border-white/8 bg-black">
          <MediaThumb item={preview} eager autoPlay className="opacity-70 transition duration-500 group-hover:scale-[1.04]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.82))]" />
          <div className="absolute inset-x-3 bottom-3">
            <div className="text-xl font-black uppercase text-[#c9ff00]">{t('generalPreset')}</div>
            <div className="text-xs font-semibold text-white/58">{t('seedanceModel')}</div>
          </div>
          <span className="absolute right-2 top-2 rounded-md bg-black/55 px-2 py-1 text-xs font-bold text-white">
            {t('change')}
          </span>
        </a>
      ) : null}

      <Link
        href={sidebarHref}
        className="mt-3 grid min-h-28 w-full place-items-center rounded-md border border-dashed border-white/12 bg-white/[0.035] p-4 text-center text-sm text-white/48 hover:border-[#c9ff00]/45 hover:text-white"
      >
        <span className="mb-2 inline-flex -space-x-2">
          {[
            { key: 'image', Icon: ImageIcon },
            { key: 'video', Icon: Video },
            { key: 'music', Icon: Music },
          ].map(({ key, Icon }) => (
            <span key={key} className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/10">
              <Icon className="size-4" />
            </span>
          ))}
        </span>
        <span className="font-semibold">{t('uploadMedia')}</span>
        <span className="mt-1 block text-xs">{t('uploadMediaHint')}</span>
      </Link>

      <label className="mt-3 block rounded-md border border-white/8 bg-white/[0.045] p-3">
        <span className="text-sm font-bold text-white/46">{t('prompt')}</span>
        <textarea
          className="mt-2 min-h-20 w-full resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-white/38"
          placeholder={t('videoPromptPlaceholder')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Link
          href={sidebarHref}
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-black/38 px-2 py-1 text-xs font-bold text-white/72 hover:bg-black/55"
        >
          @ {t('elements')}
        </Link>
        <button
          type="button"
          onClick={() => setGenerateAudio((prev) => !prev)}
          className={`ml-2 inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-bold transition ${
            generateAudio ? 'bg-[#c9ff00]/15 text-[#c9ff00]' : 'bg-black/38 text-white/38 line-through'
          }`}
        >
          <Volume2 className="size-3.5" />
          {t('audioOn')}
        </button>
      </label>

      <div className="mt-3 grid gap-2">
        <ParamRow label={t('model')} value={videoCapability.displayName} highlight icon={<SlidersHorizontal className="size-4" />} />
        <div className="grid grid-cols-3 gap-2">
          <ParamPill
            icon={<Clock3 className="size-4" />}
            label={`${duration}s`}
            onClick={() => {
              const idx = VIDEO_DURATION_PRESETS.indexOf(duration as (typeof VIDEO_DURATION_PRESETS)[number]);
              setDuration(VIDEO_DURATION_PRESETS[(idx + 1) % VIDEO_DURATION_PRESETS.length] ?? duration);
            }}
          />
          <ComingSoonControl label={t('auto')} badgeLabel={t('comingSoon')} className="w-full justify-center" />
          <ParamPill
            label={resolution}
            onClick={() => {
              const resolutions = videoCapability.resolutions;
              const idx = resolutions.indexOf(resolution);
              setResolution(resolutions[(idx + 1) % resolutions.length] ?? resolution);
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ParamPill
            icon={<Copy className="size-4" />}
            label={ratio}
            onClick={() => {
              const values = RATIO_VALUES as readonly string[];
              const idx = values.indexOf(ratio);
              setRatio(values[(idx + 1) % values.length] ?? ratio);
            }}
          />
          <Link
            href={storyboardHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/8 bg-white/[0.055] px-2 text-sm font-bold text-white/78 hover:bg-white/9"
          >
            <Layers3 className="size-4" />
            {t('storyboard')}
          </Link>
        </div>
        <ComingSoonControl label={t('bitrate')} badgeLabel={t('comingSoon')} icon={<Diamond className="size-4" />} className="w-full" />
      </div>

      <MagneticLink
        href={sidebarHref}
        className="growth-generator-generate mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#c9ff00] px-4 text-base font-black text-black shadow-[0_0_28px_rgb(201_255_0/0.2)] hover:bg-white"
      >
        {t('generate')}
        <Sparkles className="size-4 fill-black" />
      </MagneticLink>
    </aside>
  );
}

function ParamPill({ label, icon, onClick }: { label: string; icon?: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/8 bg-white/[0.055] px-2 text-sm font-bold text-white/78 hover:bg-white/9"
    >
      {icon}
      {label}
    </button>
  );
}

function ParamRow({
  label,
  value,
  highlight = false,
  icon,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-white/8 bg-white/[0.055] px-3 text-left text-sm">
      <span className="inline-flex items-center gap-2 font-semibold text-white/72">
        {icon ? <span className="text-white/42">{icon}</span> : null}
        {label}
      </span>
      <span className={highlight ? 'font-black text-[#c9ff00]' : 'font-semibold text-white/60'}>{value}</span>
    </div>
  );
}

function VideoHowItWorks({
  items,
  workbenchHref,
}: {
  items: PublicGrowthMediaItem[];
  workbenchHref: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const cards = [
    {
      title: t('addImage'),
      body: t('addImageBody'),
      item: items[0],
      label: t('uploadImage'),
      icon: Upload,
    },
    {
      title: t('choosePreset'),
      body: t('choosePresetBody'),
      item: items[1],
      label: t('choosePreset'),
      icon: WandSparkles,
    },
    {
      title: t('getVideo'),
      body: t('getVideoBody'),
      item: items[2],
      label: t('getVideo'),
      icon: Video,
    },
  ];

  return (
    <main className="min-w-0 flex-1 px-4 pb-10 pt-4 lg:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        <div className="inline-flex rounded-md border border-white/5 bg-white/[0.035] p-1">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-bold text-white/45">
            <History className="size-4" />
            {t('history')}
          </button>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white/8 px-4 text-sm font-bold text-white">
            <Box className="size-4" />
            {t('howItWorks')}
          </button>
        </div>
      </div>

      <OfferStrip label={t('videoOffer')} premium={t('premiumPlans')} />

      <SpotlightPanel className="mt-3 rounded-md border border-white/8 bg-[#111313] p-5 shadow-[0_24px_90px_rgb(0_0_0/0.32)] md:p-8">
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-28 opacity-20" />
        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase leading-none md:text-5xl">
            {t('videoHeroTitle')}
          </h1>
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-white/42 md:text-base">
            {t('videoHeroDescription')}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <a key={card.title} href={workbenchHref} className="group block">
                <div className="growth-generator-video-card relative aspect-[16/12] overflow-hidden rounded-md border border-white/8 bg-black">
                  {card.item ? (
                    <MediaThumb item={card.item} eager={index === 0} autoPlay={index === 0} className="opacity-82 transition duration-700 group-hover:scale-[1.04]" />
                  ) : null}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.62))]" />
                  <div className="absolute inset-8 rounded-md border border-dashed border-white/18 bg-black/12" />
                  <div className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md border border-white/20 bg-black/45 text-white backdrop-blur">
                    <Icon className="size-7" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <span className="inline-flex rounded-md bg-[#c9ff00] px-2 py-1 text-[11px] font-black uppercase text-black">
                      {card.label}
                    </span>
                  </div>
                </div>
                <h2 className="mt-4 text-2xl font-black uppercase">{card.title}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-white/45">{card.body}</p>
              </a>
            );
          })}
        </div>
      </SpotlightPanel>
    </main>
  );
}

function VideoGeneratorStudio({
  items,
  workbenchHref,
  initialModel,
}: {
  items: PublicGrowthMediaItem[];
  workbenchHref: string;
  initialModel?: string | null;
}) {
  return (
    <div className="relative min-h-[calc(100svh-104px)] bg-[#080a09]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_8%,rgba(201,255,0,0.06),transparent_24%),linear-gradient(180deg,#080a09,#0c0f0e)]" />
      <div className="growth-generator-noise absolute inset-0 opacity-[0.1]" />
      <div className="relative z-10 mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-4 lg:flex-row lg:px-6">
        <div className="lg:w-[320px] lg:shrink-0">
          <VideoSidebar items={items} initialModel={initialModel} />
        </div>
        <VideoHowItWorks items={items} workbenchHref={workbenchHref} />
      </div>
    </div>
  );
}

export function PublicGeneratorStudioView({
  kind,
  examples,
  initialModel,
}: {
  kind: GeneratorKind;
  examples?: PublicGrowthMediaItem[] | null;
  initialModel?: string | null;
}) {
  const t = useTranslations('publicGrowth');
  const items = useMemo(
    () => (examples?.length ? examples : getFallbackItems(t)).filter((item) => item.mediaUrl),
    [examples, t],
  );
  const imageCapability = useMemo(
    () => resolveImageCapabilityFromModelParam(initialModel),
    [initialModel],
  );
  const workbenchHref = buildGeneratorWorkbenchHref({
    kind: 'video',
    model: initialModel ?? DEFAULT_PUBLIC_VIDEO_MODEL,
  });

  return (
    <div className="min-h-svh bg-[#080a09] text-white">
      <PublicPromoBar label={t('generator.studio.topPromo')} href="/pricing" />
      <GeneratorAppNav kind={kind} />
      {kind === 'video' ? (
        <VideoGeneratorStudio items={items} workbenchHref={workbenchHref} initialModel={initialModel} />
      ) : (
        <ImageGeneratorStudio items={items} imageCapability={imageCapability} initialModel={initialModel} />
      )}
    </div>
  );
}
