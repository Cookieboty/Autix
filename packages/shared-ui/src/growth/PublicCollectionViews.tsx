import { ArrowRight, Layers3, Search, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { getFallbackCollection, getFallbackHome, getFallbackItems } from './fallback';
import { InteractiveCollectionBands, MagneticLink, SpotlightPanel } from './GrowthInteractions';
import {
  MediaMasonryGrid,
  MediaRail,
  MediaThumb,
  PresetTagRail,
} from './MediaBlocks';
import { PublicGrowthShell } from './PublicGrowthShell';
import type {
  PublicCollectionDetail,
  PublicGrowthCollection,
  PublicGrowthMediaItem,
} from './types';

function collectionKindLabel(kind: PublicGrowthCollection['kind'], t: (key: string) => string) {
  if (kind === 'PRESET') return t('community.kind.preset');
  if (kind === 'VIRAL_PRESET') return t('community.kind.viralPreset');
  if (kind === 'FEATURE') return t('community.kind.feature');
  return t('community.kind.community');
}

function DiscoveryHero({
  eyebrow,
  title,
  description,
  items,
  tags,
  ctaHref,
  ctaLabel,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: PublicGrowthMediaItem[];
  tags?: Array<{ label: string; href: string }> | string[];
  ctaHref: string;
  ctaLabel: string;
  icon: ReactNode;
}) {
  const [featured, second, third] = items;
  const tagItems = (tags ?? []).slice(0, 6);

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#050505]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[0.86fr_1.14fr] md:px-6 md:py-16">
        <div className="self-end">
          <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/72">
            {icon}
            {eyebrow}
          </div>
          <h1 className="text-5xl font-semibold leading-[0.96] md:text-7xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/62 md:text-lg">
            {description}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {tagItems.map((tag) => {
              const label = typeof tag === 'string' ? tag : tag.label;
              const href = typeof tag === 'string' ? ctaHref : tag.href;
              return (
                <a
                  key={`${href}-${label}`}
                  href={href}
                  className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/72 hover:bg-white/12 hover:text-white"
                >
                  {label}
                </a>
              );
            })}
          </div>
          <MagneticLink
            href={ctaHref}
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-[#c9ff82]"
          >
            {ctaLabel}
            <ArrowRight className="size-4" />
          </MagneticLink>
        </div>

        {featured ? (
          <SpotlightPanel className="growth-tilt-card relative min-h-[500px] rounded-md border border-white/10 bg-[#0b0d0c] p-3 shadow-[0_30px_110px_rgb(0_0_0/0.42)] transition duration-300">
            <a href={featured.href} className="group relative block h-[360px] overflow-hidden rounded-md border border-white/12">
              <MediaThumb item={featured} eager autoPlay className="transition duration-700 group-hover:scale-[1.04]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.84))]" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h2 className="line-clamp-2 text-2xl font-semibold">{featured.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/62">
                  {featured.subtitle || featured.description}
                </p>
              </div>
            </a>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[second, third].filter((item): item is PublicGrowthMediaItem => Boolean(item)).map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="group relative block aspect-[4/5] overflow-hidden rounded-md border border-white/10"
                >
                  <MediaThumb item={item} className="transition duration-700 group-hover:scale-[1.05]" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.78))]" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold">
                    <span className="line-clamp-2">{item.title}</span>
                  </div>
                </a>
              ))}
            </div>
          </SpotlightPanel>
        ) : null}
      </div>
    </section>
  );
}

export function CommunityIndexView({
  collections,
  items,
}: {
  collections?: PublicGrowthCollection[] | null;
  items?: PublicGrowthMediaItem[] | null;
}) {
  const t = useTranslations('publicGrowth');
  const fallbackHome = getFallbackHome(t);
  const nextCollections = collections?.length ? collections : fallbackHome.collections;
  const nextItems = items?.length ? items : getFallbackItems(t);

  return (
    <PublicGrowthShell promo={{ label: t('community.indexPromo'), href: '/community' }}>
      <main>
        <DiscoveryHero
          eyebrow={t('community.eyebrow')}
          title={t('community.title')}
          description={t('community.description')}
          items={nextItems}
          tags={nextCollections.map((collection) => ({
            label: collection.title,
            href: `/community/${collection.slug}`,
          }))}
          ctaHref="/ai/image"
          ctaLabel={t('community.create')}
          icon={<Search className="size-4 text-[#c9ff82]" />}
        />
        <MediaRail items={nextItems} label={t('community.feedEyebrow')} />

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <InteractiveCollectionBands
            collections={nextCollections}
            ctaLabel={t('community.openCommunity')}
          />
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff82]">
                {t('community.feedEyebrow')}
              </div>
              <h2 className="text-3xl font-semibold md:text-4xl">{t('community.feedTitle')}</h2>
            </div>
            <a href="/ai/image" className="hidden items-center gap-2 text-sm font-semibold text-white/70 hover:text-white md:inline-flex">
              {t('community.create')}
              <ArrowRight className="size-4" />
            </a>
          </div>
          <MediaMasonryGrid items={nextItems} variant="showcase" />
        </section>
      </main>
    </PublicGrowthShell>
  );
}

export function CommunityCollectionView({ detail }: { detail?: PublicCollectionDetail | null }) {
  const t = useTranslations('publicGrowth');
  const data = detail ?? getFallbackCollection(t);
  return (
    <PublicGrowthShell promo={{ label: t('community.collectionPromo', { title: data.collection.title }), href: '/community' }}>
      <main>
        <section className="relative min-h-[58svh] overflow-hidden">
          {data.collection.heroMedia ? (
            <img
              src={data.collection.heroMedia}
              alt={data.collection.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.9),rgba(0,0,0,0.42))]" />
          <div className="relative mx-auto flex min-h-[58svh] max-w-7xl flex-col justify-end px-4 pb-12 pt-20 md:px-6">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex rounded-md bg-[#c9ff82] px-2 py-1 text-xs font-semibold text-black">
                {collectionKindLabel(data.collection.kind, t)}
              </div>
              <h1 className="text-5xl font-semibold leading-[0.96] md:text-7xl">{data.collection.title}</h1>
              <p className="mt-5 text-base leading-7 text-white/68 md:text-lg">{data.collection.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {data.collection.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-white/12 px-3 py-2 text-sm text-white/78">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
        <MediaRail items={data.items.length ? data.items : getFallbackItems(t)} label={data.collection.title} />
        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <MediaMasonryGrid items={data.items.length ? data.items : getFallbackItems(t)} variant="rhythm" />
        </section>
      </main>
    </PublicGrowthShell>
  );
}

export function PresetsIndexView({
  viral = false,
  items,
}: {
  viral?: boolean;
  items?: PublicGrowthMediaItem[] | null;
}) {
  const t = useTranslations('publicGrowth');
  const fallbackHome = getFallbackHome(t);
  const nextItems = items?.length ? items : getFallbackItems(t);
  return (
    <PublicGrowthShell promo={{ label: viral ? t('presets.viralPromo') : t('presets.promo'), href: viral ? '/viral-presets' : '/presets' }}>
      <main>
        <DiscoveryHero
          eyebrow={viral ? t('presets.viralEyebrow') : t('presets.eyebrow')}
          title={viral ? t('presets.viralTitle') : t('presets.title')}
          description={t('presets.description')}
          items={nextItems}
          tags={fallbackHome.tagRail}
          ctaHref="/ai/image"
          ctaLabel={t('presets.usePreset')}
          icon={<Layers3 className="size-4 text-[#c9ff82]" />}
        />
        <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <SpotlightPanel className="rounded-md border border-white/10 bg-white/[0.035] p-3">
          <PresetTagRail tags={fallbackHome.tagRail} />
          </SpotlightPanel>
        </section>
        <MediaRail items={nextItems} label={t('presets.picksEyebrow')} />

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff82]">
                {t('presets.picksEyebrow')}
              </div>
              <h2 className="text-3xl font-semibold md:text-4xl">{t('presets.picksTitle')}</h2>
            </div>
            <a href="/ai/image" className="hidden items-center gap-2 text-sm font-semibold text-white/70 hover:text-white md:inline-flex">
              {t('presets.usePreset')}
              <Sparkles className="size-4" />
            </a>
          </div>
          <MediaMasonryGrid items={nextItems} variant={viral ? 'showcase' : 'rhythm'} />
        </section>
      </main>
    </PublicGrowthShell>
  );
}

export function PresetDetailView({ item }: { item?: PublicGrowthMediaItem | null }) {
  const t = useTranslations('publicGrowth');
  const data = item ?? getFallbackItems(t)[0];
  return (
    <PublicGrowthShell promo={{ label: t('presets.detailPromo', { title: data.title }), href: '/ai/image' }}>
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <MediaThumb item={data} eager className="h-full w-full scale-110 blur-2xl" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.68),#050505_68%,#050505_100%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:py-16">
        <section className="overflow-hidden rounded-md border border-white/12 bg-black shadow-[0_30px_110px_rgb(0_0_0/0.42)]">
          <MediaThumb item={data} eager autoPlay className="aspect-[4/5] w-full" />
        </section>
        <section className="self-center rounded-md border border-white/10 bg-black/52 p-5 backdrop-blur-md">
          <div className="mb-4 inline-flex rounded-md bg-[#c9ff82] px-2 py-1 text-xs font-semibold text-black">
            {t('presets.premiumBadge')}
          </div>
          <h1 className="text-5xl font-semibold leading-[0.96] md:text-6xl">{data.title}</h1>
          <p className="mt-5 text-base leading-7 text-white/62">{data.subtitle || data.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {data.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-white/12 px-3 py-2 text-sm text-white/76">
                {tag}
              </span>
            ))}
          </div>
          <MagneticLink
            href="/ai/image"
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-[#c9ff82]"
          >
            {t('presets.usePreset')}
            <ArrowRight className="size-4" />
          </MagneticLink>
        </section>
        </div>
      </main>
    </PublicGrowthShell>
  );
}
