'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, ChevronRight, RefreshCcw } from 'lucide-react';
import {
  getConversationImages,
  type ConversationImageItem,
  type ConversationImagesResponse,
} from '@autix/sdk';
import { useImagePreview } from './ImagePreview';

const STORAGE_KEY = 'chat.imagesPanel.collapsed';

type FetcherResult = ConversationImagesResponse | undefined | null;

export interface ConversationImagesPanelProps {
  conversationId: string | null | undefined;
  /** Hook for custom data source (tests, storybook). Defaults to getConversationImages. */
  fetcher?: (conversationId: string) => Promise<FetcherResult>;
  /** External signal to re-fetch (e.g. when a new image_result message arrives). */
  refreshToken?: number | string;
  className?: string;
}

function isSsr() {
  return typeof window === 'undefined';
}

function readCollapsed(): boolean {
  if (isSsr()) return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

function writeCollapsed(collapsed: boolean) {
  if (isSsr()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function ConversationImagesPanel({
  conversationId,
  fetcher,
  refreshToken,
  className,
}: ConversationImagesPanelProps) {
  const t = useTranslations('chat.images');
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [items, setItems] = useState<ConversationImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openPreview, element: previewElement } = useImagePreview();

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const activeFetcher = useMemo(
    () =>
      fetcher ??
      (async (id: string) => {
        const res = await getConversationImages(id);
        return res.data;
      }),
    [fetcher],
  );

  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!conversationId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await activeFetcher(conversationId);
      if (seq !== requestSeq.current) return;
      setItems(data?.items ?? []);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load images');
      setItems([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [conversationId, activeFetcher]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  const count = items.length;

  if (!conversationId) {
    return null;
  }

  if (collapsed) {
    return (
      <>
        <div
          className={`flex h-full w-10 shrink-0 flex-col items-center border-l border-border bg-background py-2 ${className ?? ''}`}
        >
          <button
            type="button"
            onClick={toggle}
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t('expand')}
            title={t('title')}
          >
            <ImageIcon className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        </div>
        {previewElement}
      </>
    );
  }

  return (
    <>
      <aside
        className={`flex h-full w-72 shrink-0 flex-col border-l border-border bg-background ${className ?? ''}`}
        style={{ maxWidth: '80vw' }}
      >
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span className="truncate text-sm font-medium text-foreground">
              {t('title')}
            </span>
            {count > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t('count', { count })}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('refresh')}
              title={t('refresh')}
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={toggle}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={t('collapse')}
              title={t('collapse')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading && items.length === 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-center">
              <span className="text-xs text-muted-foreground">{t('error')}</span>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-md border border-border px-3 py-1 text-xs text-foreground transition-colors hover:bg-accent"
              >
                {t('retry')}
              </button>
            </div>
          ) : count === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground">{t('empty')}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {items.map((item, index) => (
                <button
                  key={`${item.url}-${index}`}
                  type="button"
                  onClick={() => openPreview(item.url, item.prompt)}
                  className="group relative overflow-hidden rounded-md border border-border/60 bg-muted/40"
                  title={item.prompt}
                >
                  <img
                    src={item.url}
                    alt={item.prompt ?? ''}
                    loading="lazy"
                    className="aspect-square h-full w-full cursor-zoom-in object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
      {previewElement}
    </>
  );
}
