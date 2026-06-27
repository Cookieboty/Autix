import { ArrowRight, Images, Sparkles, Video, WandSparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getFallbackHome } from './fallback';
import {
  MediaMasonryGrid,
  MediaRail,
  MediaThumb,
} from './MediaBlocks';
import {
  CollectionStageSection,
  CommunityCinemaSection,
  FinalHomeCta,
  PresetRunway,
  ProductExploreSection,
} from './PublicHomeSections';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { PublicGrowthFeature, PublicGrowthHome, PublicGrowthMediaItem } from './types';

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        {eyebrow ? (
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff82]">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="max-w-3xl text-2xl font-semibold tracking-normal md:text-4xl">{title}</h2>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60 md:text-base">{subtitle}</p>
        ) : null}
      </div>
      {action ? (
        <a
          href={action.href}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white"
        >
          {action.label}
          <ArrowRight className="size-4" />
        </a>
      ) : null}
    </div>
  );
}

type HomeHeroCopy = {
  featuredLabel: string;
  showcaseLabel: string;
  privateSignal: string;
  publishSignal: string;
  remixSignal: string;
};

function HeroSignal({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.05] p-3">
      <div className="mb-2 h-1 w-8 rounded-full" style={{ backgroundColor: accent }} />
      <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white/42">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function HeroMiniTile({
  item,
  className = '',
  priority = false,
}: {
  item: PublicGrowthMediaItem;
  className?: string;
  priority?: boolean;
}) {
  return (
    <a
      href={item.href}
      className={`group relative block overflow-hidden rounded-md border border-white/12 bg-white/[0.06] shadow-[0_20px_80px_rgb(0_0_0/0.34)] ${className}`}
      aria-label={item.title}
    >
      <MediaThumb
        item={item}
        eager={priority}
        autoPlay={priority}
        className="transition duration-700 group-hover:scale-[1.05]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.72))]" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="mb-2 inline-flex max-w-full rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white/72 backdrop-blur">
          <span className="truncate">{item.badge || item.mediaType}</span>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">{item.title}</h3>
      </div>
    </a>
  );
}

function HeroTagTicker({ tags }: { tags: Array<{ label: string; href: string }> }) {
  if (!tags.length) return null;
  const tickerTags = [...tags, ...tags];

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-white/10 bg-black/60 py-2 backdrop-blur-md">
      <div className="growth-tag-ticker flex w-max items-center gap-2 px-2">
        {tickerTags.map((tag, index) => (
          <a
            key={`${tag.href}-${index}`}
            href={tag.href}
            className="inline-flex min-h-8 max-w-48 items-center rounded-md border border-white/10 bg-white/[0.07] px-3 text-xs font-semibold text-white/72 hover:bg-white/14 hover:text-white"
            aria-hidden={index >= tags.length ? true : undefined}
            tabIndex={index >= tags.length ? -1 : undefined}
          >
            <span className="truncate">{tag.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function HeroMediaShowcase({
  items,
  features,
  tags,
  copy,
}: {
  items: PublicGrowthMediaItem[];
  features: PublicGrowthFeature[];
  tags: Array<{ label: string; href: string }>;
  copy: HomeHeroCopy;
}) {
  const [featured, second, third, fourth, fifth] = items;
  if (!featured) return null;

  const featureA = features[0];
  const featureB = features[1];
  const heroFeatureLinks = [featureA, featureB].filter(
    (feature): feature is PublicGrowthFeature => Boolean(feature),
  );

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-md border border-white/10 bg-[#0d0f0f] p-3 shadow-[0_30px_120px_rgb(0_0_0/0.48)] md:min-h-[620px]">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-32 opacity-50" />
      <div className="relative grid h-full min-h-[496px] gap-3 md:min-h-[596px] md:grid-cols-[1.12fr_0.88fr]">
        <a
          href={featured.href}
          className="group relative min-h-[340px] overflow-hidden rounded-md border border-white/14 bg-white/[0.06] md:min-h-full"
          aria-label={featured.title}
        >
          <MediaThumb
            item={featured}
            eager
            autoPlay
            className="transition duration-700 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.0)_10%,rgba(0,0,0,0.22)_48%,rgba(0,0,0,0.88)_100%)]" />
          <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
            <span className="rounded-md bg-[#c9ff82] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black">
              {copy.featuredLabel}
            </span>
            <span className="rounded-md border border-white/12 bg-black/48 px-2 py-1 text-[11px] font-semibold text-white/72 backdrop-blur">
              {featured.badge || featured.mediaType}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {featured.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-md bg-white/12 px-2 py-1 text-[11px] text-white/72">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-2xl font-semibold leading-tight text-white md:text-3xl">
                  {featured.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/62">
                  {featured.subtitle || featured.description || copy.showcaseLabel}
                </p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-black transition group-hover:bg-[#c9ff82]">
                <ArrowRight className="size-5" />
              </span>
            </div>
          </div>
        </a>

        <div className="grid min-h-[340px] grid-cols-2 gap-3 md:grid-rows-[0.9fr_1.1fr_0.72fr]">
          {second ? (
            <HeroMiniTile
              item={second}
              priority
              className="growth-float-a col-span-2 min-h-40 md:min-h-0"
            />
          ) : null}
          {third ? (
            <HeroMiniTile item={third} className="growth-float-b min-h-44 md:min-h-0" />
          ) : null}
          {fourth ? (
            <HeroMiniTile item={fourth} className="min-h-44 md:min-h-0" />
          ) : null}
          <div className="relative col-span-2 overflow-hidden rounded-md border border-white/10 bg-white/[0.05] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0 text-xs font-semibold uppercase tracking-[0.14em] text-white/42">
                <span className="truncate">{copy.showcaseLabel}</span>
              </div>
              <Sparkles className="size-4 shrink-0 text-[#c9ff82]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {heroFeatureLinks.map((feature) => (
                <a
                  key={feature.key}
                  href={feature.href}
                  className="min-w-0 rounded-md bg-black/34 p-3 text-sm font-semibold text-white/82 transition hover:bg-white/10 hover:text-white"
                >
                  <div className="mb-2 h-1 w-7 rounded-full" style={{ backgroundColor: feature.accent }} />
                  <span className="line-clamp-2">{feature.title}</span>
                </a>
              ))}
            </div>
          </div>
          {fifth ? (
            <div className="pointer-events-none absolute right-6 top-1/2 hidden w-36 -translate-y-1/2 rotate-3 md:block">
              <HeroMiniTile item={fifth} className="aspect-[4/5]" />
            </div>
          ) : null}
        </div>
      </div>
      <HeroTagTicker tags={tags} />
    </div>
  );
}

export function PublicHomeView({ home }: { home?: PublicGrowthHome | null }) {
  const t = useTranslations('publicGrowth');
  const data = home ?? getFallbackHome(t);
  const masonry = data.masonryItems.length ? data.masonryItems : data.mediaRail;
  const heroItems = data.mediaRail.length ? data.mediaRail : masonry;
  const heroCopy: HomeHeroCopy = {
    featuredLabel: t('home.featuredLabel'),
    showcaseLabel: t('home.showcaseLabel'),
    privateSignal: t('home.privateSignal'),
    publishSignal: t('home.publishSignal'),
    remixSignal: t('home.remixSignal'),
  };

  return (
    <PublicGrowthShell promo={data.promo}>
      <main>
        <section className="relative overflow-hidden border-b border-white/10 bg-[#050505]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[0.9fr_1.1fr] md:px-6 md:py-14 lg:py-16">
            <div className="flex flex-col justify-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/70">
                <Zap className="size-4 text-[#c9ff82]" />
                {t('home.eyebrow')}
              </div>
              <h1 className="text-5xl font-semibold leading-[0.96] tracking-normal text-white md:text-7xl lg:text-8xl">
                {t('home.title')}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/62 md:text-lg">
                {t('home.description')}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <a
                  href="/ai/image"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#c9ff82]"
                >
                  <Images className="size-4" />
                  {t('home.imageCta')}
                </a>
                <a
                  href="/ai/video"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/12 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <Video className="size-4" />
                  {t('home.videoCta')}
                </a>
                <a
                  href="/presets"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#c9ff82]/30 bg-[#c9ff82]/10 px-4 py-2 text-sm font-semibold text-[#e5ffc1] transition hover:bg-[#c9ff82] hover:text-black"
                >
                  <WandSparkles className="size-4" />
                  {t('home.browsePresets')}
                </a>
              </div>

              <div className="mt-8 grid gap-2 sm:grid-cols-3">
                <HeroSignal label="01" value={heroCopy.privateSignal} accent="#c9ff82" />
                <HeroSignal label="02" value={heroCopy.publishSignal} accent="#7dd3fc" />
                <HeroSignal label="03" value={heroCopy.remixSignal} accent="#fca5a5" />
              </div>
            </div>

            <HeroMediaShowcase
              items={heroItems}
              features={data.featureMatrix}
              tags={data.tagRail}
              copy={heroCopy}
            />
          </div>
        </section>

        <MediaRail items={data.mediaRail} label={t('home.railLabel')} />

        <ProductExploreSection
          eyebrow={t('home.startEyebrow')}
          title={t('home.startTitle')}
          subtitle={t('home.startSubtitle')}
          features={data.featureMatrix}
          items={heroItems}
        />

        <PresetRunway
          eyebrow={t('home.presetsEyebrow')}
          title={t('home.presetsTitle')}
          subtitle={t('home.presetsSubtitle')}
          actionLabel={t('home.browsePresets')}
          tags={data.tagRail}
        />

        <CommunityCinemaSection
          eyebrow={t('home.communityEyebrow')}
          title={t('home.communityTitle')}
          subtitle={t('home.communitySubtitle')}
          actionLabel={t('home.openCommunity')}
          feedLabel={t('community.feedEyebrow')}
          items={masonry}
        />

        <CollectionStageSection
          eyebrow={t('home.collectionsEyebrow')}
          title={t('home.collectionsTitle')}
          subtitle={t('home.collectionsSubtitle')}
          collections={data.collections}
        />

        {data.sections.map((section) => (
          <section key={section.key} className="mx-auto max-w-7xl px-4 py-12 md:px-6">
            <SectionHeader title={section.title} subtitle={section.subtitle ?? undefined} />
            <MediaMasonryGrid items={section.items} variant="showcase" />
          </section>
        ))}

        <FinalHomeCta
          title={t('home.title')}
          description={t('home.description')}
          imageLabel={t('home.imageCta')}
          videoLabel={t('home.videoCta')}
          presetsLabel={t('home.browsePresets')}
        />
      </main>
    </PublicGrowthShell>
  );
}
