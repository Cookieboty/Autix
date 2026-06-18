import {
  ImageIcon,
  Maximize2,
  PencilLine,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import type { ImageTemplate } from '@autix/shared-lib';

export function ImageTemplateCard({
  template,
  onApply,
}: {
  template: ImageTemplate;
  onApply: () => void;
}) {
  const t = useTranslations('imageStudio');
  const cover = template.coverImage || template.exampleImages?.[0];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-primary/45">
      <div className="flex gap-3 p-2.5">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {cover ? (
            <img src={cover} alt={template.title} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-xs font-medium leading-5">{template.title}</p>
            {template.isHot && (
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                {t('template.hot')}
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {template.description || template.prompt}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-[10px] text-muted-foreground">
              {t('template.usageSummary', { category: template.category, count: template.useCount ?? 0 })}
            </span>
            <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={onApply}>
              {t('template.apply')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReferenceThumb({
  url,
  label,
  annotationOverlayUrl,
  onPreview,
  onAnnotate,
  onRemove,
}: {
  url: string;
  label: string;
  annotationOverlayUrl?: string;
  onPreview: () => void;
  onAnnotate: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('imageStudio');
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
      <button type="button" className="h-full w-full" onClick={onAnnotate} title={t('reference.zoomAnnotate')}>
        <img src={url} alt="" className="h-full w-full object-cover" />
        {annotationOverlayUrl && (
          <img
            src={annotationOverlayUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        )}
      </button>
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
        {label}
      </span>
      {annotationOverlayUrl && (
        <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
          {t('reference.annotated')}
        </span>
      )}
      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-primary"
          onClick={onAnnotate}
          title={t('reference.zoomAnnotate')}
        >
          <PencilLine className="size-3.5" />
        </button>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-foreground"
          onClick={onPreview}
          title={t('reference.previewOriginal')}
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>
      <button
        type="button"
        className={cn(
          'absolute bottom-1 right-1 hidden size-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-destructive group-hover:flex',
        )}
        onClick={onRemove}
        title={t('common.remove')}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
