import { ArrowRight, Images, Sparkles, Video, WandSparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getFallbackHome } from './fallback';
import {
  MediaMasonryGrid,
  MediaThumb,
} from './MediaBlocks';
import {
  FinalHomeCta,
  HomeReleaseGallery,
  HomeTemplateFlow,
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
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-growth-accent">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="max-w-3xl text-2xl font-semibold tracking-normal md:text-4xl">{title}</h2>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">{subtitle}</p>
        ) : null}
      </div>
      {action ? (
        <a
          href={action.href}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
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
  title: string;
  description: string;
  imageCta: string;
  videoCta: string;
  presetsCta: string;
};

function heroDetail(item: PublicGrowthMediaItem) {
  return item.subtitle || item.description || item.tags.slice(0, 2).join(' / ');
}

function HeroMediaCard({
  item,
  label,
  priority = false,
}: {
  item: PublicGrowthMediaItem;
  label?: string;
  priority?: boolean;
}) {
  const Icon = item.mediaType === 'video' ? Video : Images;
  const detail = heroDetail(item);

  return (
    <a
      href={item.href}
      className="group min-w-[82vw] snap-start outline-none sm:min-w-[420px] lg:min-w-0"
      aria-label={item.title}
    >
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border bg-secondary transition duration-500 group-hover:-translate-y-0.5 group-hover:border-input group-focus-visible:border-growth-accent">
        <MediaThumb
          item={item}
          eager={priority}
          autoPlay={priority}
          className="transition duration-[900ms] group-hover:scale-[1.035]"
        />
        <div className="growth-hero-card-overlay absolute inset-0" />
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
          {label ? (
            <span className="rounded-lg bg-growth-accent px-2 py-1 text-[11px] font-black text-primary-foreground">
              {label}
            </span>
          ) : null}
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-background/48 px-2 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur">
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{item.badge || item.mediaType}</span>
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="max-w-[92%] translate-y-5 transition duration-500 group-hover:translate-y-0">
            <h3 className="line-clamp-1 text-base font-semibold leading-tight text-foreground md:text-lg">
              {item.title}
            </h3>
            {detail ? (
              <p className="mt-2 line-clamp-1 text-sm leading-6 text-foreground/0 transition duration-500 group-hover:text-muted-foreground">
                {detail}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </a>
  );
}

function HeroQuickActions({ copy }: { copy: HomeHeroCopy }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href="/ai/image"
        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-growth-accent"
      >
        <Images className="size-4" />
        {copy.imageCta}
      </a>
      <a
        href="/ai/video"
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Video className="size-4" />
        {copy.videoCta}
      </a>
      <a
        href="/presets"
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-growth-accent/30 bg-growth-accent/10 px-3 py-2 text-sm font-semibold text-growth-accent transition hover:bg-growth-accent hover:text-primary-foreground"
      >
        <WandSparkles className="size-4" />
        {copy.presetsCta}
      </a>
    </div>
  );
}

function HeroActionPanel({
  item,
  tags,
  copy,
}: {
  item: PublicGrowthMediaItem;
  tags: Array<{ label: string; href: string }>;
  copy: HomeHeroCopy;
}) {
  return (
    <div className="growth-hero-panel-shadow group relative min-h-[260px] overflow-hidden rounded-md border border-border bg-card p-4 md:p-5">
      <MediaThumb
        item={item}
        eager={false}
        autoPlay={false}
        className="absolute inset-0 opacity-48 blur-[1px] transition duration-[900ms] group-hover:scale-[1.03] group-hover:opacity-58"
      />
      <div className="growth-action-panel-overlay absolute inset-0" />
      <div className="relative flex h-full min-h-[228px] max-w-xl flex-col justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-growth-accent px-2 py-1 text-[11px] font-black text-primary-foreground">
            <Sparkles className="size-3.5" />
            {copy.showcaseLabel}
          </div>
          <h2 className="max-w-lg text-3xl font-semibold leading-[1.02] text-foreground md:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
            {copy.description}
          </p>
        </div>
        <div className="mt-6">
          <HeroQuickActions copy={copy} />
          {tags.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag.href}
                  className="max-w-44 truncate rounded-md border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HeroFeatureEntry({ feature }: { feature: PublicGrowthFeature }) {
  const Icon =
    feature.key === 'image'
      ? Images
      : feature.key === 'video'
        ? Video
        : feature.key === 'canvas'
          ? WandSparkles
          : Sparkles;

  return (
    <a
      href={feature.href}
      className="growth-rb-card growth-flow-border group relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-secondary p-4 transition duration-300 hover:-translate-y-0.5 hover:border-input hover:bg-accent"
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-80"
        style={{ backgroundColor: feature.accent }}
      />
      <div className="relative z-10 mb-5 flex items-start justify-between gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-background/34 text-foreground">
          <Icon className="size-4" />
        </span>
        <span className="max-w-28 truncate rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          {feature.badge}
        </span>
      </div>
      <div className="relative z-10 mt-auto">
        <h3 className="line-clamp-1 text-base font-semibold text-foreground">{feature.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
      </div>
    </a>
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
  const heroCards = items.slice(0, 3);
  const featureEntries = features.slice(0, 4);
  const panelItem = items[3] ?? items[0];
  if (!heroCards.length || !panelItem) return null;

  return (
    <div className="relative">
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {heroCards.map((item, index) => (
          <HeroMediaCard
            key={item.id}
            item={item}
            label={index === 0 ? copy.featuredLabel : undefined}
            priority={index < 2}
          />
        ))}
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
        <HeroActionPanel item={panelItem} tags={tags} copy={copy} />
        <div className="grid auto-rows-[132px] gap-3 sm:grid-cols-2">
          {featureEntries.map((feature) => (
            <HeroFeatureEntry key={feature.key} feature={feature} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicHomeView({ home }: { home?: PublicGrowthHome | null }) {
  const t = useTranslations('publicGrowth');
  const data = home ?? getFallbackHome(t);
  const masonry = data.masonryItems.length ? data.masonryItems : data.mediaRail;
  const heroItems = data.mediaRail.length ? data.mediaRail : masonry;
  const heroVideoItem = heroItems.find((item) => item.mediaType === 'video') ?? heroItems[0];
  const heroCopy: HomeHeroCopy = {
    featuredLabel: t('home.featuredLabel'),
    showcaseLabel: t('home.showcaseLabel'),
    title: t('home.title'),
    description: t('home.description'),
    imageCta: t('home.imageCta'),
    videoCta: t('home.videoCta'),
    presetsCta: t('home.browsePresets'),
  };

  return (
    <PublicGrowthShell promo={data.promo}>
      <main>
        <section className="relative overflow-hidden border-b border-border bg-background py-5 md:py-7">
          <div className="growth-grid-noise-sm pointer-events-none absolute inset-0 opacity-[0.14]" />
          <div className="relative mx-auto max-w-[1500px] px-4 md:px-6">
            <h1 className="sr-only">{t('home.title')}</h1>
            <HeroMediaShowcase
              items={heroItems}
              features={data.featureMatrix}
              tags={data.tagRail}
              copy={heroCopy}
            />
          </div>
        </section>

        <HomeReleaseGallery
          eyebrow={t('home.releaseEyebrow')}
          title={t('home.releaseTitle')}
          subtitle={t('home.releaseSubtitle')}
          items={data.mediaRail}
        />

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

        {data.sections.map((section) => (
          <section key={section.key} className="mx-auto max-w-7xl px-4 py-12 md:px-6">
            <SectionHeader title={section.title} subtitle={section.subtitle ?? undefined} />
            <MediaMasonryGrid items={section.items} variant="showcase" />
          </section>
        ))}

        <HomeTemplateFlow
          eyebrow={t('home.templateFlowEyebrow')}
          title={t('home.templateFlowTitle')}
          subtitle={t('home.templateFlowSubtitle')}
          imageLabel={t('home.templateFlowImageLabel')}
          videoLabel={t('home.templateFlowVideoLabel')}
          actionLabel={t('home.templateFlowAction')}
          items={data.mediaRail}
        />

        <FinalHomeCta
          title={t('home.title')}
          description={t('home.description')}
          imageLabel={t('home.imageCta')}
          videoLabel={t('home.videoCta')}
          presetsLabel={t('home.browsePresets')}
          mediaItem={heroVideoItem}
        />
      </main>
    </PublicGrowthShell>
  );
}
