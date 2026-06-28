import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PublicGrowthMediaItem } from '../types';

export const HOME_VIDEO_DEMOS = [
  'https://cdn.amux.ai/playground/video/video/demo/03.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/short-film-mini.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/high-impact-mini.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/action-v2-mini.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/compaign-mini.mp4',
] as const;

export function demoVideoItem(item: PublicGrowthMediaItem, index: number): PublicGrowthMediaItem {
  return {
    ...item,
    id: `${item.id}-video-demo-${index}`,
    mediaType: 'video',
    mediaUrl: HOME_VIDEO_DEMOS[index % HOME_VIDEO_DEMOS.length]!,
    posterUrl: item.posterUrl ?? item.mediaUrl,
    badge: item.badge || 'Video',
  };
}

export function releaseDetail(item: PublicGrowthMediaItem) {
  return item.subtitle || item.description || item.tags.slice(0, 2).join(' / ');
}

export function HomeSectionIntro({
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
        <div className="growth-shiny-label mb-3 inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="size-3.5 text-info" />
          {eyebrow}
        </div>
        <h2
          className={`growth-kinetic-title max-w-4xl font-semibold leading-[1.05] tracking-normal text-foreground ${
            compact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl'
          }`}
        >
          {title}
        </h2>
      </div>
      <div className={center ? 'mx-auto mt-4 flex max-w-2xl flex-col items-center gap-5' : 'lg:justify-self-end'}>
        {subtitle ? (
          <p className={`max-w-2xl text-sm text-muted-foreground ${compact ? 'leading-6' : 'leading-7 md:text-base'}`}>
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
