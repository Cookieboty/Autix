import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  PublicGrowthCollection,
  PublicGrowthFeature,
  PublicGrowthMediaItem,
} from './types';

function mediaPoster(item: PublicGrowthMediaItem) {
  return item.posterUrl || item.mediaUrl;
}

export function MediaThumb({
  item,
  eager = false,
  autoPlay = false,
  className = '',
}: {
  item: PublicGrowthMediaItem;
  eager?: boolean;
  autoPlay?: boolean;
  className?: string;
}) {
  if (item.mediaType === 'video') {
    return (
      <video
        className={`h-full w-full object-cover ${className}`}
        src={item.mediaUrl}
        poster={mediaPoster(item)}
        autoPlay={autoPlay}
        muted
        loop
        playsInline
        preload={eager || autoPlay ? 'metadata' : 'none'}
      />
    );
  }

  return (
    <img
      src={item.mediaUrl}
      alt={item.title}
      loading={eager ? 'eager' : 'lazy'}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

export function MediaCard({
  item,
  priority = false,
  tall = false,
  shape,
  className = '',
  tabIndex,
  ariaHidden = false,
}: {
  item: PublicGrowthMediaItem;
  priority?: boolean;
  tall?: boolean;
  shape?: 'portrait' | 'tall' | 'wide' | 'square' | 'fill';
  className?: string;
  tabIndex?: number;
  ariaHidden?: boolean;
}) {
  const t = useTranslations('publicGrowth.media');
  const mediaLabel = item.badge || (item.mediaType === 'video' ? t('video') : t('image'));
  const cardShape = shape ?? (tall ? 'tall' : 'portrait');
  const shapeClass = {
    fill: 'h-full min-h-[180px]',
    portrait: 'aspect-[4/5]',
    square: 'aspect-square',
    tall: 'aspect-[3/4]',
    wide: 'aspect-[16/10]',
  }[cardShape];

  return (
    <a
      href={item.href}
      tabIndex={tabIndex}
      aria-hidden={ariaHidden || undefined}
      className={`growth-chroma-card group relative block overflow-hidden rounded-md border border-white/10 bg-white/[0.04] shadow-[0_14px_55px_rgb(0_0_0/0.28)] transition duration-300 hover:-translate-y-1 hover:border-white/24 ${shapeClass} ${className}`}
    >
      <MediaThumb
        item={item}
        eager={priority}
        autoPlay={priority}
        className="transition duration-700 group-hover:scale-[1.05]"
      />
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
        <div className="absolute inset-x-0 top-0 h-px bg-white/55" />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.84))] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="max-w-[70%] truncate rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white/75">
            {mediaLabel}
          </span>
          {item.mediaType === 'video' ? (
            <span className="grid size-8 place-items-center rounded-full bg-white text-black">
              <Play className="size-3.5 fill-black" />
            </span>
          ) : (
            <ArrowUpRight className="size-4 text-white/70" />
          )}
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">{item.title}</h3>
        {item.author ? (
          <p className="mt-1 truncate text-xs text-white/55">@{item.author.handle}</p>
        ) : (
          <p className="mt-1 truncate text-xs text-white/55">{item.subtitle}</p>
        )}
      </div>
    </a>
  );
}

export function MediaRail({
  items,
  label,
}: {
  items: PublicGrowthMediaItem[];
  label?: string;
}) {
  const railItems = items.slice(0, 18);
  if (!railItems.length) return null;
  const loopItems = [...railItems, ...railItems];

  return (
    <section className="overflow-hidden border-y border-white/10 bg-[#080908] py-5">
      {label ? (
        <div className="mx-auto mb-3 flex max-w-7xl items-center gap-3 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/45 md:px-6">
          <span className="h-px flex-1 bg-white/10" />
          <span>{label}</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      ) : null}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-[linear-gradient(90deg,#080908,transparent)] md:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-[linear-gradient(270deg,#080908,transparent)] md:w-24" />
        <div className="growth-media-rail flex w-max gap-3 px-4 pb-1 md:px-6">
          {loopItems.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="w-[58vw] min-w-[58vw] snap-start sm:w-64 sm:min-w-64 lg:w-72 lg:min-w-72"
            >
              <MediaCard
                item={item}
                priority={index < 6}
                tall={index % 3 === 0}
                ariaHidden={index >= railItems.length}
                tabIndex={index >= railItems.length ? -1 : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MediaMasonryGrid({
  items,
  variant = 'masonry',
}: {
  items: PublicGrowthMediaItem[];
  variant?: 'masonry' | 'showcase' | 'rhythm';
}) {
  if (variant === 'showcase') {
    return (
      <div className="grid auto-rows-[170px] grid-cols-2 gap-3 md:auto-rows-[210px] md:grid-cols-4">
        {items.map((item, index) => {
          const feature = index % 9 === 0;
          const wide = index % 9 === 4 || index % 9 === 7;
          const className = feature
            ? 'col-span-2 row-span-2'
            : wide
              ? 'col-span-2'
              : '';
          return (
            <MediaCard
              key={item.id}
              item={item}
              priority={index < 3}
              shape="fill"
              className={className}
            />
          );
        })}
      </div>
    );
  }

  if (variant === 'rhythm') {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <MediaCard
            key={item.id}
            item={item}
            priority={index < 3}
            shape={index % 5 === 0 ? 'wide' : index % 4 === 1 ? 'tall' : 'square'}
            className={index % 7 === 0 ? 'lg:col-span-2' : ''}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
      {items.map((item, index) => (
        <div key={item.id} className="mb-3 break-inside-avoid">
          <MediaCard item={item} priority={index < 4} tall={index % 4 === 1 || index % 5 === 0} />
        </div>
      ))}
    </div>
  );
}

export function FeatureMatrix({ features }: { features: PublicGrowthFeature[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {features.map((feature) => (
        <a
          key={feature.key}
          href={feature.href}
          className="group relative overflow-hidden rounded-md border border-white/10 bg-white/[0.04] transition duration-300 hover:-translate-y-1 hover:border-white/24"
        >
          <div className="absolute inset-x-0 top-0 z-10 h-1" style={{ backgroundColor: feature.accent }} />
          <div className="aspect-[16/10] overflow-hidden bg-white/[0.04]">
            {feature.mediaUrl ? (
              <img
                src={feature.mediaUrl}
                alt={feature.title}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : null}
          </div>
          <div className="p-4">
            <div className="mb-3 inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold text-black" style={{ backgroundColor: feature.accent }}>
              <Sparkles className="size-3.5" />
              {feature.badge}
            </div>
            <h3 className="text-lg font-semibold">{feature.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/60">{feature.description}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

export function CollectionGrid({ collections }: { collections: PublicGrowthCollection[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {collections.map((collection) => (
        <a
          key={collection.slug}
          href={`/community/${collection.slug}`}
          className="group relative min-h-72 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]"
        >
          {collection.heroMedia ? (
            <img
              src={collection.heroMedia}
              alt={collection.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.88))]" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {collection.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-md bg-white/15 px-2 py-1 text-xs text-white/80">
                  {tag}
                </span>
              ))}
            </div>
            <h3 className="text-2xl font-semibold">{collection.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/65">{collection.description}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

export function PresetTagRail({ tags }: { tags: Array<{ label: string; href: string }> }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
      {tags.map((tag) => (
        <a
          key={tag.href}
          href={tag.href}
          className="whitespace-nowrap rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
        >
          {tag.label}
        </a>
      ))}
    </div>
  );
}
