'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, ImageIcon, Info, Sparkles, WandSparkles, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  PublicImageHistoryImage,
  PublicImageHistoryItem,
} from './public-image-generation';
import type { TemplateDensity } from '../generator-studio-helpers';

export type PendingImageGenerationCard = {
  id: string;
  prompt: string;
  model: string;
  count: number;
};

const HISTORY_DENSITY_GRID_CLASS: Record<TemplateDensity, string> = {
  xrelaxed: 'gap-4 sm:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3',
  relaxed: 'gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  normal: 'gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5',
  dense: 'gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6',
  xdense: 'gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8',
};

function formatTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PublicImageHistoryPanel({
  items,
  loading,
  density,
  pending,
}: {
  items: PublicImageHistoryItem[];
  loading: boolean;
  density: TemplateDensity;
  pending?: PendingImageGenerationCard | null;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const locale = useLocale();
  const [selectedItem, setSelectedItem] = useState<PublicImageHistoryItem | null>(null);

  if (loading && items.length === 0 && !pending) {
    return (
      <div className="grid min-h-[240px] place-items-center rounded-[18px] border border-border bg-card/76 text-sm font-semibold text-foreground/45">
        {t('loadingHistory')}
      </div>
    );
  }

  if (items.length === 0 && !pending) {
    return (
      <div className="growth-flow-border relative grid min-h-[240px] place-items-center overflow-hidden rounded-[18px] border border-border bg-card/76 p-6 text-center">
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-28 opacity-20" />
        <div className="relative grid size-14 place-items-center rounded-full border border-growth-accent/35 bg-growth-accent/10 text-growth-accent">
          <ImageIcon className="size-6" />
        </div>
        <div className="relative mt-4">
          <h2 className="text-xl font-black uppercase">{t('emptyHistory')}</h2>
          <p className="mt-2 text-sm font-semibold text-foreground/45">
            {t('imageBlankDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`grid ${HISTORY_DENSITY_GRID_CLASS[density]}`}>
        {pending ? <PendingImageCard pending={pending} /> : null}
        {items.map((item, itemIndex) => {
          const images = item.images;
          const cover = images[0];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedItem(item)}
              className="growth-generator-masonry group relative overflow-hidden rounded-[14px] border border-border bg-card text-left growth-history-card-shadow transition duration-300 hover:-translate-y-1 hover:border-growth-accent/45"
              style={{ animationDelay: `${Math.min(itemIndex, 8) * 45}ms` }}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                {cover ? (
                  <img
                    src={cover.url}
                    alt={cover.prompt ?? item.prompt}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-b from-background/6 via-transparent to-background/86" />
                <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-20 opacity-0 transition group-hover:opacity-25" />
                <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-[9px] bg-background/58 px-2 py-1 text-[11px] font-black text-foreground backdrop-blur">
                  <Sparkles className="size-3.5 text-growth-accent" />
                  {images.length}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="mb-2 text-[11px] font-bold text-foreground/48">
                    {formatTime(item.createdAt, locale)}
                  </div>
                  <h2 className="line-clamp-2 text-sm font-black leading-5 text-foreground">
                    {item.prompt || t('prompt')}
                  </h2>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <PublicImageHistoryDialog
        item={selectedItem}
        locale={locale}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
}

function PendingImageCard({ pending }: { pending: PendingImageGenerationCard }) {
  const t = useTranslations('publicGrowth.generator.studio');

  return (
    <article
      className="growth-flow-border growth-generator-masonry group relative overflow-hidden rounded-[14px] border border-growth-accent/35 bg-card text-left growth-history-card-shadow"
      aria-live="polite"
      aria-label={t('generating')}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        <div className="absolute inset-0 growth-history-empty-bg" />
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30" />
        <div className="absolute inset-3 rounded-[12px] border border-border/60 bg-background/16 backdrop-blur-sm" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-[9px] bg-background/58 px-2 py-1 text-[11px] font-black text-foreground backdrop-blur">
          <Sparkles className="size-3.5 text-growth-accent" />
          {pending.count}
        </div>
        <div className="absolute inset-x-0 top-[34%] flex flex-col items-center px-5 text-center">
          <span className="relative grid size-14 place-items-center rounded-full border border-growth-accent/40 bg-growth-accent/10 text-growth-accent growth-history-icon-glow">
            <span className="absolute inset-2 rounded-full border border-growth-accent/35 border-t-transparent animate-spin" />
            <Sparkles className="size-5 fill-growth-accent" />
          </span>
          <h2 className="mt-4 text-base font-black uppercase leading-none text-foreground">
            {t('generating')}
          </h2>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-foreground/50">
            {pending.prompt}
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className="growth-clip-pulse h-1.5 rounded-full bg-growth-accent/70"
                style={{ animationDelay: `${index * 120}ms` }}
              />
            ))}
          </div>
          <div className="truncate text-[11px] font-bold text-foreground/48">
            {pending.model}
          </div>
        </div>
      </div>
    </article>
  );
}

function PublicImageHistoryDialog({
  item,
  locale,
  onClose,
}: {
  item: PublicImageHistoryItem | null;
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [copied, setCopied] = useState(false);
  const [activeImage, setActiveImage] = useState<PublicImageHistoryImage | null>(null);
  const images = item?.images ?? [];
  const image = activeImage ?? images[0] ?? null;
  const prompt = image?.prompt ?? item?.prompt ?? '';

  useEffect(() => {
    if (!item) return;
    setCopied(false);
    setActiveImage(item.images[0] ?? null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const copyPrompt = () => {
    if (!prompt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex bg-background/82 text-foreground backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={prompt || t('history')}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div className="relative z-10 grid min-h-0 w-full grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_390px] md:p-6">
        <div className="relative flex min-h-[52svh] items-center justify-center overflow-hidden rounded-md bg-secondary">
          {image ? (
            <img
              src={image.url}
              alt={prompt || t('prompt')}
              className="max-h-[calc(100svh-3rem)] max-w-full rounded-md object-contain"
            />
          ) : (
            <div className="grid size-40 place-items-center rounded-md bg-secondary text-foreground/36">
              <ImageIcon className="size-12" />
            </div>
          )}
        </div>

        <aside className="growth-dialog-shadow flex min-h-0 flex-col rounded-md border border-border bg-card/96 p-4">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-growth-accent text-background">
                <WandSparkles className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-black">{t('historyDetail')}</h2>
                <p className="truncate text-sm font-semibold text-foreground/45">
                  {formatTime(item.createdAt, locale)}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-foreground/50 hover:bg-secondary hover:text-foreground"
              aria-label={t('close')}
              onClick={onClose}
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <section className="rounded-md bg-secondary p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-2 text-xs font-black uppercase text-foreground/50">
                  <Sparkles className="size-4" />
                  {t('prompt')}
                </h3>
                <button
                  type="button"
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-xs font-bold text-foreground/72 hover:bg-secondary hover:text-foreground"
                  onClick={copyPrompt}
                >
                  <Copy className="size-3.5" />
                  {copied ? t('copied') : t('copyPrompt')}
                </button>
              </div>
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-background/18 p-3 text-sm font-medium leading-6 text-foreground/62">
                {prompt || t('noPrompt')}
              </p>
            </section>

            {images.length > 1 ? (
              <section className="grid grid-cols-4 gap-2">
                {images.map((candidate) => (
                  <button
                    key={`${candidate.generationId ?? item.id}-${candidate.index}`}
                    type="button"
                    onClick={() => setActiveImage(candidate)}
                    className={`relative aspect-square overflow-hidden rounded-md border bg-background ${candidate.url === image?.url ? 'border-growth-accent ring-2 ring-growth-accent/25' : 'border-border hover:border-input'}`}
                  >
                    <img
                      src={candidate.url}
                      alt={candidate.prompt ?? item.prompt}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </section>
            ) : null}

            <section className="rounded-md bg-secondary p-4">
              <h3 className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase text-foreground/50">
                <Info className="size-4" />
                {t('information')}
              </h3>
              <div className="divide-y divide-border text-sm">
                <HistoryInfoRow label={t('model')} value={item.model || t('auto')} />
                <HistoryInfoRow label={t('createdAt')} value={formatTime(item.createdAt, locale)} />
                <HistoryInfoRow label={t('imageCount')} value={String(images.length)} />
                <HistoryInfoRow label={t('imageSize')} value={String(item.settings.size || '-')} />
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}

function HistoryInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <span className="text-foreground/42">{label}</span>
      <span className="min-w-0 truncate text-right font-bold text-foreground/78">{value}</span>
    </div>
  );
}
