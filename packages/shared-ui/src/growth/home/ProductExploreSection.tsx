import { Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MediaThumb } from '../MediaBlocks';
import type {
  PublicGrowthFeature,
  PublicGrowthMediaItem,
} from '../types';
import { demoVideoItem, HOME_VIDEO_DEMOS, HomeSectionIntro, releaseDetail } from './home-parts';

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
  const t = useTranslations('publicGrowth.media');
  if (!features.length) return null;
  const mediaStack = videoFirstItems(items);
  const firstMedia = mediaStack[0] ?? items[0];
  if (!firstMedia) return null;
  const backgroundItem = videoEntryItem(features, firstMedia);
  const previewItems = videoPreviewItems(mediaStack);

  return (
    <section className="relative overflow-hidden border-y border-border bg-background py-6 md:py-7">
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-60" />
      <div className="growth-grid-noise-explore pointer-events-none absolute inset-0 opacity-[0.08]" />
      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <HomeSectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} compact />

        <div className="grid gap-3 lg:grid-cols-[0.82fr_1.18fr] lg:items-stretch">
          <a
            href={backgroundItem.href}
            className="growth-rb-card growth-explore-card-shadow group relative block h-[360px] overflow-hidden rounded-xl border border-border bg-background transition duration-500 hover:-translate-y-1 hover:border-input md:h-[405px] lg:h-[450px]"
            aria-label={backgroundItem.title}
          >
            <MediaThumb
              item={backgroundItem}
              eager
              autoPlay={backgroundItem.mediaType === 'video'}
              className="absolute inset-0 transition duration-[900ms] group-hover:scale-[1.035]"
            />
            <div className="growth-feature-side-overlay absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-4 md:p-5">
              <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-border bg-background/46 px-2 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
                <Video className="size-3.5 text-info" />
                {backgroundItem.badge || backgroundItem.mediaType}
              </div>
              <h3 className="max-w-xl text-xl font-semibold leading-tight text-foreground md:text-2xl">
                {backgroundItem.title}
              </h3>
              <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-6 text-muted-foreground">
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
                  className="growth-rb-card growth-flow-border group relative block h-[210px] min-h-0 overflow-hidden rounded-xl border border-border bg-background transition duration-300 hover:-translate-y-1 hover:border-input md:h-[216px] lg:h-full"
                  aria-label={item.title}
                >
                  <MediaThumb
                    item={item}
                    eager={index === 0}
                    autoPlay={index < 2}
                    className="absolute inset-0 opacity-60 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-80"
                  />
                  <div className="growth-preview-card-overlay absolute inset-0" />
                  <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-lg border border-border bg-background/46 px-2 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
                    <Video className="size-3.5 text-info" />
                    {t('video')}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                    <div className="max-w-[92%] translate-y-5 transition duration-500 group-hover:translate-y-0">
                      <h3 className="line-clamp-1 text-lg font-semibold leading-tight text-foreground">
                        {item.title}
                      </h3>
                      {detail ? (
                        <p className="mt-2 line-clamp-1 text-sm leading-6 text-foreground/0 transition duration-500 group-hover:text-muted-foreground">
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
