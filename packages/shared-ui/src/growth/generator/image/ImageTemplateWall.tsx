'use client';

import type { MouseEvent } from 'react';
import { Eye, Heart, Image as ImageIcon, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ImageTemplate } from '@autix/shared-store';
import { MediaThumb } from '../../MediaBlocks';
import type { PublicGrowthMediaItem } from '../../types';
import { imageTemplateCover, type TemplateDensity } from '../generator-studio-helpers';

const TEMPLATE_DENSITY_WALL_CLASS: Record<TemplateDensity, string> = {
  relaxed: 'columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4',
  normal: 'columns-2 gap-2 md:columns-4 xl:columns-5',
  dense: 'columns-2 gap-1.5 md:columns-5 xl:columns-6',
};
const TEMPLATE_DENSITY_SKELETON_CLASS: Record<TemplateDensity, string> = {
  relaxed: 'grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  normal: 'grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5',
  dense: 'grid-cols-2 gap-1.5 md:grid-cols-5 xl:grid-cols-6',
};

function repeatedItems(items: PublicGrowthMediaItem[], count: number) {
  if (!items.length) return [];
  return Array.from({ length: count }, (_, index) => items[index % items.length]!);
}

function formatTemplateMetric(value?: number | null) {
  const count = Math.max(0, value ?? 0);
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

export function ImageHeroCollage({ items }: { items: PublicGrowthMediaItem[] }) {
  const collage = repeatedItems(items, 4);
  return (
    <div className="relative mx-auto mb-5 h-48 w-full max-w-[650px] md:h-52">
      <div className="absolute inset-x-[14%] top-12 h-28 rounded-full bg-info/10 blur-3xl" />
      {collage.map((item, index) => (
        <a
          key={`${item.id}-${index}`}
          href={item.href}
          className={`growth-generator-card growth-hero-card-glow absolute top-6 block overflow-hidden rounded-md border-[5px] border-input bg-background transition duration-500 hover:z-10 hover:scale-105 ${index === 0
            ? 'left-[2%] h-[7.5rem] w-[29%] -rotate-8'
            : index === 1
              ? 'left-[27%] h-36 w-[27%] rotate-3'
              : index === 2
                ? 'left-[51%] h-36 w-[22%] rounded-full'
                : 'right-[2%] h-[7.5rem] w-[29%] -rotate-3'
            }`}
          style={{ animationDelay: `${index * 160}ms` }}
          aria-label={item.title}
        >
          <MediaThumb item={item} eager={index < 2} autoPlay={index === 0} />
        </a>
      ))}
    </div>
  );
}

export function PublicImageTemplateWall({
  templates,
  loading,
  density,
  onSelectTemplate,
  onUseTemplate,
}: {
  templates: ImageTemplate[];
  loading: boolean;
  density: TemplateDensity;
  onSelectTemplate: (template: ImageTemplate) => void;
  onUseTemplate: (template: ImageTemplate) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const previewTemplates = templates.slice(0, 24);
  const scrollFrameClass =
    'pointer-events-auto absolute inset-x-0 bottom-0 top-0 overflow-y-auto overscroll-contain pb-[370px] pt-16 [scrollbar-gutter:stable]';

  if (loading) {
    return (
      <div className={scrollFrameClass}>
        <div className={`pointer-events-none grid opacity-75 ${TEMPLATE_DENSITY_SKELETON_CLASS[density]}`}>
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-md bg-secondary"
              style={{ animationDelay: `${(index % 6) * 90}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (previewTemplates.length === 0) {
    return (
      <div className={scrollFrameClass}>
        <div className="flex justify-center px-4 pt-16">
          <div className="rounded-md border border-border bg-background/38 px-5 py-4 text-sm font-semibold text-foreground/48 backdrop-blur">
            {t('templatesEmpty')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={scrollFrameClass}>
      <div className={`opacity-95 ${TEMPLATE_DENSITY_WALL_CLASS[density]}`}>
        {previewTemplates.map((template, index) => {
          const cover = imageTemplateCover(template);
          const author = template.authorName || template.authorUrl || t('unknownAuthor');
          const handleUseTemplate = (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onUseTemplate(template);
          };
          return (
            <article
              key={template.id}
              className="growth-generator-masonry group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-md bg-secondary text-left transition duration-300 hover:scale-[1.01] hover:brightness-110"
              style={{ animationDelay: `${(index % 9) * 80}ms` }}
            >
              {cover ? (
                <img
                  src={cover}
                  alt={template.title}
                  loading={index < 8 ? 'eager' : 'lazy'}
                  className="block h-auto w-full"
                />
              ) : (
                <div className="grid aspect-[3/4] w-full place-items-center bg-secondary text-foreground/32">
                  <ImageIcon className="size-10" />
                </div>
              )}
              <button
                type="button"
                aria-label={template.title}
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={() => onSelectTemplate(template)}
              >
                <span className="sr-only">{template.title}</span>
              </button>
              <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-background/70 via-background/10 to-background/70 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex translate-y-[-6px] items-start justify-between gap-2 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <span className="growth-inset-ring inline-flex min-w-0 items-center gap-2 rounded-full bg-background/36 px-2.5 py-1.5 text-xs font-bold text-foreground backdrop-blur-md">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="truncate">{author}</span>
                </span>
                <span className="growth-inset-ring-bright inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1.5 text-sm font-black text-foreground backdrop-blur-md">
                  <Heart className="size-4" />
                  {formatTemplateMetric(template.likeCount)}
                </span>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex translate-y-2 items-end justify-between gap-3 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <div className="min-w-0">
                  <span className="mb-1 inline-flex rounded-md bg-growth-accent px-2 py-1 text-[10px] font-black uppercase text-background">
                    {template.category || t('templates')}
                  </span>
                  <p className="line-clamp-2 text-sm font-black text-foreground">{template.title}</p>
                </div>
                <div className="pointer-events-none flex shrink-0 flex-col items-end gap-2 group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
                  <span className="growth-inset-ring inline-flex items-center gap-1 rounded-full bg-background/36 px-2.5 py-1.5 text-xs font-bold text-foreground/86 backdrop-blur-md">
                    <Eye className="size-3.5" />
                    {formatTemplateMetric(template.viewCount)}
                  </span>
                  <button
                    type="button"
                    className="growth-btn-drop-shadow inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md bg-growth-accent px-4 text-sm font-black text-background transition duration-200 hover:bg-foreground"
                    onClick={handleUseTemplate}
                  >
                    {t('usePrompt')}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
