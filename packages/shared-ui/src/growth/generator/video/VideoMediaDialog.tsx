'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Maximize2, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  publicGeneratorActions,
  type PublicImageHistoryItem,
} from '@autix/shared-store';
import { readFilesAsDataUrls } from '../../../image/studio/constants';
import type { PublicVideoReference } from '../generator-studio-helpers';

type PublicVideoMediaTab = 'uploads' | 'generations';

function flattenImageHistoryReferences(history: PublicImageHistoryItem[]): PublicVideoReference[] {
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
  const [dragActive, setDragActive] = useState(false);
  const [previewRef, setPreviewRef] = useState<PublicVideoReference | null>(null);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, limit - selectedRefs.length);
  const selectedUrls = useMemo(
    () => new Set(selectedRefs.map((ref) => ref.url)),
    [selectedRefs],
  );
  const selectedOrder = useMemo(() => {
    const map = new Map<string, number>();
    selectedRefs.forEach((ref, index) => map.set(ref.url, index + 1));
    return map;
  }, [selectedRefs]);
  // 上传素材 tab 只展示用户自己上传的内容，历史生成的素材不在此出现
  const uploadedRefs = useMemo(
    () => selectedRefs.filter((ref) => ref.sourceType !== 'image_generation'),
    [selectedRefs],
  );

  useEffect(() => {
    if (!open || tab !== 'generations') return;
    let cancelled = false;
    setHistoryLoading(true);
    publicGeneratorActions
      .listImageHistory({ pageSize: 40 })
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

  useEffect(() => {
    if (!open) {
      setPreviewRef(null);
      return;
    }
    if (!previewRef) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setPreviewRef(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, previewRef]);

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

  const uploadDisabled = remaining <= 0 || uploading;

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (uploadDisabled) return;
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (uploadDisabled) return;
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (uploadDisabled) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (uploadDisabled) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) void handleFiles(files);
  };

  const uploadCard = (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="col-span-2"
    >
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadDisabled}
        className={`growth-upload-btn-bg growth-upload-btn-shadow group relative flex aspect-[2/1] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[15px] border p-3 text-center transition hover:border-growth-accent/38 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45 ${dragActive ? 'border-growth-accent ring-2 ring-growth-accent/35' : 'border-border'}`}
      >
        <span className="growth-radial-upload-overlay pointer-events-none absolute inset-0 opacity-80" />
        <span className="growth-upload-icon-shadow relative grid size-5 place-items-center rounded-full bg-secondary text-foreground/58 transition group-hover:scale-105 group-hover:text-foreground">
          {uploading ? <Loader2 className="size-2.5 animate-spin" /> : <Plus className="size-2.5" />}
        </span>
        <span className="relative mt-2 text-sm font-bold">{tMedia('uploadImages')}</span>
        <span className="relative mt-1 max-w-full text-[11px] font-semibold leading-4 text-foreground/38">{tMedia('pasteHint')}</span>
      </button>
    </div>
  );

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[80] text-foreground">
      <div
        onPaste={handlePaste}
        className="growth-sheet-shadow pointer-events-auto fixed inset-x-3 bottom-3 flex max-h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-[22px] border border-border bg-card/88 ring-1 ring-border/35 backdrop-blur-2xl md:inset-x-5 md:bottom-5 md:top-auto md:max-h-none lg:bottom-auto lg:left-auto lg:right-[max(356px,calc((100vw-1800px)/2+356px))] lg:top-[clamp(220px,38vh,279px)] lg:h-[min(360px,calc(100svh-clamp(220px,38vh,279px)-18px))] lg:w-[min(440px,calc(100vw-max(356px,calc((100vw-1800px)/2+356px))-24px))] xl:w-[min(480px,calc(100vw-max(356px,calc((100vw-1800px)/2+356px))-32px))]">
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
          {tab === 'uploads' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {uploadCard}
              {uploadedRefs.map((ref) => (
                <div
                  key={ref.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed
                  onClick={() => onRemoveRef(ref.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRemoveRef(ref.id);
                    }
                  }}
                  aria-label={ref.name}
                  className="group relative block aspect-square cursor-pointer overflow-hidden rounded-[15px] border-2 border-growth-accent bg-background text-left shadow-lg outline-none ring-2 ring-growth-accent/30 focus-visible:ring-2 focus-visible:ring-growth-accent/55"
                >
                  <img src={ref.url} alt={ref.name} className="h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 bg-growth-accent/12 transition group-hover:bg-background/45" />
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 grid size-4 place-items-center rounded-full bg-growth-accent text-[10px] font-bold text-background shadow-sm">
                    {selectedOrder.get(ref.url)}
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="preview"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setPreviewRef(ref);
                    }}
                    className="absolute left-2 top-2 grid size-5 cursor-zoom-in place-items-center rounded-full bg-background/55 text-foreground/80 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-background/75 hover:text-foreground"
                  >
                    <Maximize2 className="size-2.5" />
                  </span>
                  <span className="pointer-events-none absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-growth-accent text-background shadow-sm transition group-hover:opacity-0">
                    <Check className="size-3" />
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={tMedia('remove')}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemoveRef(ref.id);
                    }}
                    className="absolute right-2 top-2 grid size-5 cursor-pointer place-items-center rounded-full bg-background/55 text-foreground/80 opacity-0 shadow-sm transition hover:bg-destructive hover:text-background group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {uploadCard}
              {historyLoading ? (
                <div className="col-span-1 grid aspect-square place-items-center rounded-[15px] border border-dashed border-border text-sm font-semibold text-foreground/45">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {tMedia('loadingHistory')}
                  </span>
                </div>
              ) : (
                historyRefs.map((ref) => {
                  const selected = selectedUrls.has(ref.url);
                  const order = selectedOrder.get(ref.url);
                  const disabled = !selected && remaining <= 0;
                  return (
                    <div
                      key={ref.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      onClick={() => addHistoryRef(ref)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          addHistoryRef(ref);
                        }
                      }}
                      aria-disabled={disabled}
                      aria-label={ref.name}
                      className={`group relative block aspect-square overflow-hidden rounded-[15px] bg-background text-left shadow-lg outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-growth-accent/55 ${selected
                        ? 'border-2 border-growth-accent ring-2 ring-growth-accent/30'
                        : 'border border-border hover:border-input'} ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
                    >
                      <img src={ref.url} alt={ref.name} className="h-full w-full object-cover" />
                      <div
                        className={`pointer-events-none absolute inset-0 transition ${selected
                          ? 'bg-growth-accent/12 group-hover:bg-background/45'
                          : 'bg-background/0 group-hover:bg-background/35'}`}
                      />
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label="preview"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setPreviewRef(ref);
                        }}
                        className="absolute left-2 top-2 grid size-5 cursor-zoom-in place-items-center rounded-full bg-background/55 text-foreground/80 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-background/75 hover:text-foreground"
                      >
                        <Maximize2 className="size-2.5" />
                      </span>
                      {selected ? (
                        <>
                          {order ? (
                            <span className="pointer-events-none absolute bottom-1.5 left-1.5 grid size-4 place-items-center rounded-full bg-growth-accent text-[10px] font-bold text-background shadow-sm">
                              {order}
                            </span>
                          ) : null}
                          <span className="pointer-events-none absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-growth-accent text-background shadow-sm transition group-hover:opacity-0">
                            <Check className="size-3" />
                          </span>
                          <span
                            role="button"
                            tabIndex={-1}
                            aria-label={tMedia('remove')}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onRemoveRef(ref.id);
                            }}
                            className="absolute right-2 top-2 grid size-5 cursor-pointer place-items-center rounded-full bg-background/55 text-foreground/80 opacity-0 shadow-sm transition hover:bg-destructive hover:text-background group-hover:opacity-100"
                          >
                            <X className="size-3" />
                          </span>
                        </>
                      ) : !disabled ? (
                        <span className="pointer-events-none absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-background/60 text-foreground/80 opacity-0 shadow-sm transition group-hover:opacity-100">
                          <Plus className="size-3" />
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
      {previewRef ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewRef.name}
          onClick={() => setPreviewRef(null)}
          className="pointer-events-auto fixed inset-0 z-[90] grid place-items-center bg-background/82 p-6 backdrop-blur-md"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[90vh] max-w-[min(960px,90vw)] flex-col items-center"
          >
            <img
              src={previewRef.url}
              alt={previewRef.name}
              className="max-h-[80vh] max-w-full rounded-[18px] object-contain shadow-2xl"
            />
            {previewRef.name ? (
              <div className="mt-3 max-w-full truncate text-center text-sm font-semibold text-foreground/85">
                {previewRef.name}
              </div>
            ) : null}
            <button
              type="button"
              aria-label={t('close')}
              onClick={() => setPreviewRef(null)}
              className="absolute -right-2 -top-2 grid size-10 cursor-pointer place-items-center rounded-full bg-background text-foreground shadow-lg transition hover:bg-accent"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
