'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Eye, Heart, ImageIcon } from 'lucide-react';
import {
  galleryActions,
  publicGalleryActions,
  useAuthStore,
  useUiStore,
  type GalleryFeedItem,
} from '@autix/shared-store';
import { HomeGallerySkeleton } from './HomeGallerySkeleton';
import { Link, useRouter } from '../../navigation';
import { ImpressionSentinel } from '../ImpressionSentinel';
import { GalleryDetailDialog, type GalleryInteraction } from '../detail/GalleryDetailDialog';
import { useGalleryPostModal } from '../detail/useGalleryPostModal';
import { AuthorAvatar } from '../AuthorAvatar';
import { buildGeneratorWorkbenchHref } from '../generator-workbench-href';

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
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  /** 详情：本地弹窗（数据来自 feed，瞬开），只把地址栏改成 /gallery/<id>；刷新才走真实路由。 */
  const galleryModal = useGalleryPostModal();
  /**
   * 互动态按 postId 存一张表 —— 卡片上的点赞和弹窗里的点赞是同一份状态，
   * 在哪点都会同步到另一处（只存单条的话，关掉弹窗回到卡片会看到旧数字）。
   */
  const [interactions, setInteractions] = useState<Record<string, GalleryInteraction>>({});

  const interactionOf = (item: GalleryFeedItem): GalleryInteraction =>
    interactions[item.post.id] ?? {
      liked: item.liked ?? false,
      favorited: item.favorited ?? false,
      likeCount: item.metrics.likeCount,
    };

  /** 点赞/收藏：后端 like/unlike、favorite/unfavorite 是幂等的两个接口，按当前态定方向。 */
  const toggleLike = (postId: string) => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: viewAllHref });
      return;
    }
    const item = items.find((entry) => entry.post.id === postId);
    if (!item) return;
    const current = interactionOf(item);
    const liking = !current.liked;
    setInteractions((prev) => ({
      ...prev,
      [postId]: {
        ...current,
        liked: liking,
        likeCount: Math.max(0, current.likeCount + (liking ? 1 : -1)),
      },
    }));
    const request = liking ? galleryActions.like(postId) : galleryActions.unlike(postId);
    void request
      .then((metrics) =>
        setInteractions((prev) => ({
          ...prev,
          [postId]: { ...prev[postId]!, likeCount: metrics.likeCount },
        })),
      )
      .catch(() => setInteractions((prev) => ({ ...prev, [postId]: current })));
  };

  const toggleFavorite = (postId: string) => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: viewAllHref });
      return;
    }
    const item = items.find((entry) => entry.post.id === postId);
    if (!item) return;
    const current = interactionOf(item);
    const favoriting = !current.favorited;
    setInteractions((prev) => ({ ...prev, [postId]: { ...current, favorited: favoriting } }));
    const request = favoriting
      ? galleryActions.favorite(postId)
      : galleryActions.unfavorite(postId);
    void request.catch(() => setInteractions((prev) => ({ ...prev, [postId]: current })));
  };

  /** 首页没有输入框，Recreate 跳到生成器预填（/ai/image?prompt=...）。 */
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

  useEffect(() => {
    let cancelled = false;
    const kind = source === 'video' ? 'VIDEO' : 'IMAGE';
    publicGalleryActions
      .listFeed({ kind, limit: 24 })
      .then((feed) => {
        if (!cancelled) setItems(feed.items);
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
                onSelect={galleryModal.open}
                interactionOf={interactionOf}
                onToggleLike={toggleLike}
              />
            </div>

            {/* 底部渐隐 + View all 按钮（半透明） */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-64 items-end justify-center bg-gradient-to-t from-background via-background/85 to-transparent pb-4">
              <Link
                href={viewAllHref}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-growth-accent/35 bg-growth-accent/20 px-5 py-2.5 text-sm font-bold text-growth-accent backdrop-blur-md transition hover:bg-growth-accent/30"
              >
                {t('viewAllOf', { title })}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
        )}
      </div>


      {/* 广场作品详情：与生成器共用同一个弹窗组件 */}
      <GalleryDetailDialog
        item={galleryModal.item}
        onClose={galleryModal.close}
        interaction={galleryModal.item ? interactionOf(galleryModal.item) : undefined}
        onToggleLike={toggleLike}
        onToggleFavorite={toggleFavorite}
        onRecreate={recreate}
      />
    </section>
  );
}

function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/** "16:9" → 1.777…；解析不出返回 undefined，由调用方兜底。 */
function parsePostRatio(label?: string | null): number | undefined {
  const match = label?.match(/(\d+)\s*[x:×]\s*(\d+)/i);
  if (!match) return undefined;
  const w = Number(match[1]);
  const h = Number(match[2]);
  return w > 0 && h > 0 ? w / h : undefined;
}

/**
 * 广场作品瀑布流卡片。悬浮态与生成器广场墙（ImageTemplateWall）**保持一致**：
 * 底部一行 = 作者胶囊（左） + 访问量/点赞合并胶囊（右）。
 *
 * 唯一的差别是没有右上角那两个按钮（Recreate / 参考图）—— 首页没有生成器输入框，
 * 那两个动作在这里无处可去。
 */
function HomeGalleryGrid({
  items,
  unknownAuthor,
  onSelect,
  interactionOf,
  onToggleLike,
}: {
  items: GalleryFeedItem[];
  unknownAuthor: string;
  onSelect: (item: GalleryFeedItem) => void;
  interactionOf: (item: GalleryFeedItem) => GalleryInteraction;
  onToggleLike: (postId: string) => void;
}) {
  return (
    <div className="columns-1 gap-3 opacity-95 sm:columns-2 lg:columns-3 2xl:columns-4">
      {items.map((item, index) => (
        <HomeGalleryCard
          key={item.post.id}
          item={item}
          index={index}
          unknownAuthor={unknownAuthor}
          onSelect={onSelect}
          interaction={interactionOf(item)}
          onToggleLike={onToggleLike}
        />
      ))}
    </div>
  );
}

/**
 * 单张卡片。抽成组件而不是留在 map 里，是因为视频要用 state 存「量到的真实比例」——
 * hooks 不能写在循环体内。
 */
function HomeGalleryCard({
  item,
  index,
  unknownAuthor,
  onSelect,
  interaction,
  onToggleLike,
}: {
  item: GalleryFeedItem;
  index: number;
  unknownAuthor: string;
  onSelect: (item: GalleryFeedItem) => void;
  interaction: GalleryInteraction;
  onToggleLike: (postId: string) => void;
}) {
  const { post, metrics } = item;
  const cover = post.coverImage ?? post.mediaUrls[0] ?? null;
  const author = item.author?.nickname || unknownAuthor;
  const isVideo = post.kind === 'VIDEO';
  /** 投稿快照里的画幅只是「请求值」，真实比例以视频元数据为准（见下方 onLoadedMetadata）。 */
  const [videoRatio, setVideoRatio] = useState<number>(() => parsePostRatio(post.aspectRatio) ?? 9 / 16);

  return (
          <article
            className="growth-generator-masonry group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-md bg-secondary text-left transition duration-300 hover:scale-[1.01] hover:brightness-110"
            style={{ animationDelay: `${(index % 9) * 80}ms` }}
          >
            {isVideo && post.mediaUrls[0] ? (
              /*
               * 视频必须渲染 <video>：此前这里对所有 kind 一律 <img src={cover}>，而
               * cover 回退到 mediaUrls[0] 就是个 .mp4 —— 浏览器当图片解不出来，
               * 首页视频画廊整片空白。
               *
               * 比例取真实元数据（onLoadedMetadata），拿不到前用投稿快照兜底：
               * 投稿里的 aspectRatio 只是请求的画幅，与厂商实际返回的未必一致。
               */
              <video
                src={post.mediaUrls[0]}
                poster={post.coverImage ?? undefined}
                muted
                loop
                playsInline
                preload="metadata"
                className="block w-full object-cover"
                style={{ aspectRatio: String(videoRatio) }}
                onLoadedMetadata={(event) => {
                  const { videoWidth, videoHeight } = event.currentTarget;
                  if (videoWidth && videoHeight) setVideoRatio(videoWidth / videoHeight);
                }}
                // 悬浮即播、移开暂停归零 —— 首页不放播放按钮，卡面保持干净
                onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)}
                onMouseLeave={(event) => {
                  event.currentTarget.pause();
                  event.currentTarget.currentTime = 0;
                }}
              />
            ) : cover ? (
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
              onClick={() => onSelect(item)}
            />

            <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-background/70 via-background/10 to-background/70 opacity-0 transition duration-200 group-hover:opacity-100" />
            {/* 底部：作者（左） + 访问量/点赞（右）。与广场墙同一套胶囊：h-7 / bg-black/25 /
                text-xs；点赞是嵌在里面的深色小药丸，只有它可点 */}
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
                  <Heart
                    className={`size-3.5 ${interaction.liked ? 'fill-red-500 text-red-500' : ''}`}
                  />
                  {formatMetric(interaction.likeCount)}
                </button>
              </span>
            </div>
          </article>
  );
}
