'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bookmark, Heart, ImageIcon, Loader2, Play, UserRound } from 'lucide-react';
import {
  useAuthStore,
  useGalleryFeedController,
  useUiStore,
  type GalleryFeedItem,
} from '@autix/shared-store';
import { Link, useSearchParams } from '../navigation';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { HomeGallerySkeleton } from '../growth/home/HomeGallerySkeleton';

function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

type GalleryKind = 'IMAGE' | 'VIDEO';

/**
 * Gallery 列表页（Plan C Task 12 Step 2）：拉 `/gallery/feed`，masonry 展示已发布作品，
 * 每张卡片显示 viewer 收藏/点赞态（feed overlay，登录态才有；匿名恒 false）。
 * 复用 HomeGallerySection 同款视觉语言（masonry + hover 悬浮信息），但作为独立可翻页的列表页。
 */
export function GalleryListView() {
  const t = useTranslations('gallery');
  const searchParams = useSearchParams();
  const initialKind: GalleryKind = searchParams.get('kind')?.toUpperCase() === 'VIDEO' ? 'VIDEO' : 'IMAGE';
  const [kind, setKind] = useState<GalleryKind>(initialKind);
  const { items, loading, loadingMore, hasMore, error, loadMore, toggleLike, toggleFavorite } =
    useGalleryFeedController(kind);

  return (
    <div className="mx-auto max-w-[1920px] px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="inline-flex w-fit rounded-full border border-border bg-secondary/50 p-1">
          {(['IMAGE', 'VIDEO'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                kind === option
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option === 'IMAGE' ? t('kindImage') : t('kindVideo')}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <HomeGallerySkeleton />
      ) : items.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <ImageIcon className="mb-3 size-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t('emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('emptyDescription')}</p>
        </div>
      ) : (
        <>
          <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
            {items.map((item) => (
              <GalleryCard
                key={item.post.id}
                item={item}
                onToggleLike={() => void toggleLike(item)}
                onToggleFavorite={() => void toggleFavorite(item)}
              />
            ))}
          </div>
          {hasMore ? (
            <div className="mt-8 flex justify-center">
              <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('loadMore')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function GalleryCard({
  item,
  onToggleLike,
  onToggleFavorite,
}: {
  item: GalleryFeedItem;
  onToggleLike: () => void;
  onToggleFavorite: () => void;
}) {
  const t = useTranslations('gallery');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const { post, metrics, liked, favorited } = item;
  const cover = post.coverImage ?? post.mediaUrls[0] ?? null;
  const author = post.authorSnapshot?.displayName || t('unknownAuthor');
  const isVideo = post.kind === 'VIDEO';

  const guardedAction = (action: () => void) => (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry' });
      return;
    }
    action();
  };

  return (
    <Link
      href={`/gallery/${post.id}`}
      className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-lg bg-secondary text-left transition duration-200 hover:brightness-[1.03]"
    >
      {cover ? (
        <img src={cover} alt={post.title ?? ''} loading="lazy" className="block h-auto w-full" />
      ) : (
        <div className="grid aspect-[3/4] w-full place-items-center bg-secondary text-foreground/32">
          <ImageIcon className="size-10" />
        </div>
      )}

      {isVideo ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background/45 text-foreground backdrop-blur-md">
          <Play className="size-5 translate-x-px" />
        </span>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-background/80 via-background/0 to-background/0 opacity-0 transition duration-200 group-hover:opacity-100" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex translate-y-1 items-center justify-between gap-2 p-2.5 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
        <span className="growth-inset-ring inline-flex min-w-0 items-center gap-1.5 rounded-full bg-background/40 px-2.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md">
          <UserRound className="size-3.5 shrink-0" />
          <span className="truncate">{author}</span>
        </span>
        <span className="pointer-events-auto flex items-center gap-1">
          <button
            type="button"
            aria-label={t('like')}
            aria-pressed={liked}
            onClick={guardedAction(onToggleLike)}
            className="growth-inset-ring inline-flex items-center gap-1 rounded-full bg-background/40 px-2 py-1.5 text-xs font-bold text-foreground backdrop-blur-md transition hover:bg-background/60"
          >
            <Heart className={cn('size-3.5', liked && 'fill-growth-accent text-growth-accent')} />
            {formatMetric(metrics.likeCount)}
          </button>
          <button
            type="button"
            aria-label={t('favorite')}
            aria-pressed={favorited}
            onClick={guardedAction(onToggleFavorite)}
            className="growth-inset-ring grid size-7 place-items-center rounded-full bg-background/40 text-foreground backdrop-blur-md transition hover:bg-background/60"
          >
            <Bookmark className={cn('size-3.5', favorited && 'fill-growth-accent text-growth-accent')} />
          </button>
        </span>
      </div>
    </Link>
  );
}
