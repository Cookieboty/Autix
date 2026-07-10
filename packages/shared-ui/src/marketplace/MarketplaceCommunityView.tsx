'use client';

import { ArrowRight, Images, Play, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AnyResource, ResourceType } from '@autix/shared-store';
import { PublicGrowthShell } from '../growth/PublicGrowthShell';
import { FallbackImage } from '../template/FallbackImage';
import { Link } from '../navigation';
import { MarketplaceChatDock } from './MarketplaceChatDock';
import { ResourceGrid } from './ResourceGrid';
import { getVideoPreviewUrl } from './VideoHoverPreview';
import { marketplaceSlugForResource } from './resource-utils';

function isTemplateResource(item: AnyResource) {
  const type = (item as { resourceType?: ResourceType }).resourceType;
  return type === 'IMAGE_TEMPLATE' || type === 'VIDEO_TEMPLATE';
}

function templateType(item: AnyResource): ResourceType {
  return ((item as { resourceType?: ResourceType }).resourceType ??
    'IMAGE_TEMPLATE') as ResourceType;
}

function dockResourceType(template: AnyResource | null): ResourceType {
  return template ? templateType(template) : 'IMAGE_TEMPLATE';
}

function TemplateMedia({
  item,
  className = '',
  autoPlay = false,
}: {
  item: AnyResource;
  className?: string;
  autoPlay?: boolean;
}) {
  const t = useTranslations('marketplace');
  const type = templateType(item);
  const videoUrl =
    type === 'VIDEO_TEMPLATE'
      ? getVideoPreviewUrl(
          item as {
            exampleMedia?: unknown;
            externalMetadata?: Record<string, unknown> | null;
          },
        )
      : null;
  const coverImage = (item as { coverImage?: string | null }).coverImage ?? undefined;
  const title = (item as { title?: string }).title ?? t('common.untitledResource');

  if (videoUrl) {
    return (
      <video
        className={`h-full w-full object-cover ${className}`}
        src={videoUrl}
        poster={coverImage}
        autoPlay={autoPlay}
        muted
        loop
        playsInline
        preload={autoPlay ? 'metadata' : 'none'}
      />
    );
  }

  return (
    <FallbackImage
      src={coverImage}
      alt={title}
      fallbackText={t('common.noCover')}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

function TypePill({ item }: { item: AnyResource }) {
  const t = useTranslations('marketplace');
  const type = templateType(item);
  const isVideo = type === 'VIDEO_TEMPLATE';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-background/58 px-2.5 py-1 text-[11px] font-semibold text-foreground/78 backdrop-blur-md">
      {isVideo ? <Video className="size-3.5" /> : <Images className="size-3.5" />}
      {t(isVideo ? 'resourceType.videoTemplateShort' : 'resourceType.imageTemplateShort')}
    </span>
  );
}

function FeaturedTemplate({
  item,
  onClick,
}: {
  item: AnyResource;
  onClick: (item: AnyResource) => void;
}) {
  const t = useTranslations('marketplace');
  const type = templateType(item);
  const isVideo = type === 'VIDEO_TEMPLATE';
  const title = (item as { title?: string }).title ?? t('common.untitledResource');
  const category = (item as { category?: string }).category ?? t('common.featured');
  const description =
    (item as { description?: string | null }).description ??
    category ??
    t('common.noDescription');

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group relative block h-[clamp(430px,64svh,620px)] overflow-hidden rounded-lg border border-border bg-secondary text-left growth-featured-shadow transition duration-500 hover:-translate-y-1 hover:border-border/22"
    >
      <TemplateMedia
        item={item}
        autoPlay
        className="transition duration-700 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 growth-featured-template-overlay" />
      <div className="absolute inset-x-0 top-0 h-px bg-foreground/40 opacity-0 transition group-hover:opacity-100" />
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <TypePill item={item} />
        {isVideo ? (
          <span className="grid size-9 place-items-center rounded-full bg-foreground text-background shadow-xl">
            <Play className="size-4 fill-background" />
          </span>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {((item as { tags?: string[] }).tags ?? []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-foreground/68"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/58">
          {category}
        </div>
        <h2 className="line-clamp-2 max-w-2xl text-3xl font-semibold leading-tight text-foreground md:text-4xl">
          {title}
        </h2>
        <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-foreground/62 md:text-base">
          {description}
        </p>
      </div>
    </button>
  );
}

function CompactTemplateCard({
  item,
  onClick,
}: {
  item: AnyResource;
  onClick: (item: AnyResource) => void;
}) {
  const t = useTranslations('marketplace');
  const type = templateType(item);
  const title = (item as { title?: string }).title ?? t('common.untitledResource');

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group relative min-h-[260px] overflow-hidden rounded-lg border border-border bg-secondary text-left transition duration-500 hover:-translate-y-1 hover:border-border/24"
    >
      <TemplateMedia
        item={item}
        autoPlay={type === 'VIDEO_TEMPLATE'}
        className="transition duration-700 group-hover:scale-[1.05]"
      />
      <div className="absolute inset-0 growth-compact-template-overlay" />
      <div className="absolute left-3 top-3">
        <TypePill item={item} />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-5 text-foreground">
          {title}
        </h3>
        <div className="mt-3 flex items-center justify-between text-xs text-foreground/48">
          <span>{(item as { category?: string }).category || t('common.featured')}</span>
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
      </div>
    </button>
  );
}

export function MarketplaceCommunityView({
  loading,
  error,
  hotRecommendations,
  hotRanking,
  editorPicks,
  chatEnabled,
  dockTemplate,
  onRetry,
  onResourceClick,
  onUseTemplateInChat,
  onUseTemplateInWorkbench,
  onCloseChatDock,
}: {
  loading: boolean;
  error?: string | null;
  hotRecommendations: AnyResource[];
  hotRanking: AnyResource[];
  editorPicks: AnyResource[];
  chatEnabled: boolean;
  dockTemplate: AnyResource | null;
  onRetry: () => void;
  onResourceClick: (item: AnyResource) => void;
  onUseTemplateInChat?: (item: AnyResource) => void;
  onUseTemplateInWorkbench: (item: AnyResource) => void;
  onCloseChatDock: () => void;
}) {
  const t = useTranslations('marketplace');
  const items = hotRecommendations.filter(isTemplateResource);
  const rankingItems = hotRanking.filter(isTemplateResource);
  const editorItems = editorPicks.filter(isTemplateResource);
  const merged = [...items, ...rankingItems, ...editorItems].filter(
    (item, index, list) => list.findIndex((next) => next.id === item.id) === index,
  );
  const [featured, second, third, ...rest] = merged;
  const feedItems = (rest.length ? rest : merged).slice(0, 16);
  const showRecommendationGrid = merged.length > 0 || (!loading && !error);

  return (
    <PublicGrowthShell navKind="community">
      <main className="bg-background text-foreground">
        <section className="relative overflow-hidden border-b border-border bg-background">
          {featured ? (
            <TemplateMedia
              item={featured}
              autoPlay
              className="absolute inset-0 opacity-[0.13] blur-sm"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] growth-grid-noise-community" />
          <div className="relative mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/community"
                  className="inline-flex min-h-9 items-center rounded-md bg-foreground px-3 text-sm font-semibold text-background"
                >
                  {t('community.feedTitle')}
                </Link>
                <Link
                  href="/marketplace/image-templates"
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-sm font-semibold text-foreground/72 transition hover:bg-secondary hover:text-foreground"
                >
                  <Images className="size-4" />
                  {t('resourceType.imageTemplate')}
                </Link>
                <Link
                  href="/marketplace/video-templates"
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-sm font-semibold text-foreground/72 transition hover:bg-secondary hover:text-foreground"
                >
                  <Video className="size-4" />
                  {t('resourceType.videoTemplate')}
                </Link>
              </div>
              <Link
                href="/marketplace/video-templates"
                className="hidden items-center gap-2 text-sm font-semibold text-foreground/52 transition hover:text-foreground md:inline-flex"
              >
                {t('community.moreVideo')}
                <ArrowRight className="size-4" />
              </Link>
            </div>

            {loading && !featured ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-border bg-secondary text-sm text-foreground/52">
                {t('common.loading')}
              </div>
            ) : error && !featured ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-secondary text-sm text-foreground/52">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:bg-growth-accent-hover"
                >
                  {t('common.retry')}
                </button>
              </div>
            ) : featured ? (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.16fr)_minmax(280px,0.84fr)]">
                <FeaturedTemplate item={featured} onClick={onResourceClick} />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {[second, third]
                    .filter((item): item is AnyResource => Boolean(item))
                    .map((item) => (
                      <CompactTemplateCard
                        key={item.id}
                        item={item}
                        onClick={onResourceClick}
                      />
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {feedItems.length > 0 ? (
          <section className="relative overflow-hidden border-b border-border bg-card py-6">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 growth-flow-fade-left" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 growth-flow-fade-right" />
            <div className="growth-template-flow flex w-max items-center gap-3 px-4 md:px-6">
              {[...feedItems, ...feedItems].map((item, index) => (
                <div key={`${item.id}-${index}`} className="w-72 shrink-0">
                  <CompactTemplateCard item={item} onClick={onResourceClick} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {showRecommendationGrid ? (
          <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/42">
                  {t('community.feedEyebrow')}
                </div>
                <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                  {t('community.feedTitle')}
                </h1>
              </div>
              <Link
                href="/marketplace/image-templates"
                className="hidden items-center gap-2 text-sm font-semibold text-foreground/62 transition hover:text-foreground md:inline-flex"
              >
                {t('resourceType.imageTemplate')}
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <ResourceGrid
              items={merged}
              onClickItem={onResourceClick}
              onUseTemplateInChat={onUseTemplateInChat}
              onUseTemplateInWorkbench={onUseTemplateInWorkbench}
              columns={4}
              layout="masonry"
              emptyText={t('community.empty')}
            />
          </section>
        ) : null}
      </main>

      {chatEnabled && (
        <MarketplaceChatDock
          template={dockTemplate}
          resourceType={dockResourceType(dockTemplate)}
          onClose={onCloseChatDock}
        />
      )}
    </PublicGrowthShell>
  );
}

export function communityResourceHref(item: AnyResource) {
  return `/marketplace/${marketplaceSlugForResource(item)}/${item.id}`;
}
