'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Filter, Loader2, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  imageWorkbenchActions,
  type ImageWorkbenchHistoryItem,
} from '@autix/shared-store';
import { readFilesAsDataUrls } from '../../../image/studio/constants';
import type { PublicVideoReference } from '../generator-studio-helpers';

type PublicVideoMediaTab = 'uploads' | 'generations';

function flattenImageHistoryReferences(history: ImageWorkbenchHistoryItem[]): PublicVideoReference[] {
  return history.flatMap((item) => {
    const images = item.images?.length
      ? item.images
      : item.generatedImages.map((url, index) => ({
        url,
        index,
        generationId: item.id,
        prompt: item.resolvedPrompt,
      }));
    return images
      .filter((image) => typeof image.url === 'string' && image.url.trim())
      .map((image) => ({
        id: `history-${image.generationId ?? item.id}-${image.index}`,
        url: image.url,
        name: item.resolvedPrompt || `Generation ${image.index + 1}`,
        prompt: image.prompt ?? item.resolvedPrompt,
        sourceType: 'image_generation' as const,
        sourceId: image.generationId ?? item.id,
      }));
  });
}

export function PublicVideoMediaDialog({
  open,
  selectedRefs,
  limit,
  onAddRefs,
  onRemoveRef,
  onClose,
}: {
  open: boolean;
  selectedRefs: PublicVideoReference[];
  limit: number;
  onAddRefs: (refs: PublicVideoReference[]) => void;
  onRemoveRef: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tMedia = useTranslations('publicGrowth.generator.media');
  const [tab, setTab] = useState<PublicVideoMediaTab>('uploads');
  const [uploading, setUploading] = useState(false);
  const [historyRefs, setHistoryRefs] = useState<PublicVideoReference[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, limit - selectedRefs.length);
  const selectedUrls = useMemo(
    () => new Set(selectedRefs.map((ref) => ref.url)),
    [selectedRefs],
  );

  useEffect(() => {
    if (!open || tab !== 'generations') return;
    let cancelled = false;
    setHistoryLoading(true);
    imageWorkbenchActions
      .listHistory({ pageSize: 40 })
      .then((items) => {
        if (!cancelled) setHistoryRefs(flattenImageHistoryReferences(items));
      })
      .catch(() => {
        if (!cancelled) setHistoryRefs([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  if (!open) return null;

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || remaining <= 0 || uploading) return;
    const imageFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, remaining);
    if (imageFiles.length === 0) return;
    setUploading(true);
    try {
      const urls = await readFilesAsDataUrls(imageFiles);
      const stamp = Date.now();
      onAddRefs(
        urls.map((url, index) => ({
          id: `video-upload-${stamp}-${index}`,
          url,
          name: imageFiles[index]?.name ?? tMedia('uploadImages'),
          sourceType: 'upload',
        })),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (remaining <= 0) return;
    const items = event.clipboardData?.items;
    if (!items?.length) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    if (files.length === 0) return;
    event.preventDefault();
    void handleFiles(files);
  };

  const addHistoryRef = (ref: PublicVideoReference) => {
    if (selectedUrls.has(ref.url)) {
      onRemoveRef(ref.id);
      return;
    }
    if (remaining <= 0) return;
    onAddRefs([ref]);
  };

  const selectedCountLabel = tMedia('selected', { count: selectedRefs.length, limit });
  const bodyTitle = tab === 'uploads' ? tMedia('uploads') : tMedia('generations');
  const emptyUploadSlots = Math.max(0, Math.min(7, limit - selectedRefs.length - 1));

  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-background/35 text-foreground backdrop-blur-[1.5px]"
      onPaste={handlePaste}
    >
      <div className="growth-sheet-shadow fixed inset-x-3 bottom-3 flex max-h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-[22px] border border-border bg-card/88 ring-1 ring-border/35 backdrop-blur-2xl md:inset-x-5 md:bottom-5 md:top-auto md:max-h-none lg:left-[max(332px,calc((100vw-1800px)/2+360px))] lg:right-auto lg:top-[clamp(238px,42vh,304px)] lg:h-[min(420px,calc(100svh-clamp(238px,42vh,304px)-18px))] lg:w-[min(600px,calc(100vw-max(332px,calc((100vw-1800px)/2+360px))-24px))] xl:w-[min(640px,calc(100vw-max(332px,calc((100vw-1800px)/2+360px))-32px))]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <div className="flex h-[54px] shrink-0 items-center justify-between gap-2 border-b border-border bg-card/72 px-3 md:h-[58px]">
          <div className="inline-flex min-w-0 items-center gap-1.5">
            {[
              { value: 'uploads' as const, label: tMedia('uploads') },
              { value: 'generations' as const, label: tMedia('generations') },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={`min-h-9 cursor-pointer rounded-full px-4 text-sm font-bold transition ${tab === item.value
                  ? 'growth-tab-active-shadow bg-foreground text-background'
                  : 'text-foreground/68 hover:bg-secondary hover:text-foreground'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={t('close')}
            onClick={onClose}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-secondary text-foreground/70 transition hover:bg-accent hover:text-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="growth-dialog-body-bg min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <span className="text-sm font-semibold text-foreground/42">{bodyTitle}</span>
            <div className="inline-flex items-center gap-2">
              <span className="hidden rounded-full bg-background/24 px-2.5 py-1 text-xs font-semibold text-foreground/42 sm:inline">
                {selectedCountLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-foreground/58">
                <Filter className="size-3.5" />
                {tMedia('filter')}
              </span>
            </div>
          </div>
          {tab === 'uploads' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={remaining <= 0 || uploading}
                className="growth-upload-btn-bg growth-upload-btn-shadow group relative col-span-2 flex min-h-[136px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[15px] border border-border p-4 text-center transition hover:border-growth-accent/38 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[144px]"
              >
                <span className="growth-radial-upload-overlay pointer-events-none absolute inset-0 opacity-80" />
                <span className="growth-upload-icon-shadow relative grid size-12 place-items-center rounded-full bg-secondary text-foreground/58 transition group-hover:scale-105 group-hover:text-foreground">
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-6" />}
                </span>
                <span className="relative mt-4 text-base font-bold">{tMedia('uploadImages')}</span>
                <span className="relative mt-2 max-w-[18rem] text-xs font-semibold leading-5 text-foreground/38">{tMedia('pasteHint')}</span>
              </button>
              {selectedRefs.map((ref) => (
                <div
                  key={ref.id}
                  className="group relative aspect-square overflow-hidden rounded-[15px] border border-growth-accent/50 bg-background shadow-lg"
                >
                  <img src={ref.url} alt={ref.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 opacity-75" />
                  <button
                    type="button"
                    aria-label={tMedia('remove')}
                    onClick={() => onRemoveRef(ref.id)}
                    className="absolute right-2 top-2 grid size-8 cursor-pointer place-items-center rounded-full bg-background/62 text-foreground/75 transition hover:bg-background hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                  <div className="absolute inset-x-3 bottom-3 truncate text-sm font-bold text-foreground">
                    {ref.name}
                  </div>
                </div>
              ))}
              {Array.from({ length: emptyUploadSlots }).map((_, index) => (
                <div
                  key={`empty-upload-slot-${index}`}
                  aria-hidden="true"
                  className="growth-empty-slot-bg aspect-square rounded-[15px] border border-border"
                />
              ))}
            </div>
          ) : historyLoading ? (
            <div className="grid min-h-72 place-items-center text-sm font-semibold text-foreground/45">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {tMedia('loadingHistory')}
              </span>
            </div>
          ) : historyRefs.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-[18px] border border-dashed border-border text-sm font-semibold text-foreground/42">
              {tMedia('emptyHistory')}
            </div>
          ) : (
            <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 [column-fill:_balance]">
              {historyRefs.map((ref) => {
                const selected = selectedUrls.has(ref.url);
                return (
                  <button
                    key={ref.id}
                    type="button"
                    onClick={() => addHistoryRef(ref)}
                    disabled={!selected && remaining <= 0}
                    className={`group relative mb-3 block w-full overflow-hidden rounded-[18px] border bg-background text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${selected
                      ? 'border-growth-accent ring-2 ring-growth-accent/25'
                      : 'border-border hover:border-input'
                      }`}
                  >
                    <img src={ref.url} alt={ref.name} className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
                    <span className="absolute inset-x-3 bottom-3 flex min-h-9 items-center justify-center rounded-full bg-foreground/88 px-3 text-sm font-black text-background">
                      {selected ? tMedia('done') : tMedia('checkEligibility')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
