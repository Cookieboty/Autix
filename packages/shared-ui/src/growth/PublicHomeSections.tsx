import {
  ArrowRight,
  Images,
  Layers3,
  Sparkles,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { MediaThumb } from './MediaBlocks';
import type {
  PublicGrowthFeature,
  PublicGrowthMediaItem,
} from './types';

const HOME_VIDEO_DEMOS = [
  'https://cdn.amux.ai/playground/video/video/demo/03.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/short-film-mini.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/high-impact-mini.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/action-v2-mini.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/compaign-mini.mp4',
] as const;

function demoVideoItem(item: PublicGrowthMediaItem, index: number): PublicGrowthMediaItem {
  return {
    ...item,
    id: `${item.id}-video-demo-${index}`,
    mediaType: 'video',
    mediaUrl: HOME_VIDEO_DEMOS[index % HOME_VIDEO_DEMOS.length]!,
    posterUrl: item.posterUrl ?? item.mediaUrl,
    badge: item.badge || 'Video',
  };
}

function videoEntryItem(features: PublicGrowthFeature[], fallback: PublicGrowthMediaItem): PublicGrowthMediaItem {
  const videoFeature = features.find((feature) => {
    const marker = `${feature.key} ${feature.href} ${feature.title}`.toLowerCase();
    return marker.includes('video') || marker.includes('/ai/video') || marker.includes('视频');
  }) ?? features[0];
  return {
    ...fallback,
    id: `${fallback.id}-creation-video-entry`,
    title: videoFeature?.title ?? 'AI Video',
    subtitle: videoFeature?.description ?? fallback.subtitle,
    description: videoFeature?.description ?? fallback.description,
    mediaType: 'video',
    mediaUrl: fallback.mediaType === 'video' ? fallback.mediaUrl : HOME_VIDEO_DEMOS[1]!,
    posterUrl: fallback.posterUrl ?? fallback.mediaUrl,
    href: videoFeature?.href ?? '/ai/video',
    badge: videoFeature?.badge ?? 'Video',
    tags: [videoFeature?.badge ?? 'Video'],
  };
}

function videoPreviewItems(items: PublicGrowthMediaItem[]) {
  return items.slice(1, 5).map((item, index) =>
    item.mediaType === 'video' ? item : demoVideoItem(item, index + 2),
  );
}

function LoopingTagRow({
  tags,
  reverse = false,
}: {
  tags: Array<{ label: string; href: string }>;
  reverse?: boolean;
}) {
  if (!tags.length) return null;
  const loopTags = [...tags, ...tags, ...tags];

  return (
    <div className="growth-mask-fade overflow-hidden py-1">
      <div
        className={`growth-preset-ribbon flex w-max items-center gap-3 ${
          reverse ? 'growth-preset-ribbon-reverse' : ''
        }`}
      >
        {loopTags.map((tag, index) => (
          <a
            key={`${tag.href}-${index}`}
            href={tag.href}
            className="growth-rb-card inline-flex min-h-12 max-w-[260px] items-center gap-3 whitespace-nowrap rounded-md border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-white/76 shadow-[0_18px_70px_rgb(0_0_0/0.18)] backdrop-blur transition hover:border-white/28 hover:bg-white/[0.095] hover:text-white"
            aria-hidden={index >= tags.length ? true : undefined}
            tabIndex={index >= tags.length ? -1 : undefined}
          >
            <Sparkles className="size-4 shrink-0 text-[#9ee7ff]" />
            <span className="truncate">{tag.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function releaseDetail(item: PublicGrowthMediaItem) {
  return item.subtitle || item.description || item.tags.slice(0, 2).join(' / ');
}

function ReleaseBadge({ item }: { item: PublicGrowthMediaItem }) {
  const Icon = item.mediaType === 'video' ? Video : Images;
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-white/12 bg-black/50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/72 backdrop-blur">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{item.badge || item.mediaType}</span>
    </span>
  );
}

function isVideoTemplateItem(item: PublicGrowthMediaItem) {
  const marker = `${item.mediaType} ${item.href} ${item.badge ?? ''}`.toLowerCase();
  return marker.includes('video');
}

function isTemplateItem(item: PublicGrowthMediaItem) {
  return item.href.includes('/marketplace/') || `${item.badge ?? ''}`.toLowerCase().includes('template');
}

function uniqueMediaItems(items: PublicGrowthMediaItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function videoFirstItems(items: PublicGrowthMediaItem[]) {
  const videos = items.filter((item) => item.mediaType === 'video');
  if (videos.length >= Math.min(2, items.length)) {
    const images = items.filter((item) => item.mediaType !== 'video');
    return [...videos, ...images];
  }
  return items.map((item, index) =>
    item.mediaType === 'video' ? item : demoVideoItem(item, index),
  );
}

function videoBackdropItem(items: PublicGrowthMediaItem[], index: number) {
  const videoItem = items.find((item) => item.mediaType === 'video');
  if (videoItem) return videoItem;
  const fallback = items[index % Math.max(items.length, 1)];
  return fallback ? demoVideoItem(fallback, index) : null;
}

function HomeSectionIntro({
  eyebrow,
  title,
  subtitle,
  actions,
  center = false,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  center?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={
        center
          ? `mx-auto max-w-4xl text-center ${compact ? 'mb-6' : 'mb-9'}`
          : `${compact ? 'mb-5' : 'mb-8'} grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:items-end`
      }
    >
      <div className={center ? 'mx-auto max-w-4xl' : ''}>
        <div className="growth-shiny-label mb-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/72">
          <Sparkles className="size-3.5 text-[#9ee7ff]" />
          {eyebrow}
        </div>
        <h2
          className={`growth-kinetic-title max-w-4xl font-semibold leading-[1.05] tracking-normal text-white ${
            compact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl'
          }`}
        >
          {title}
        </h2>
      </div>
      <div className={center ? 'mx-auto mt-4 flex max-w-2xl flex-col items-center gap-5' : 'lg:justify-self-end'}>
        {subtitle ? (
          <p className={`max-w-2xl text-sm text-white/56 ${compact ? 'leading-6' : 'leading-7 md:text-base'}`}>
            {subtitle}
          </p>
        ) : null}
        {actions ? (
          <div className={center ? 'flex flex-wrap justify-center gap-2' : 'mt-5 flex flex-wrap gap-2 lg:justify-end'}>
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReleaseCard({
  item,
  priority = false,
  hero = false,
}: {
  item: PublicGrowthMediaItem;
  priority?: boolean;
  hero?: boolean;
}) {
  const detail = releaseDetail(item);
  const visibleTags = item.tags.slice(0, hero ? 3 : 2);

  return (
    <a
      href={item.href}
      className={`group relative block overflow-hidden rounded-md border border-white/10 bg-white/[0.045] shadow-[0_24px_90px_rgb(0_0_0/0.34)] transition duration-500 hover:-translate-y-1 hover:border-white/24 ${
        hero ? 'min-h-[440px] md:min-h-[520px]' : 'min-h-[238px]'
      }`}
      aria-label={item.title}
    >
      <MediaThumb
        item={item}
        eager={priority}
        autoPlay={priority}
        className="absolute inset-0 transition duration-[900ms] group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.16)_42%,rgba(0,0,0,0.9)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/30 opacity-0 transition duration-500 group-hover:opacity-100" />
      <div className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)]">
        <ReleaseBadge item={item} />
      </div>
      <div className={hero ? 'absolute inset-x-0 bottom-0 p-5 md:p-7' : 'absolute inset-x-0 bottom-0 p-4'}>
        {visibleTags.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <span key={tag} className="rounded-md bg-white/12 px-2 py-1 text-[11px] text-white/70">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h3
              className={
                hero
                  ? 'line-clamp-2 text-2xl font-semibold leading-[1.05] text-white md:text-4xl'
                  : 'line-clamp-2 text-lg font-semibold leading-tight text-white'
              }
            >
              {item.title}
            </h3>
            {detail ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/58">
                {detail}
              </p>
            ) : null}
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-black transition group-hover:bg-[#c9ff82]">
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </a>
  );
}

function TemplateFlowCard({
  item,
  index,
  imageLabel,
  videoLabel,
  tabIndex,
  ariaHidden = false,
}: {
  item: PublicGrowthMediaItem;
  index: number;
  imageLabel: string;
  videoLabel: string;
  tabIndex?: number;
  ariaHidden?: boolean;
}) {
  const isVideo = isVideoTemplateItem(item);
  const Icon = isVideo ? Video : Images;
  const detail = releaseDetail(item);

  return (
    <a
      href={item.href}
      tabIndex={tabIndex}
      aria-hidden={ariaHidden || undefined}
      className="group relative block aspect-[3/4] w-[58vw] min-w-[58vw] overflow-hidden rounded-md border border-white/10 bg-white/[0.045] shadow-[0_18px_70px_rgb(0_0_0/0.28)] transition duration-500 hover:-translate-y-1 hover:border-white/24 sm:w-64 sm:min-w-64 lg:w-72 lg:min-w-72"
      aria-label={item.title}
    >
      <MediaThumb
        item={item}
        eager={index < 2}
        autoPlay={isVideo && index < 2}
        className="transition duration-[900ms] group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.18)_45%,rgba(0,0,0,0.9)_100%)]" />
      <div className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)]">
        <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-white/12 bg-black/52 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/78 backdrop-blur">
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{isVideo ? videoLabel : imageLabel}</span>
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white">
          {item.title}
        </h3>
        {detail ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/58">
            {detail}
          </p>
        ) : null}
      </div>
    </a>
  );
}

function TemplateFlowRow({
  items,
  reverse = false,
  imageLabel,
  videoLabel,
}: {
  items: PublicGrowthMediaItem[];
  reverse?: boolean;
  imageLabel: string;
  videoLabel: string;
}) {
  if (!items.length) return null;
  const loopItems = [...items, ...items];

  return (
    <div className="growth-mask-fade overflow-hidden py-1">
      <div
        className={`growth-template-flow flex w-max items-center gap-3 px-4 md:px-6 ${
          reverse ? 'growth-template-flow-reverse' : ''
        }`}
      >
        {loopItems.map((item, index) => (
          <TemplateFlowCard
            key={`${item.id}-${index}`}
            item={item}
            index={index}
            imageLabel={imageLabel}
            videoLabel={videoLabel}
            ariaHidden={index >= items.length}
            tabIndex={index >= items.length ? -1 : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function HomeTemplateFlow({
  eyebrow,
  title,
  subtitle,
  imageLabel,
  videoLabel,
  actionLabel,
  items,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  imageLabel: string;
  videoLabel: string;
  actionLabel: string;
  items: PublicGrowthMediaItem[];
}) {
  const templateItems = items.filter(isTemplateItem);
  const displayItems = uniqueMediaItems([
    ...(templateItems.length >= 4 ? templateItems : [...templateItems, ...items]),
  ]).slice(0, 12);
  if (!displayItems.length) return null;

  const firstRow = displayItems.filter((_, index) => index % 2 === 0);
  const secondRow = displayItems.filter((_, index) => index % 2 === 1);
  const rows = secondRow.length ? [firstRow, secondRow] : [displayItems];
  const backgroundVideo = videoBackdropItem(displayItems, 2);

  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-[#050606] py-12 md:py-20">
      {backgroundVideo ? (
        <MediaThumb
          item={backgroundVideo}
          eager={false}
          autoPlay
          className="absolute inset-0 opacity-[0.12] blur-sm"
        />
      ) : null}
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-80" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:88px_88px]" />
      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <HomeSectionIntro
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <a
                href="/marketplace/image-templates"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/12 bg-white/[0.045] px-3 py-2 text-sm font-semibold text-white/76 transition hover:bg-white/12 hover:text-white"
              >
                <Images className="size-4" />
                {imageLabel}
              </a>
              <a
                href="/marketplace/video-templates"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#9ee7ff]/24 bg-[#9ee7ff]/10 px-3 py-2 text-sm font-semibold text-[#d7f2ff] transition hover:bg-white hover:text-black"
              >
                <Video className="size-4" />
                {videoLabel}
              </a>
              <a
                href="/marketplace"
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-black text-black transition hover:bg-[#9ee7ff]"
              >
                <Layers3 className="size-4" />
                {actionLabel}
              </a>
            </>
          }
        />
      </div>

      <div className="grid gap-3">
        {rows.map((rowItems, index) => (
          <TemplateFlowRow
            key={index}
            items={rowItems}
            reverse={index % 2 === 1}
            imageLabel={imageLabel}
            videoLabel={videoLabel}
          />
        ))}
      </div>
    </section>
  );
}

export function HomeReleaseGallery({
  eyebrow,
  title,
  subtitle,
  items,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: PublicGrowthMediaItem[];
}) {
  const releaseItems = items.slice(0, 7);
  const [lead, second, third, ...stripItems] = releaseItems;
  if (!lead) return null;

  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-[#030404] py-12 md:py-20">
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:120px_120px]" />
      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <HomeSectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />

        <div className="grid gap-3 lg:grid-cols-[1.16fr_0.84fr]">
          <ReleaseCard item={lead} priority hero />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {second ? <ReleaseCard item={second} priority /> : null}
            {third ? <ReleaseCard item={third} /> : null}
          </div>
        </div>

        {stripItems.length ? (
          <div className="growth-release-strip mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {stripItems.map((item, index) => (
              <a
                key={item.id}
                href={item.href}
                className="group relative aspect-[4/3] overflow-hidden rounded-md border border-white/10 bg-white/[0.045] transition duration-500 hover:-translate-y-1 hover:border-white/24 md:aspect-[16/10]"
                aria-label={item.title}
              >
                <MediaThumb
                  item={item}
                  eager={index === 0}
                  autoPlay={false}
                  className="transition duration-[900ms] group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,rgba(0,0,0,0.86)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="mb-2 h-1 w-7 rounded-full bg-[#c9ff82]" />
                  <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                    {item.title}
                  </h3>
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ProductExploreSection({
  eyebrow,
  title,
  subtitle,
  features,
  items,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  features: PublicGrowthFeature[];
  items: PublicGrowthMediaItem[];
}) {
  if (!features.length) return null;
  const mediaStack = videoFirstItems(items);
  const firstMedia = mediaStack[0] ?? items[0];
  if (!firstMedia) return null;
  const backgroundItem = videoEntryItem(features, firstMedia);
  const previewItems = videoPreviewItems(mediaStack);

  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-[#050505] py-6 md:py-7">
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:96px_96px]" />
      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <HomeSectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} compact />

        <div className="grid gap-3 lg:grid-cols-[0.82fr_1.18fr] lg:items-stretch">
          <a
            href={backgroundItem.href}
            className="growth-rb-card group relative block h-[360px] overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_22px_90px_rgb(0_0_0/0.34)] transition duration-500 hover:-translate-y-1 hover:border-white/24 md:h-[405px] lg:h-[450px]"
            aria-label={backgroundItem.title}
          >
            <MediaThumb
              item={backgroundItem}
              eager
              autoPlay={backgroundItem.mediaType === 'video'}
              className="absolute inset-0 transition duration-[900ms] group-hover:scale-[1.035]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86)_0%,rgba(0,0,0,0.42)_52%,rgba(0,0,0,0.18)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-4 md:p-5">
              <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-white/12 bg-black/46 px-2 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white/74 backdrop-blur">
                <Video className="size-3.5 text-[#9ee7ff]" />
                {backgroundItem.badge || backgroundItem.mediaType}
              </div>
              <h3 className="max-w-xl text-xl font-semibold leading-tight text-white md:text-2xl">
                {backgroundItem.title}
              </h3>
              <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-6 text-white/58">
                {releaseDetail(backgroundItem)}
              </p>
            </div>
          </a>

          <div className="grid gap-3 sm:grid-cols-2 lg:h-[450px] lg:grid-rows-2">
            {previewItems.map((item, index) => {
              const detail = releaseDetail(item);
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className="growth-rb-card growth-flow-border group relative block h-[210px] min-h-0 overflow-hidden rounded-xl border border-white/10 bg-black transition duration-300 hover:-translate-y-1 hover:border-white/24 md:h-[216px] lg:h-full"
                  aria-label={item.title}
                >
                  <MediaThumb
                    item={item}
                    eager={index === 0}
                    autoPlay={index < 2}
                    className="absolute inset-0 opacity-60 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.82))]" />
                  <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-lg border border-white/12 bg-black/46 px-2 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white/72 backdrop-blur">
                    <Video className="size-3.5 text-[#9ee7ff]" />
                    Video
                  </div>
                  <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                    <div className="max-w-[92%] translate-y-5 transition duration-500 group-hover:translate-y-0">
                      <h3 className="line-clamp-1 text-lg font-semibold leading-tight text-white">
                        {item.title}
                      </h3>
                      {detail ? (
                        <p className="mt-2 line-clamp-1 text-sm leading-6 text-white/0 transition duration-500 group-hover:text-white/58">
                          {detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PresetRunway({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  tags,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  tags: Array<{ label: string; href: string }>;
}) {
  return (
    <section className="relative overflow-hidden bg-[#060606] py-12 md:py-20">
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-60" />
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <HomeSectionIntro
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          center
          actions={
            <a
              href="/presets"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/12 bg-white px-4 py-2 text-sm font-black text-black transition hover:bg-[#9ee7ff]"
            >
              <Layers3 className="size-4" />
              {actionLabel}
            </a>
          }
        />
      </div>
      <div className="relative mt-8 grid gap-3">
        <LoopingTagRow tags={tags} />
        <LoopingTagRow tags={[...tags].reverse()} reverse />
      </div>
    </section>
  );
}

export function FinalHomeCta({
  title,
  description,
  imageLabel,
  videoLabel,
  presetsLabel,
  mediaItem,
}: {
  title: string;
  description: string;
  imageLabel: string;
  videoLabel: string;
  presetsLabel: string;
  mediaItem?: PublicGrowthMediaItem;
}) {
  const backgroundItem = mediaItem
    ? mediaItem.mediaType === 'video'
      ? mediaItem
      : demoVideoItem(mediaItem, 4)
    : null;
  const links = [
    { label: imageLabel, href: '/ai/image', icon: Images },
    { label: videoLabel, href: '/ai/video', icon: Video },
    { label: presetsLabel, href: '/presets', icon: Layers3 },
  ];

  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-[#020202]">
      {backgroundItem ? (
        <MediaThumb
          item={backgroundItem}
          eager={false}
          autoPlay
          className="absolute inset-0 opacity-[0.16] blur-[2px]"
        />
      ) : null}
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-70" />
      <div className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(115deg,rgba(255,255,255,0.12)_0,transparent_24%,transparent_76%,rgba(255,255,255,0.1)_100%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <div className="growth-shiny-label mb-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/62">
              <Sparkles className="size-3.5 text-[#9ee7ff]" />
              Amux Studio
            </div>
            <h2 className="growth-kinetic-title max-w-3xl text-4xl font-semibold leading-[1.02] tracking-normal text-white md:text-6xl">
              {title}
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/56 md:text-base">
              {description}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="growth-rb-card group flex min-h-24 items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.05] px-5 py-4 text-lg font-semibold text-white transition duration-300 hover:-translate-y-1 hover:border-white/28 hover:bg-white hover:text-black"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className="size-5 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 transition group-hover:translate-x-1" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
