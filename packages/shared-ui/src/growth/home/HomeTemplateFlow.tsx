import {
  Images,
  Layers3,
  Video,
} from 'lucide-react';
import { MediaThumb } from '../MediaBlocks';
import { Link } from '../../navigation';
import type { PublicGrowthMediaItem } from '../types';
import { demoVideoItem, HomeSectionIntro, releaseDetail } from './home-parts';

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

function videoBackdropItem(items: PublicGrowthMediaItem[], index: number) {
  const videoItem = items.find((item) => item.mediaType === 'video');
  if (videoItem) return videoItem;
  const fallback = items[index % Math.max(items.length, 1)];
  return fallback ? demoVideoItem(fallback, index) : null;
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
      className="growth-template-card-shadow group relative block aspect-[3/4] w-[58vw] min-w-[58vw] overflow-hidden rounded-md border border-border bg-secondary transition duration-500 hover:-translate-y-1 hover:border-input sm:w-64 sm:min-w-64 lg:w-72 lg:min-w-72"
      aria-label={item.title}
    >
      <MediaThumb
        item={item}
        eager={index < 2}
        autoPlay={isVideo && index < 2}
        className="transition duration-[900ms] group-hover:scale-[1.04]"
      />
      <div className="growth-template-card-overlay absolute inset-0" />
      <div className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)]">
        <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background/52 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{isVideo ? videoLabel : imageLabel}</span>
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-foreground">
          {item.title}
        </h3>
        {detail ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
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
    <section className="relative overflow-hidden border-y border-border bg-background py-12 md:py-20">
      {backgroundVideo ? (
        <MediaThumb
          item={backgroundVideo}
          eager={false}
          autoPlay
          className="absolute inset-0 opacity-[0.12] blur-sm"
        />
      ) : null}
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-80" />
      <div className="growth-grid-noise-md pointer-events-none absolute inset-0 opacity-[0.08]" />
      <div className="relative mx-auto max-w-[1920px] px-4 md:px-6">
        <HomeSectionIntro
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <Link
                href="/marketplace/image-templates"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Images className="size-4" />
                {imageLabel}
              </Link>
              <Link
                href="/marketplace/video-templates"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-info/24 bg-info/10 px-3 py-2 text-sm font-semibold text-info transition hover:bg-primary hover:text-primary-foreground"
              >
                <Video className="size-4" />
                {videoLabel}
              </Link>
              <Link
                href="/ai/image?mode=gallery"
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-black text-primary-foreground transition hover:bg-info"
              >
                <Layers3 className="size-4" />
                {actionLabel}
              </Link>
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
