'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Bookmark,
  Copy,
  Download,
  Heart,
  ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  galleryErrorMessage,
  useAuthStore,
  useGalleryDetailController,
  useUiStore,
} from '@autix/shared-store';
import { Link, useRouter } from '../navigation';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';

function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-sm font-black text-foreground">{formatMetric(value)}</span>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-bold text-foreground/82">{value}</span>
    </div>
  );
}

/**
 * Gallery 详情页（Plan C Task 12 Step 2）：拉 `GET /gallery/:id` 聚合 post/author/metrics/viewer。
 * 收藏/点赞按方向性调用（后端幂等 POST=favorite/DELETE=unfavorite，非切换），由
 * useGalleryDetailController 统一处理乐观更新与回滚。作者本人可见 unpublish/republish；
 * recreate 记一次引用并带 prompt/model 跳转到对应生成器。
 */
export function GalleryDetailView({ id }: { id: string }) {
  const t = useTranslations('gallery');
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUser = useAuthStore((state) => state.user);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const [copied, setCopied] = useState(false);

  const {
    query,
    post,
    author,
    liked,
    favorited,
    viewCount,
    likeCount,
    favoriteCount,
    downloadCount,
    referenceCount,
    toggleLike,
    toggleFavorite,
    unpublish,
    republish,
    recreate,
    download,
    isLiking,
    isFavoriting,
    isUnpublishing,
    isRepublishing,
    isRecreating,
    isDownloading,
  } = useGalleryDetailController(id);

  const requireAuth = (action: () => void) => () => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry' });
      return;
    }
    action();
  };

  const handleLike = requireAuth(() => {
    void toggleLike().catch((err: unknown) => toast.error(galleryErrorMessage(err)));
  });

  const handleFavorite = requireAuth(() => {
    void toggleFavorite().catch((err: unknown) => toast.error(galleryErrorMessage(err)));
  });

  const handleDownload = requireAuth(() => {
    void download()
      .then((result) => {
        if (result.downloadUrl && typeof window !== 'undefined') {
          window.open(result.downloadUrl, '_blank', 'noopener');
        }
      })
      .catch((err: unknown) => toast.error(galleryErrorMessage(err)));
  });

  const handleRecreate = requireAuth(() => {
    if (!post) return;
    const isVideo = post.kind === 'VIDEO';
    void recreate()
      .then((result) => {
        const params = new URLSearchParams();
        if (result.model) params.set('model', result.model);
        if (result.prompt) params.set('prompt', result.prompt);
        const query = params.toString();
        router.push(`${isVideo ? '/ai/video' : '/ai/image'}${query ? `?${query}` : ''}`);
      })
      .catch((err: unknown) => toast.error(galleryErrorMessage(err)));
  });

  const handleUnpublish = () => {
    void unpublish()
      .then(() => toast.success(t('unpublishSuccess')))
      .catch((err: unknown) => toast.error(galleryErrorMessage(err)));
  };

  const handleRepublish = () => {
    void republish()
      .then(() => toast.success(t('republishSuccess')))
      .catch((err: unknown) => toast.error(galleryErrorMessage(err)));
  };

  const copyPrompt = () => {
    if (!post?.prompt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(post.prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  if (query.isLoading) {
    return (
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_380px] md:px-6 md:py-8">
        <Skeleton className="min-h-[50svh] w-full rounded-xl bg-secondary" />
        <Skeleton className="h-[50svh] w-full rounded-xl bg-secondary" />
      </div>
    );
  }

  if (query.isError || !post) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="text-lg font-semibold text-foreground">{t('notFoundTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('notFoundDescription')}</p>
        <Button asChild variant="outline">
          <Link href="/gallery">
            <ArrowLeft className="size-4" />
            {t('backToGallery')}
          </Link>
        </Button>
      </div>
    );
  }

  const isOwner = Boolean(isAuthenticated && currentUser?.id === post.authorId);
  const isVideo = post.kind === 'VIDEO';
  const media = isVideo ? (post.mediaUrls[0] ?? post.coverImage) : (post.coverImage ?? post.mediaUrls[0]);
  const dimensions = post.width && post.height ? `${post.width} × ${post.height}` : post.aspectRatio;
  const authorInitial = author?.nickname?.trim()[0]?.toUpperCase() || 'A';

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
      <Link
        href="/gallery"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('backToGallery')}
      </Link>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative flex min-h-[50svh] items-center justify-center overflow-hidden rounded-xl bg-secondary">
          {media ? (
            isVideo ? (
              <video
                src={media}
                poster={post.coverImage ?? undefined}
                controls
                playsInline
                className="max-h-[calc(100svh-9rem)] max-w-full rounded-xl object-contain"
              />
            ) : (
              <img
                src={media}
                alt={post.title ?? ''}
                className="max-h-[calc(100svh-9rem)] max-w-full rounded-xl object-contain"
              />
            )
          ) : (
            <div className="grid size-40 place-items-center rounded-xl bg-secondary text-foreground/36">
              <ImageIcon className="size-12" />
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-growth-accent text-sm font-black text-background">
                {author?.avatar ? (
                  <img src={author.avatar} alt={author.nickname} className="h-full w-full object-cover" />
                ) : (
                  authorInitial
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-foreground">
                  {author?.nickname ?? t('unknownAuthor')}
                </div>
                <div className="text-xs text-muted-foreground">{t('author')}</div>
              </div>
            </div>
            {isOwner && post.status !== 'PUBLISHED' ? (
              <Badge variant="outline">{t(`status.${post.status.toLowerCase()}`)}</Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-2 rounded-lg border border-border/60 bg-secondary/40 py-3">
            <StatCell label={t('metricViews')} value={viewCount} />
            <StatCell label={t('metricLikes')} value={likeCount} />
            <StatCell label={t('metricFavorites')} value={favoriteCount} />
            <StatCell label={t('metricRecreates')} value={referenceCount} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={liked ? 'default' : 'outline'}
              onClick={handleLike}
              disabled={isLiking}
            >
              {isLiking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Heart className={cn('size-4', liked && 'fill-current')} />
              )}
              {t('like')}
            </Button>
            <Button
              type="button"
              variant={favorited ? 'default' : 'outline'}
              onClick={handleFavorite}
              disabled={isFavoriting}
            >
              {isFavoriting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bookmark className={cn('size-4', favorited && 'fill-current')} />
              )}
              {t('favorite')}
            </Button>
            <Button type="button" variant="outline" onClick={handleRecreate} disabled={isRecreating}>
              {isRecreating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {t('recreate')}
            </Button>
            <Button type="button" variant="outline" onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {t('download')}
              {downloadCount > 0 ? (
                <span className="text-xs font-normal text-muted-foreground">
                  {formatMetric(downloadCount)}
                </span>
              ) : null}
            </Button>
          </div>

          {isOwner ? (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {post.status === 'PUBLISHED' ? (
                <Button type="button" variant="ghost" size="sm" onClick={handleUnpublish} disabled={isUnpublishing}>
                  {isUnpublishing ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t('unpublish')}
                </Button>
              ) : null}
              {post.status === 'UNPUBLISHED' ? (
                <Button type="button" variant="ghost" size="sm" onClick={handleRepublish} disabled={isRepublishing}>
                  {isRepublishing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  {t('republish')}
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  {t('prompt')}
                </h3>
                {post.prompt ? (
                  <button
                    type="button"
                    className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 text-xs font-bold text-foreground/72 hover:bg-secondary hover:text-foreground"
                    onClick={copyPrompt}
                  >
                    <Copy className="size-3.5" />
                    {copied ? t('copied') : t('copyPrompt')}
                  </button>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/70">
                {post.prompt || t('noPrompt')}
              </p>
            </section>

            <div className="h-px bg-border" />

            <section>
              <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-muted-foreground">
                <UserRound className="size-3.5" />
                {t('information')}
              </h3>
              <div className="mt-2 divide-y divide-border/60 text-sm">
                <InfoRow label={t('model')} value={post.model || t('auto')} />
                <InfoRow label={t('dimensions')} value={dimensions || '-'} />
                {post.category ? <InfoRow label={t('category')} value={post.category} /> : null}
              </div>
            </section>

            {post.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
