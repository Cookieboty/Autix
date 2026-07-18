'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, Heart, ImageIcon, Play } from 'lucide-react';
import {
  galleryActions,
  useProfileGenerationsController,
  useAuthStore,
  useUiStore,
  type GalleryFeedItem,
} from '@autix/shared-store';
import { useRouter } from '../../navigation';
import { AuthorAvatar } from '../AuthorAvatar';
import { ImpressionSentinel } from '../ImpressionSentinel';
import { GalleryDetailDialog, type GalleryInteraction } from '../detail/GalleryDetailDialog';
import { useGalleryPostModal } from '../detail/useGalleryPostModal';
import { buildGeneratorWorkbenchHref } from '../generator-workbench-href';

function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/**
 * `/@username` 个人页 Generations feed：该用户已发布作品瀑布流（image+video 混排）。
 * 卡片视觉与首页广场墙（HomeGalleryGrid）一致；点击走通用详情弹窗（本地弹窗 + 地址栏改
 * /gallery/<id>，刷新才落真实详情页），点赞/收藏走 gallery 专属幂等端点。
 */
export function ProfileGenerationsFeed({ username }: { username: string }) {
  const t = useTranslations('publicGrowth.publicProfile');
  const tGen = useTranslations('publicGrowth.generator.studio');
  const feed = useProfileGenerationsController(username);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const galleryModal = useGalleryPostModal();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const returnTo = `/@${username}`;

  // 触底前一屏预加载下一页（root=viewport）。
  const canLoadMore = feed.hasMore && !feed.loading && !feed.loadingMore;
  const loadMoreRef = useRef(feed.loadMore);
  loadMoreRef.current = feed.loadMore;
  useEffect(() => {
    if (!canLoadMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore]);

  const interactionOf = (item: GalleryFeedItem): GalleryInteraction => ({
    liked: item.liked ?? false,
    favorited: item.favorited ?? false,
    likeCount: item.metrics.likeCount,
  });

  const requireAuth = (): boolean => {
    if (isAuthenticated) return false;
    openAuthModal({ mode: 'entry', returnTo });
    return true;
  };

  const onToggleLike = (postId: string) => {
    if (requireAuth()) return;
    const item = feed.items.find((entry) => entry.post.id === postId);
    if (item) void feed.toggleLike(item).catch(() => {});
  };

  const onToggleFavorite = (postId: string) => {
    if (requireAuth()) return;
    const item = feed.items.find((entry) => entry.post.id === postId);
    if (item) void feed.toggleFavorite(item).catch(() => {});
  };

  const recreate = (item: GalleryFeedItem) => {
    const prompt = item.post.prompt ?? item.post.description ?? '';
    if (!prompt) return;
    router.push(
      buildGeneratorWorkbenchHref({
        kind: item.post.kind === 'VIDEO' ? 'video' : 'image',
        prompt,
        model: item.post.model,
      }),
    );
  };

  if (feed.loading) {
    return (
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="mb-3 w-full break-inside-avoid rounded-md bg-secondary"
            style={{ height: `${220 + (i % 4) * 70}px` }}
          />
        ))}
      </div>
    );
  }

  if (feed.items.length === 0) {
    return (
      <div className="grid min-h-[40vh] place-items-center px-6 text-center">
        <div>
          <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-border bg-secondary/60 text-foreground/40">
            <ImageIcon className="size-7" />
          </div>
          <h2 className="mt-5 text-lg font-black text-foreground">{t('emptyTitle')}</h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
        {feed.items.map((item, index) => {
          const { post, metrics } = item;
          const cover = post.coverImage ?? post.mediaUrls[0] ?? null;
          const author = item.author?.nickname || tGen('unknownAuthor');
          const isVideo = post.kind === 'VIDEO';
          const interaction = interactionOf(item);
          return (
            <article
              key={post.id}
              className="growth-generator-masonry group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-md bg-secondary text-left transition duration-300 hover:scale-[1.01] hover:brightness-110"
            >
              {cover ? (
                <img
                  src={cover}
                  alt={post.title ?? ''}
                  loading={index < 8 ? 'eager' : 'lazy'}
                  className="block h-auto w-full"
                />
              ) : (
                <div className="grid aspect-[3/4] w-full place-items-center bg-secondary text-foreground/32">
                  <ImageIcon className="size-10" />
                </div>
              )}

              <ImpressionSentinel resourceType="GALLERY_POST" resourceId={post.id} />

              <button
                type="button"
                aria-label={post.title ?? ''}
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={() => galleryModal.open(item)}
              />

              {isVideo ? (
                <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background/45 text-foreground backdrop-blur-md">
                  <Play className="size-5 translate-x-px" />
                </span>
              ) : null}

              <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-background/70 via-background/10 to-background/70 opacity-0 transition duration-200 group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex translate-y-2 items-end justify-between gap-2 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                <span className="growth-inset-ring inline-flex h-7 min-w-0 items-center gap-2 rounded-full bg-black/25 pl-1 pr-2.5 text-xs font-bold text-foreground backdrop-blur-md">
                  <AuthorAvatar name={author} avatarUrl={item.author?.avatar} />
                  <span className="truncate">{author}</span>
                </span>
                <span className="growth-inset-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-black/25 pl-2.5 pr-1 text-xs font-bold text-foreground backdrop-blur-md">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3.5" />
                    {formatMetric(metrics.viewCount)}
                  </span>
                  <button
                    type="button"
                    aria-label={post.title ?? ''}
                    aria-pressed={interaction.liked}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleLike(post.id);
                    }}
                    className="pointer-events-auto inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-full bg-black/45 px-2 transition hover:bg-black/60"
                  >
                    <Heart className={`size-3.5 ${interaction.liked ? 'fill-red-500 text-red-500' : ''}`} />
                    {formatMetric(interaction.likeCount)}
                  </button>
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {/* 触底哨兵 + 加载中占位 */}
      <div ref={sentinelRef} className="h-4 w-full" />
      {feed.loadingMore ? (
        <div className="py-6 text-center text-sm text-foreground/45">···</div>
      ) : null}

      <GalleryDetailDialog
        item={galleryModal.item}
        onClose={galleryModal.close}
        interaction={galleryModal.item ? interactionOf(galleryModal.item) : undefined}
        onToggleLike={onToggleLike}
        onToggleFavorite={onToggleFavorite}
        onRecreate={recreate}
      />
    </>
  );
}
