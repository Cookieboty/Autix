'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Heart, ImageIcon, Play, UserRound } from 'lucide-react';
import { publicGalleryActions, type GalleryFeedItem } from '@autix/shared-store';
import { HomeGallerySkeleton } from './HomeGallerySkeleton';
import { PublicGalleryDetailDialog } from './PublicGalleryDetailDialog';

export type HomeGallerySource = 'image' | 'video';

/**
 * 通用 Gallery 模块：Image Gallery / Video Gallery 共用。
 * 数据来自广场（gallery_posts）已发布作品热度 Feed：GET /api/gallery/feed?kind=IMAGE|VIDEO。
 * 只展示几排，底部渐隐 + View all。广场无已发布作品时整块隐藏。
 */
export function HomeGallerySection({
  title,
  subtitle,
  viewAllHref,
  source = 'image',
}: {
  title: string;
  subtitle?: string;
  viewAllHref: string;
  source?: HomeGallerySource;
}) {
  const t = useTranslations('publicGrowth.home');
  const tGen = useTranslations('publicGrowth.generator.studio');
  const [items, setItems] = useState<GalleryFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GalleryFeedItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    const kind = source === 'video' ? 'VIDEO' : 'IMAGE';
    publicGalleryActions
      .listFeed({ kind, limit: 24 })
      .then((feed) => {
        if (!cancelled) setItems(feed);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  // 广场暂无已发布作品时整块隐藏（不占位）
  if (!loading && items.length === 0) return null;

  return (
    <section className="bg-background py-8 md:py-10">
      <div className="mx-auto max-w-[1920px] px-4 md:px-6">
        <div className="mb-6">
          <h2 className="text-3xl font-black uppercase tracking-tight text-growth-accent md:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{subtitle}</p>
          ) : null}
        </div>

        {loading ? (
          <div className="relative">
            {/* 与已加载态相同的固定高度裁剪，保证 loading → 内容 不跳动 */}
            <div className="h-[1000px] overflow-hidden md:h-[1140px]">
              <HomeGallerySkeleton />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/85 to-transparent" />
          </div>
        ) : (
          <div className="relative">
            {/* 外层容器固定高度裁剪，约露出 3 排 */}
            <div className="h-[1000px] overflow-hidden md:h-[1140px]">
              <HomeGalleryGrid
                items={items}
                unknownAuthor={tGen('unknownAuthor')}
                onSelect={setSelected}
              />
            </div>

            {/* 底部渐隐 + View all 按钮（半透明） */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-64 items-end justify-center bg-gradient-to-t from-background via-background/85 to-transparent pb-4">
              <a
                href={viewAllHref}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-growth-accent/35 bg-growth-accent/20 px-5 py-2.5 text-sm font-bold text-growth-accent backdrop-blur-md transition hover:bg-growth-accent/30"
              >
                {t('viewAllOf', { title })}
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          </div>
        )}
      </div>

      <PublicGalleryDetailDialog item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/** 广场作品瀑布流卡片（展示态）：封面 + 作者 + 点赞；视频作品带播放角标。 */
function HomeGalleryGrid({
  items,
  unknownAuthor,
  onSelect,
}: {
  items: GalleryFeedItem[];
  unknownAuthor: string;
  onSelect: (item: GalleryFeedItem) => void;
}) {
  return (
    <div className="columns-1 gap-3 opacity-95 sm:columns-2 lg:columns-3 2xl:columns-4">
      {items.map((item, index) => {
        const { post, metrics } = item;
        const cover = post.coverImage ?? post.mediaUrls[0] ?? null;
        const author = post.authorSnapshot?.displayName || unknownAuthor;
        const isVideo = post.kind === 'VIDEO';
        return (
          <article
            key={post.id}
            className="growth-generator-masonry group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-md bg-secondary text-left transition duration-300 hover:scale-[1.01] hover:brightness-110"
            style={{ animationDelay: `${(index % 9) * 80}ms` }}
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

            <button
              type="button"
              aria-label={post.title ?? ''}
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => onSelect(item)}
            />

            {isVideo ? (
              <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background/45 text-foreground backdrop-blur-md">
                <Play className="size-5 translate-x-px" />
              </span>
            ) : null}

            <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-background/70 via-background/10 to-background/70 opacity-0 transition duration-200 group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex translate-y-[-6px] items-start justify-between gap-2 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
              <span className="growth-inset-ring inline-flex min-w-0 items-center gap-2 rounded-full bg-background/36 px-2.5 py-1.5 text-xs font-bold text-foreground backdrop-blur-md">
                <UserRound className="size-3.5 shrink-0" />
                <span className="truncate">{author}</span>
              </span>
              <span className="growth-inset-ring-bright inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1.5 text-sm font-black text-foreground backdrop-blur-md">
                <Heart className="size-4" />
                {formatMetric(metrics.likeCount)}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
