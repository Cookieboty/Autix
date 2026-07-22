'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Eye, Heart, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GalleryFeedItem } from '@autix/shared-store';
import type { TemplateDensity } from '../generator-studio-helpers';
import { AuthorAvatar } from '../../AuthorAvatar';
import { formatMetricCount } from '../metric-format';
import { galleryHoverPlayHandlers } from '../../GalleryMediaThumb';
import { VideoEmptyShowcase } from './VideoEmptyShowcase';
import { CdnImage, CdnVideo } from '../../../image';

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
function distributeToColumns(
  items: GalleryFeedItem[],
  columnCount: number,
  measured: Record<string, number>,
) {
  const columns: GalleryFeedItem[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array(columnCount).fill(0);
  for (const item of items) {
    let target = 0;
    for (let i = 1; i < columnCount; i += 1) {
      if (heights[i] < heights[target]) target = i;
    }
    columns[target]!.push(item);
    // 优先用视频元数据量到的真实比例，其次投稿快照，最后兜底
    const ratio = measured[item.post.id] ?? itemAspectRatio(item) ?? FALLBACK_ASPECT_RATIO;
    heights[target] += 1 / ratio;
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
  index,
  interaction,
  onOpen,
  onRecreate,
  onToggleLike,
  onMeasureRatio,
}: {
  item: GalleryFeedItem;
  /** 全局下标：决定首屏 eager 预加载 */
  index: number;
  interaction?: { liked?: boolean; likeCount?: number };
  onOpen?: (item: GalleryFeedItem) => void;
  onRecreate?: (item: GalleryFeedItem) => void;
  onToggleLike?: (item: GalleryFeedItem) => void;
  /** 视频元数据到位后回传真实比例，供列高估算校正 */
  onMeasureRatio?: (postId: string, ratio: number) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const { post } = item;
  const cover = post.coverImage ?? undefined;
  const src = post.mediaUrls[0];
  /**
   * 卡片自己也存一份量到的比例：父级那份是给列高估算用的，这里要在同一帧就把容器
   * 定高改过来。只靠父级回传会多一次渲染往返，中间那帧仍按错误比例裁切。
   */
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const ratio = naturalRatio ?? itemAspectRatio(item) ?? FALLBACK_ASPECT_RATIO;
  const duration = formatDuration(post.durationSec);
  const liked = interaction?.liked ?? item.liked ?? false;
  const likeCount = interaction?.likeCount ?? item.metrics?.likeCount ?? 0;
  const authorName = item.author?.nickname || t('unknownAuthor');

  return (
    <article
      // 悬浮播放绑容器：与首页/个人主页同一套（galleryHoverPlayHandlers），
      // 绑在 video 或热区上各写一份早晚会漂
      {...galleryHoverPlayHandlers()}
      className="group relative w-full overflow-hidden rounded-[10px] bg-black/40"
      // 比例来自真实视频元数据（onLoadedMetadata 回传后由父级校正），
      // 拿不到时才退回投稿快照里的 aspectRatio —— 与 history 同一原则：
      // 厂商实际返回的画幅未必等于请求值，按请求值渲染会裁切画面。
      style={{ aspectRatio: String(ratio) }}
    >
      {src ? (
        <CdnVideo
          src={src}
          poster={cover}
          posterWidth={720}
          muted
          loop
          playsInline
          preload={index < 8 ? 'auto' : 'metadata'}
          className="size-full object-cover"
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget;
            if (!videoWidth || !videoHeight) return;
            const measured = videoWidth / videoHeight;
            setNaturalRatio(measured);
            onMeasureRatio?.(post.id, measured);
          }}
        />
      ) : cover ? (
        <CdnImage
          src={cover}
          alt=""
          width={720}
          widths={[360, 720, 1080]}
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
          priority={index < 4}
          loading={index < 8 ? 'eager' : 'lazy'}
          className="size-full object-cover"
        />
      ) : null}

      {/* 整卡热区：hover 播放预览、点击进详情。放在浮层之下，浮层里的按钮自己 stopPropagation */}
      <button
        type="button"
        aria-label={post.title ?? post.prompt ?? 'video'}
        onClick={() => onOpen?.(item)}
        className="absolute inset-0 z-10 cursor-pointer"
      />

      {/* 悬停渐变：上下两头压暗，让顶部按钮与底部信息读得清 */}
      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-background/70 via-background/10 to-background/70 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />

      {/* 时长角标：不放播放按钮，靠它表达「这是视频」。悬浮即播放，让位给操作按钮 */}
      {duration ? (
        <span className="pointer-events-none absolute right-2 top-2 z-20 rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] font-bold text-foreground/85 backdrop-blur-sm transition group-hover:opacity-0">
          {duration}
        </span>
      ) : null}

      {/* 右上角：用这条的提示词重新生成（与 image 广场卡同款位置与样式） */}
      {onRecreate ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex translate-y-[-6px] items-start justify-end gap-1.5 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <button
            type="button"
            className="growth-btn-drop-shadow pointer-events-auto inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-growth-accent px-2.5 text-xs font-black text-background transition duration-200 hover:bg-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onRecreate(item);
            }}
          >
            <RefreshCw className="size-3.5" />
            {t('recreate')}
          </button>
        </div>
      ) : null}

      {/* 底部：作者（左） + 浏览量/点赞（右）。收藏只在详情弹窗里，卡片上不放 —— 与 image 一致 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex translate-y-2 items-end justify-between gap-2 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <span className="growth-inset-ring inline-flex h-7 min-w-0 items-center gap-2 rounded-full bg-black/25 pl-1 pr-2.5 text-xs font-bold text-foreground backdrop-blur-md">
          <AuthorAvatar name={authorName} avatarUrl={item.author?.avatar} />
          <span className="truncate">{authorName}</span>
        </span>
        <span className="growth-inset-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-black/25 pl-2.5 pr-1 text-xs font-bold text-foreground backdrop-blur-md">
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" />
            {formatMetricCount(item.metrics?.uvCount)}
          </span>
          {onToggleLike ? (
            <button
              type="button"
              aria-label={t('ariaLike')}
              aria-pressed={liked}
              onClick={(event) => {
                event.stopPropagation();
                onToggleLike(item);
              }}
              className="pointer-events-auto inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-full bg-black/45 px-2 transition hover:bg-black/60"
            >
              <Heart className={`size-3.5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
              {formatMetricCount(likeCount)}
            </button>
          ) : null}
        </span>
      </div>
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
  onRecreate,
  onToggleLike,
}: {
  items: GalleryFeedItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  density: TemplateDensity;
  onLoadMore: () => void;
  onOpen?: (item: GalleryFeedItem) => void;
  onRecreate?: (item: GalleryFeedItem) => void;
  onToggleLike?: (item: GalleryFeedItem) => void;
}) {
  const columnCount = useColumnCount(density);
  const gap = DENSITY_GAP[density];
  /**
   * 视频元数据量到的真实比例（key = postId）。
   *
   * 投稿快照里的 aspectRatio 只是「请求的画幅」，厂商实际返回的未必一致；不校正就会
   * 按错误比例给卡片定高，画面被 object-cover 裁掉一截。列高估算也一并用它，
   * 免得整面墙越滚越歪。
   */
  const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({});
  const rememberRatio = useCallback((postId: string, ratio: number) => {
    setMeasuredRatios((prev) => (prev[postId] === ratio ? prev : { ...prev, [postId]: ratio }));
  }, []);
  const columns = useMemo(
    () => distributeToColumns(items, columnCount, measuredRatios),
    [items, columnCount, measuredRatios],
  );

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
            {column.map((item, rowIndex) => (
              <VideoGalleryCard
                key={item.post.id}
                item={item}
                index={columnIndex + rowIndex * columnCount}
                onOpen={onOpen}
                onRecreate={onRecreate}
                onToggleLike={onToggleLike}
                onMeasureRatio={rememberRatio}
              />
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
