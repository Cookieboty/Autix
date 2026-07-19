'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GalleryFeedItem } from '@autix/shared-store';
import type { TemplateDensity } from '../generator-studio-helpers';
import { VideoEmptyShowcase } from './VideoEmptyShowcase';

/**
 * 视频广场瀑布流。
 *
 * 分列用 JS 贪心（每次塞进当前最矮的一列），而不是 CSS `columns`——CSS 多列在追加
 * 元素时会重排所有列，无限滚动每加载一页整面墙都会跳动；JS 分列只往最矮列追加，
 * 已渲染的卡片位置永不改变。这与 ai/image 的模板墙是同一套取舍。
 */

/** 每档密度在各断点下的列数：[最小视口宽, 列数]，从宽到窄匹配 */
const DENSITY_COLUMNS: Record<TemplateDensity, Array<[number, number]>> = {
  xrelaxed: [[1536, 2], [0, 1]],
  relaxed: [[1536, 3], [1024, 2], [0, 1]],
  normal: [[1536, 4], [1024, 3], [640, 2], [0, 1]],
  dense: [[1280, 5], [768, 4], [0, 2]],
  xdense: [[1280, 6], [768, 5], [0, 3]],
};

const DENSITY_GAP: Record<TemplateDensity, string> = {
  xrelaxed: 'gap-3',
  relaxed: 'gap-3',
  normal: 'gap-2.5',
  dense: 'gap-2',
  xdense: 'gap-1.5',
};

/** 拿不到宽高时按竖屏短视频兜底 */
const FALLBACK_ASPECT_RATIO = 9 / 16;

/** SSR 没有 window，只能退回 useEffect；客户端用 layout effect 以便在绘制前完成同步 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function useColumnCount(density: TemplateDensity) {
  const [viewport, setViewport] = useState(0);
  // 必须是 layout effect：用 useEffect 的话，viewport=0 的首帧（落到最窄档 = 1 列）
  // 会先被绘制出来——骨架屏竖着叠成一根长条，看着像"一个大加载框"，紧接着才跳成多列瀑布流。
  // layout effect 在浏览器绘制前就把真实宽度写回去，那一帧不会出现。
  useIsomorphicLayoutEffect(() => {
    const sync = () => setViewport(window.innerWidth);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  return useMemo(() => {
    const rules = DENSITY_COLUMNS[density];
    for (const [minWidth, columns] of rules) {
      if (viewport >= minWidth) return columns;
    }
    return 1;
  }, [density, viewport]);
}

/** feed → 宽高比（width/height）；解析不出来返回 undefined，由调用方兜底 */
function itemAspectRatio(item: GalleryFeedItem): number | undefined {
  const { width, height, aspectRatio } = item.post;
  if (width && height && width > 0 && height > 0) return width / height;
  const match = aspectRatio?.match(/(\d+)\s*[x:×]\s*(\d+)/i);
  if (match) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w > 0 && h > 0) return w / h;
  }
  return undefined;
}

/**
 * 贪心分列。列等宽，所以「高度」只需按 1/ratio 累加，无需测量 DOM。
 */
function distributeToColumns(items: GalleryFeedItem[], columnCount: number) {
  const columns: GalleryFeedItem[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array(columnCount).fill(0);
  for (const item of items) {
    let target = 0;
    for (let i = 1; i < columnCount; i += 1) {
      if (heights[i] < heights[target]) target = i;
    }
    columns[target]!.push(item);
    heights[target] += 1 / (itemAspectRatio(item) ?? FALLBACK_ASPECT_RATIO);
  }
  return columns;
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

function VideoGalleryCard({
  item,
  onOpen,
}: {
  item: GalleryFeedItem;
  onOpen?: (item: GalleryFeedItem) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { post } = item;
  const cover = post.coverImage ?? undefined;
  const src = post.mediaUrls[0];
  const ratio = itemAspectRatio(item) ?? FALLBACK_ASPECT_RATIO;
  const duration = formatDuration(post.durationSec);

  return (
    <article
      className="group relative w-full overflow-hidden rounded-[10px] bg-black/40"
      style={{ aspectRatio: String(ratio) }}
    >
      {src ? (
        <video
          ref={videoRef}
          src={src}
          poster={cover}
          muted
          loop
          playsInline
          preload="metadata"
          className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : cover ? (
        <img src={cover} alt="" className="size-full object-cover" />
      ) : null}

      {/* 悬停渐变 + 元信息 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

      {/* 播放角标：未悬停时提示这是视频 */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background/40 text-foreground backdrop-blur-md transition duration-300 group-hover:opacity-0">
        <Play className="size-4 translate-x-px fill-current" />
      </span>

      {duration ? (
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] font-bold text-foreground/85 backdrop-blur-sm">
          {duration}
        </span>
      ) : null}

      {post.modelName ? (
        <span className="pointer-events-none absolute inset-x-2 bottom-2 truncate text-[11px] font-bold text-foreground/85 opacity-0 transition duration-300 group-hover:opacity-100">
          {post.modelName}
        </span>
      ) : null}

      {/* 整卡热区：hover 播放、点击进详情 */}
      <button
        type="button"
        aria-label={post.title ?? post.prompt ?? 'video'}
        onClick={() => onOpen?.(item)}
        onMouseEnter={() => {
          void videoRef.current?.play().catch(() => undefined);
        }}
        onMouseLeave={() => {
          const el = videoRef.current;
          if (!el) return;
          el.pause();
          el.currentTime = 0;
        }}
        className="absolute inset-0 cursor-pointer"
      />
    </article>
  );
}

/** 骨架屏：用几个固定比例交错，视觉上接近真实瀑布流 */
const SKELETON_RATIOS = [9 / 16, 3 / 4, 1, 9 / 16, 4 / 5, 16 / 9];

function GallerySkeletons({ columnCount, gap }: { columnCount: number; gap: string }) {
  // 每列固定 3 块，列数多时不至于每列只剩一两块、显得稀疏
  const columns = Array.from({ length: columnCount }, (_, columnIndex) =>
    Array.from({ length: 3 }, (_, row) => SKELETON_RATIOS[(columnIndex * 3 + row) % SKELETON_RATIOS.length]!),
  );
  return (
    <div className={`flex items-start ${gap}`}>
      {columns.map((ratios, columnIndex) => (
        <div key={columnIndex} className={`flex min-w-0 flex-1 flex-col ${gap}`}>
          {ratios.map((ratio, i) => (
            <div
              key={i}
              className="growth-skeleton w-full rounded-[10px]"
              style={{ aspectRatio: String(ratio) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 空态：视觉部分与 History 共用 VideoEmptyShowcase */
function VideoGalleryEmpty() {
  const t = useTranslations('publicGrowth.generator.studio');
  return (
    <VideoEmptyShowcase
      title={t('galleryEmptyTitle')}
      description={t('galleryEmptyDescription')}
    />
  );
}

export function VideoGalleryWall({
  items,
  loading,
  loadingMore,
  hasMore,
  density,
  onLoadMore,
  onOpen,
}: {
  items: GalleryFeedItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  density: TemplateDensity;
  onLoadMore: () => void;
  onOpen?: (item: GalleryFeedItem) => void;
}) {
  const columnCount = useColumnCount(density);
  const gap = DENSITY_GAP[density];
  const columns = useMemo(() => distributeToColumns(items, columnCount), [items, columnCount]);

  // 无限滚动：哨兵进入视口前 600px 就预取下一页
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (loading) return <GallerySkeletons columnCount={columnCount} gap={gap} />;
  if (items.length === 0) return <VideoGalleryEmpty />;

  return (
    <div>
      <div className={`flex items-start ${gap}`}>
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className={`flex min-w-0 flex-1 flex-col ${gap}`}>
            {column.map((item) => (
              <VideoGalleryCard key={item.post.id} item={item} onOpen={onOpen} />
            ))}
          </div>
        ))}
      </div>
      {hasMore ? <div ref={sentinelRef} className="h-px w-full" /> : null}
      {loadingMore ? (
        <div className="mt-3">
          <GallerySkeletons columnCount={columnCount} gap={gap} />
        </div>
      ) : null}
    </div>
  );
}
