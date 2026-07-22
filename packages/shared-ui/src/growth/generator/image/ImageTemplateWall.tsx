'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Eye, Heart, Image as ImageIcon, ImagePlus, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ImageTemplate } from '@autix/shared-store';
import { MediaThumb } from '../../MediaBlocks';
import type { PublicGrowthMediaItem } from '../../types';
import { imageTemplateCover, type TemplateDensity } from '../generator-studio-helpers';
import { formatMetricCount } from '../metric-format';
import { AuthorAvatar } from '../../AuthorAvatar';
import { CdnImage } from '../../../image/CdnImage';

/**
 * 每档密度的列数：[最小视口宽度, 列数] 降序，与此前 CSS columns 的断点逐档对齐
 * （Tailwind sm=640 / md=768 / lg=1024 / xl=1280 / 2xl=1536）。
 *
 * 布局从 CSS `columns` 换成了 JS 分列：多列布局会在每次追加内容时重新均衡所有列，
 * 触底加载下就是"每翻一页整面墙跳一次位"。分列后新卡只往列底 push，已有卡片不动。
 */
const TEMPLATE_DENSITY_COLUMNS: Record<TemplateDensity, Array<[number, number]>> = {
  xrelaxed: [[1536, 3], [1024, 2], [0, 1]],
  relaxed: [[1536, 4], [1024, 3], [640, 2], [0, 1]],
  normal: [[1280, 5], [768, 4], [0, 2]],
  dense: [[1280, 6], [768, 5], [0, 2]],
  xdense: [[1280, 8], [768, 6], [0, 3]],
};
const TEMPLATE_DENSITY_GAP: Record<TemplateDensity, string> = {
  xrelaxed: 'gap-3',
  relaxed: 'gap-3',
  normal: 'gap-2',
  dense: 'gap-1.5',
  xdense: 'gap-1.5',
};
// 紧凑铺排（/ai/image 广场墙）：间距压到 1px、卡片无圆角
const TIGHT_GAP = 'gap-px';
/** 骨架卡高度：按列轮换几种比例，撑出瀑布流那种参差感（不用随机数，避免 SSR 水合不一致） */
const SKELETON_ASPECTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]', 'aspect-[2/3]'];
/** 比例未知时的估高：广场以竖图居多，按 4:5 估，别让某一列被系统性拉长 */
const FALLBACK_ASPECT_RATIO = 4 / 5;

function useColumnCount(density: TemplateDensity) {
  const breakpoints = TEMPLATE_DENSITY_COLUMNS[density];
  // 0 = SSR/首帧，落到最窄档；挂载后立刻按真实视口纠正
  const [viewport, setViewport] = useState(0);
  useEffect(() => {
    const sync = () => setViewport(window.innerWidth);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  return breakpoints.find(([minWidth]) => viewport >= minWidth)?.[1] ?? 1;
}

/**
 * 追加式分列：每张卡落到「当前最矮的列」。
 *
 * 贪心对同一段前缀是确定性的——追加新卡不会改变既有卡的落位，所以每次 render 从头
 * 重算即可，不必缓存分列结果，也就没有"已看过的卡片翻页后跳列"的问题。
 * 各列等宽，故列高只需按 height/width 累加相对值，无需测 DOM。
 */
function distributeToColumns(
  templates: ImageTemplate[],
  columnCount: number,
  aspectRatios?: Record<string, number>,
) {
  const columns: Array<Array<{ template: ImageTemplate; index: number }>> = Array.from(
    { length: columnCount },
    () => [],
  );
  const heights = new Array<number>(columnCount).fill(0);
  templates.forEach((template, index) => {
    let target = 0;
    for (let i = 1; i < columnCount; i += 1) {
      if (heights[i]! < heights[target]!) target = i;
    }
    columns[target]!.push({ template, index });
    const ratio = aspectRatios?.[template.id];
    heights[target]! += 1 / (ratio && ratio > 0 ? ratio : FALLBACK_ASPECT_RATIO);
  });
  return columns;
}

/** 广场卡片的互动态。收藏只有布尔态、没有计数——接口只回 { favorited }，没有可校准的 favoriteCount。 */
export interface GalleryCardInteraction {
  liked: boolean;
  favorited: boolean;
  likeCount: number;
}

function repeatedItems(items: PublicGrowthMediaItem[], count: number) {
  if (!items.length) return [];
  return Array.from({ length: count }, (_, index) => items[index % items.length]!);
}

export function ImageHeroCollage({ items }: { items: PublicGrowthMediaItem[] }) {
  const collage = repeatedItems(items, 4);
  return (
    <div className="relative mx-auto mb-5 h-48 w-full max-w-[650px] md:h-52">
      <div className="absolute inset-x-[14%] top-12 h-28 rounded-full bg-info/10 blur-3xl" />
      {collage.map((item, index) => (
        <a
          key={`${item.id}-${index}`}
          href={item.href}
          className={`growth-generator-card growth-hero-card-glow absolute top-6 block overflow-hidden rounded-md border-[5px] border-input bg-background transition duration-500 hover:z-10 hover:scale-105 ${index === 0
            ? 'left-[2%] h-[7.5rem] w-[29%] -rotate-8'
            : index === 1
              ? 'left-[27%] h-36 w-[27%] rotate-3'
              : index === 2
                ? 'left-[51%] h-36 w-[22%] rounded-full'
                : 'right-[2%] h-[7.5rem] w-[29%] -rotate-3'
            }`}
          style={{ animationDelay: `${index * 160}ms` }}
          aria-label={item.title}
        >
          <MediaThumb item={item} eager={index < 2} autoPlay={index === 0} />
        </a>
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  index,
  animated,
  tight,
  interactions,
  onSelectTemplate,
  onUseTemplate,
  onToggleLike,
  onUseAsReference,
}: {
  template: ImageTemplate;
  /** 全局下标（非列内下标）：决定入场动画的错峰延迟与首屏图片的 eager 加载 */
  index: number;
  animated: boolean;
  tight: boolean;
  interactions?: Record<string, GalleryCardInteraction>;
  onSelectTemplate: (template: ImageTemplate) => void;
  onUseTemplate: (template: ImageTemplate) => void;
  onToggleLike?: (postId: string) => void;
  /** 引用为参考图（悬浮态按钮）。不传即不渲染该按钮。 */
  onUseAsReference?: (template: ImageTemplate) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const cover = imageTemplateCover(template);
  const handleUseTemplate = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onUseTemplate(template);
  };

  return (
          <article
            className={`group relative block w-full overflow-hidden bg-secondary text-left transition duration-300 hover:brightness-110 ${animated ? 'growth-generator-masonry' : ''} ${tight ? 'rounded-none' : 'rounded-md hover:scale-[1.01]'}`}
            style={animated ? { animationDelay: `${(index % 9) * 80}ms` } : undefined}
          >
            {cover ? (
              <CdnImage
                src={cover}
                alt={template.title}
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
              aria-label={template.title}
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => onSelectTemplate(template)}
            >
              <span className="sr-only">{template.title}</span>
            </button>
            <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-background/70 via-background/10 to-background/70 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />
            {/* 右上角：重新生成 + 引用为参考图 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex translate-y-[-6px] items-start justify-end gap-1.5 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {onUseAsReference ? (
                <button
                  type="button"
                  className="growth-btn-drop-shadow pointer-events-auto inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-background/55 px-2.5 text-xs font-bold text-foreground backdrop-blur-md transition duration-200 hover:bg-background/85"
                  onClick={(event) => {
                    event.stopPropagation();
                    onUseAsReference(template);
                  }}
                >
                  <ImagePlus className="size-3.5" />
                  {t('reference')}
                </button>
              ) : null}
              <button
                type="button"
                className="growth-btn-drop-shadow pointer-events-auto inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-growth-accent px-2.5 text-xs font-black text-background transition duration-200 hover:bg-foreground"
                onClick={handleUseTemplate}
              >
                <RefreshCw className="size-3.5" />
                {t('recreate')}
              </button>
            </div>
            {/* 底部：作者（左） + 访问量/点赞（右）。收藏只在详情弹窗里，卡片上不放 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex translate-y-2 items-end justify-between gap-2 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {/* 作者与右侧指标胶囊统一 h-7 / text-xs：靠固定行高对齐，不靠 padding 凑 */}
              <span className="growth-inset-ring inline-flex h-7 min-w-0 items-center gap-2 rounded-full bg-black/25 pl-1 pr-2.5 text-xs font-bold text-foreground backdrop-blur-md">
                <AuthorAvatar
                  name={template.authorName || t('unknownAuthor')}
                  avatarUrl={template.authorUrl}
                />
                <span className="truncate">{template.authorName || t('unknownAuthor')}</span>
              </span>
              {/* 访问量 + 点赞共用一条胶囊底：访问量只读；点赞是嵌在里面的一颗独立小胶囊，
                  自带更深的底色 —— 靠「另一颗药丸」而不是分割线来表达「只有这块能点」 */}
              <span className="growth-inset-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-black/25 pl-2.5 pr-1 text-xs font-bold text-foreground backdrop-blur-md">
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3.5" />
                  {formatMetricCount(template.viewCount)}
                </span>
                {onToggleLike ? (
                  <button
                    type="button"
                    aria-label={t('ariaLike')}
                    aria-pressed={interactions?.[template.id]?.liked ?? false}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleLike(template.id);
                    }}
                    className="pointer-events-auto inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-full bg-black/45 px-2 transition hover:bg-black/60"
                  >
                    {/* 点赞是红心（与详情弹窗一致） */}
                    <Heart
                      className={`size-3.5 ${
                        interactions?.[template.id]?.liked ? 'fill-red-500 text-red-500' : ''
                      }`}
                    />
                    {formatMetricCount(
                      interactions?.[template.id]?.likeCount ?? template.likeCount,
                    )}
                  </button>
                ) : null}
              </span>
            </div>
          </article>
  );
}

/**
 * 骨架卡：直接接在各列列底，形状随列轮换，跟真实卡片同一套间距/圆角——
 * 加载态是瀑布流长出来的一截，不是墙底下压的一块方阵。
 */
function ColumnSkeletons({
  count,
  columnIndex,
  tight,
}: {
  count: number;
  columnIndex: number;
  tight: boolean;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={`skeleton-${i}`}
          // growth-skeleton：一条高光斜扫过卡片。深色底上单靠 animate-pulse（只改透明度）
          // 几乎看不出来，得有东西在动才像「在加载」。按列错峰，避免整面墙高光连成一条直线。
          className={`growth-skeleton w-full growth-skeleton-delay-${(columnIndex + i) % 4} ${
            SKELETON_ASPECTS[(columnIndex + i) % SKELETON_ASPECTS.length]
          } ${tight ? 'rounded-none' : 'rounded-md'}`}
        />
      ))}
    </>
  );
}

export function ImageTemplateGrid({
  templates,
  density,
  onSelectTemplate,
  onUseTemplate,
  limit,
  animatedCount,
  aspectRatios,
  skeletonPerColumn = 0,
  tight = false,
  interactions,
  onToggleLike,
  onUseAsReference,
}: {
  templates: ImageTemplate[];
  density: TemplateDensity;
  onSelectTemplate: (template: ImageTemplate) => void;
  onUseTemplate: (template: ImageTemplate) => void;
  /** 只渲染前 N 条（首页预览用）；不传即全量渲染 */
  limit?: number;
  /**
   * 只有下标 < animatedCount 的卡片播入场滑动动画；不传则全部播。
   * 触底加载的场景传首屏条数——续页的卡片直接落位，加载感由列底骨架屏承担，
   * 否则每翻一页都有一批卡片从下方滑入，像页面自己在动。
   */
  animatedCount?: number;
  /** 卡片宽高比（width/height），按 id 索引，用于估列高做分列；缺失按竖图兜底 */
  aspectRatios?: Record<string, number>;
  /** 每列列底垫几张骨架卡（续页加载中） */
  skeletonPerColumn?: number;
  /** 紧凑铺排：1px 间距 + 无圆角（用于 /ai/image 广场墙） */
  tight?: boolean;
  interactions?: Record<string, GalleryCardInteraction>;
  onToggleLike?: (postId: string) => void;
  /** 引用为参考图（悬浮态按钮）。不传即不渲染该按钮。 */
  onUseAsReference?: (template: ImageTemplate) => void;
}) {
  const columnCount = useColumnCount(density);
  const visible = useMemo(
    () => (limit === undefined ? templates : templates.slice(0, limit)),
    [templates, limit],
  );
  const columns = useMemo(
    () => distributeToColumns(visible, columnCount, aspectRatios),
    [visible, columnCount, aspectRatios],
  );
  const gap = tight ? TIGHT_GAP : TEMPLATE_DENSITY_GAP[density];

  return (
    <div className={`flex items-start opacity-95 ${gap}`}>
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className={`flex min-w-0 flex-1 flex-col ${gap}`}>
          {column.map(({ template, index }) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={index}
              animated={animatedCount === undefined || index < animatedCount}
              tight={tight}
              interactions={interactions}
              onSelectTemplate={onSelectTemplate}
              onUseTemplate={onUseTemplate}
              onToggleLike={onToggleLike}
              onUseAsReference={onUseAsReference}
            />
          ))}
          {skeletonPerColumn > 0 ? (
            <ColumnSkeletons count={skeletonPerColumn} columnIndex={columnIndex} tight={tight} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** 首屏骨架墙：按当前密度的列数铺满一屏，形状与真实瀑布流一致 */
function TemplateWallSkeleton({ density, rows }: { density: TemplateDensity; rows: number }) {
  const columnCount = useColumnCount(density);
  return (
    <div className={`pointer-events-none flex items-start ${TIGHT_GAP}`}>
      {Array.from({ length: columnCount }, (_, columnIndex) => (
        <div key={columnIndex} className={`flex min-w-0 flex-1 flex-col ${TIGHT_GAP}`}>
          <ColumnSkeletons count={rows} columnIndex={columnIndex} tight />
        </div>
      ))}
    </div>
  );
}

export function PublicImageTemplateWall({
  templates,
  loading,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  animatedCount,
  aspectRatios,
  density,
  onSelectTemplate,
  onUseTemplate,
  interactions,
  onToggleLike,
  onUseAsReference,
}: {
  templates: ImageTemplate[];
  loading: boolean;
  /** 续页请求进行中：各列列底垫骨架卡 */
  loadingMore?: boolean;
  /** 还有下一页：为 false 时不再观察哨兵，滚到底就是到底 */
  hasMore?: boolean;
  onLoadMore?: () => void;
  animatedCount?: number;
  aspectRatios?: Record<string, number>;
  density: TemplateDensity;
  onSelectTemplate: (template: ImageTemplate) => void;
  onUseTemplate: (template: ImageTemplate) => void;
  interactions?: Record<string, GalleryCardInteraction>;
  onToggleLike?: (postId: string) => void;
  /** 引用为参考图（悬浮态按钮）。不传即不渲染该按钮。 */
  onUseAsReference?: (template: ImageTemplate) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // onLoadMore 每次 render 都是新引用；存进 ref 让 observer 只按 hasMore/loadingMore 重建，
  // 不会因为父组件重渲染就断连一次。
  const loadMoreRef = useRef(onLoadMore);
  loadMoreRef.current = onLoadMore;
  const scrollFrameClass =
    'pointer-events-auto absolute inset-x-0 bottom-0 top-0 overflow-y-auto overscroll-contain pb-[370px] pt-14 [scrollbar-gutter:stable]';

  const canLoadMore = hasMore && !loading && !loadingMore && Boolean(onLoadMore);

  useEffect(() => {
    if (!canLoadMore) return;
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current?.();
      },
      // 提前一屏触发：等真滚到底再拉，用户会先看到一片空白
      { root, rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore]);

  if (loading) {
    return (
      <div className={scrollFrameClass}>
        <TemplateWallSkeleton density={density} rows={4} />
      </div>
    );
  }

  // 走到这里说明加载已经结束（上面先判的 loading），才允许说「没有作品」
  if (templates.length === 0) {
    return (
      <div className={scrollFrameClass}>
        <div className="grid min-h-[60vh] place-items-center px-6 text-center">
          <div>
            <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-border bg-secondary/60 text-foreground/40">
              <ImageIcon className="size-7" />
            </div>
            <h2 className="mt-5 text-lg font-black">{t('templatesEmpty')}</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={scrollFrameClass}>
      <ImageTemplateGrid
        templates={templates}
        density={density}
        animatedCount={animatedCount}
        aspectRatios={aspectRatios}
        skeletonPerColumn={loadingMore ? 2 : 0}
        onSelectTemplate={onSelectTemplate}
        onUseTemplate={onUseTemplate}
        interactions={interactions}
        onToggleLike={onToggleLike}
        onUseAsReference={onUseAsReference}
        tight
      />
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
    </div>
  );
}
