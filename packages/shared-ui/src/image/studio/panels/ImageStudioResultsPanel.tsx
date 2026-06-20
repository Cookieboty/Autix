'use client';

import { ImageIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ImageResultItem } from '../../../chat/MessageBubble';
import { GeneratedImageCard } from '../cards/ImageResultCards';

export function ImageStudioResultsPanel({
  images,
  isGenerating,
  onPreview,
  onUseAsSource,
  onSubmitFeedback,
  onAddToMaterial,
}: {
  images: ImageResultItem[];
  isGenerating: boolean;
  onPreview: (image: ImageResultItem) => void;
  onUseAsSource?: (image: ImageResultItem) => void;
  onSubmitFeedback?: (image: ImageResultItem, rating: 1 | 5) => Promise<void> | void;
  onAddToMaterial: (image: ImageResultItem) => Promise<void> | void;
}) {
  const t = useTranslations('imageStudio');

  return (
    <section className="flex min-h-[360px] flex-1 flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('result.title')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('result.subtitle')}
          </p>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <Loader2 className="size-3.5 animate-spin" />
            {t('result.generating')}
          </div>
        )}
      </div>

      {images.length === 0 ? (
        <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
          <ImageIcon className="mb-3 size-10 text-muted-foreground/55" />
          <p className="text-sm font-medium">{t('result.empty.title')}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {t('result.empty.description')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {images.map((image) => (
            <GeneratedImageCard
              key={`${image.url}-${image.index ?? ''}`}
              image={image}
              onPreview={() => onPreview(image)}
              onUseAsSource={() => onUseAsSource?.(image)}
              onSubmitFeedback={onSubmitFeedback}
              onAddToMaterial={() => onAddToMaterial(image)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
