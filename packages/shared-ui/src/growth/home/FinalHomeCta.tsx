import {
  ArrowRight,
  Images,
  Layers3,
  Sparkles,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MediaThumb } from '../MediaBlocks';
import type { PublicGrowthMediaItem } from '../types';
import { demoVideoItem } from './home-parts';

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
  const t = useTranslations('publicGrowth.home');
  const backgroundItem = mediaItem
    ? mediaItem.mediaType === 'video'
      ? mediaItem
      : demoVideoItem(mediaItem, 4)
    : null;
  const links = [
    { label: imageLabel, href: '/ai/image', icon: Images },
    { label: videoLabel, href: '/ai/video', icon: Video },
    // `/presets` 从未落地，同 PresetRunway 一样改指向模板市场（`/marketplace/image-templates`）。
    { label: presetsLabel, href: '/marketplace/image-templates', icon: Layers3 },
  ];

  return (
    <section className="relative overflow-hidden border-t border-border bg-background">
      {backgroundItem ? (
        <MediaThumb
          item={backgroundItem}
          eager={false}
          autoPlay
          className="absolute inset-0 opacity-[0.16] blur-[2px]"
        />
      ) : null}
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-70" />
      <div className="growth-cta-diagonal-tint pointer-events-none absolute inset-0 opacity-[0.09]" />
      <div className="relative mx-auto max-w-[1920px] px-4 py-14 md:px-6 md:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <div className="growth-shiny-label mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="size-3.5 text-info" />
              {t('studioLabel')}
            </div>
            <h2 className="growth-kinetic-title max-w-3xl text-4xl font-semibold leading-[1.02] tracking-normal text-foreground md:text-6xl">
              {title}
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
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
                  className="growth-rb-card group flex min-h-24 items-center justify-between gap-4 rounded-md border border-border bg-secondary px-5 py-4 text-lg font-semibold text-foreground transition duration-300 hover:-translate-y-1 hover:border-input hover:bg-primary hover:text-primary-foreground"
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
