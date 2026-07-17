import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  galleryActions,
  galleryErrorMessage,
  type GalleryDetailResult,
  type GalleryFeedItem,
} from './gallery.actions';

export const galleryQueryKeys = {
  root: () => ['gallery'] as const,
  detail: (id: string) => [...galleryQueryKeys.root(), 'detail', id] as const,
};

const FEED_PAGE_SIZE = 24;

export function useGalleryDetailQuery(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: galleryQueryKeys.detail(id ?? ''),
    queryFn: () => galleryActions.getDetail(id as string),
    enabled: enabled && Boolean(id),
  });
}

/** 一页 feed 结果的最小形状；gallery feed 与个人页 Generations feed 共用。 */
export interface GalleryFeedPageResult {
  items: GalleryFeedItem[];
  nextCursor: string | null;
}

/**
 * 游标累积翻页 + 卡片方向性点赞/收藏的通用 feed 控制器核心（本仓库列表页统一走"手动 cursor
 * 状态 + 累积 items"，未使用 useInfiniteQuery——与 profileResourcesController 等 controller
 * hook 风格一致）。
 *
 * 参数化两点：
 * - `fetchPage(cursor)`：拉一页（cursor 为 undefined 即第一页）。调用方用闭包注入数据源
 *   （公开广场按 kind、个人页按 username）。
 * - `resetKey`：变化时重置到第一页（kind 切换 / username 切换）。
 *
 * patchItem：卡片上 like/favorite 的方向性本地更新——后端 favorite 现为幂等
 * POST=favorite/DELETE=unfavorite（非切换），调用方必须按当前 liked/favorited 状态
 * 决定调哪个端点，成功后用 patchItem 写回该条目的 liked/favorited + 对应计数，
 * 不做整页重新拉取（避免滚动位置/其它条目状态被打断）。
 */
export function useAccumulatingGalleryFeed(
  fetchPageFn: (cursor: string | undefined) => Promise<GalleryFeedPageResult>,
  resetKey: string,
) {
  const [items, setItems] = useState<GalleryFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  // fetchPageFn 每次 render 都是新闭包（捕获最新 kind/username），存 ref 以免进 fetchPage 依赖数组。
  const fetchPageRef = useRef(fetchPageFn);
  fetchPageRef.current = fetchPageFn;

  const fetchPage = useCallback(async (append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetchPageRef.current(append ? (cursorRef.current ?? undefined) : undefined);
      setItems((prev) => (append ? [...prev, ...result.items] : result.items));
      cursorRef.current = result.nextCursor;
      setHasMore(Boolean(result.nextCursor));
    } catch (err) {
      setError(galleryErrorMessage(err));
      if (!append) setItems([]);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    cursorRef.current = null;
    void fetchPage(false);
    // fetchPage 是稳定引用（无依赖），只需在 resetKey 变化时重新拉第一页。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void fetchPage(true);
  }, [fetchPage, hasMore, loading, loadingMore]);

  const patchItem = useCallback(
    (postId: string, patch: { liked?: boolean; favorited?: boolean; likeDelta?: number; favoriteDelta?: number }) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.post.id !== postId) return item;
          return {
            ...item,
            liked: patch.liked ?? item.liked,
            favorited: patch.favorited ?? item.favorited,
            metrics: {
              ...item.metrics,
              likeCount:
                patch.likeDelta !== undefined
                  ? Math.max(0, item.metrics.likeCount + patch.likeDelta)
                  : item.metrics.likeCount,
              favoriteCount:
                patch.favoriteDelta !== undefined
                  ? Math.max(0, item.metrics.favoriteCount + patch.favoriteDelta)
                  : item.metrics.favoriteCount,
            },
          };
        }),
      );
    },
    [],
  );

  /** 单张卡片的方向性点赞/收藏切换：内部据当前 item 的 liked/favorited 决定调用哪个端点。 */
  const toggleLike = useCallback(
    async (item: GalleryFeedItem) => {
      const nextLiked = !item.liked;
      patchItem(item.post.id, { liked: nextLiked, likeDelta: nextLiked ? 1 : -1 });
      try {
        nextLiked ? await galleryActions.like(item.post.id) : await galleryActions.unlike(item.post.id);
      } catch (err) {
        patchItem(item.post.id, { liked: item.liked, likeDelta: nextLiked ? -1 : 1 });
        throw err;
      }
    },
    [patchItem],
  );

  const toggleFavorite = useCallback(
    async (item: GalleryFeedItem) => {
      const nextFavorited = !item.favorited;
      patchItem(item.post.id, { favorited: nextFavorited, favoriteDelta: nextFavorited ? 1 : -1 });
      try {
        nextFavorited
          ? await galleryActions.favorite(item.post.id)
          : await galleryActions.unfavorite(item.post.id);
      } catch (err) {
        patchItem(item.post.id, { favorited: item.favorited, favoriteDelta: nextFavorited ? -1 : 1 });
        throw err;
      }
    },
    [patchItem],
  );

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    toggleLike,
    toggleFavorite,
    reload: () => fetchPage(false),
  };
}

/**
 * 公开广场 Feed 控制器（首页图片/视频画廊）：按 kind 分流，kind 切换重置到第一页。
 * 只是给通用核心注入「按 kind 拉 gallery feed」的数据源。
 */
export function useGalleryFeedController(kind: 'IMAGE' | 'VIDEO' = 'IMAGE') {
  return useAccumulatingGalleryFeed(
    (cursor) =>
      galleryActions
        .getFeed({ kind, cursor, limit: FEED_PAGE_SIZE })
        .then((r) => ({ items: r.items, nextCursor: r.nextCursor })),
    kind,
  );
}

interface DetailOverlay {
  liked?: boolean;
  favorited?: boolean;
  likeCount?: number;
  favoriteCount?: number;
  downloadCount?: number;
  referenceCount?: number;
}

/**
 * 广场详情控制器：一次 getDetail 聚合 post/author/metrics/viewer，本地叠加 overlay
 * 做点赞/收藏/下载/recreate 的方向性乐观更新（favorite 幂等 POST/DELETE，见上）；
 * unpublish/republish 改变作品状态，成功后整条失效重取（不能本地拼状态机）。
 */
export function useGalleryDetailController(id: string | undefined) {
  const queryClient = useQueryClient();
  const query = useGalleryDetailQuery(id);
  const data = query.data as GalleryDetailResult | undefined;
  const [overlay, setOverlay] = useState<DetailOverlay>({});

  useEffect(() => {
    setOverlay({});
  }, [data?.post.id, data?.post.status]);

  const liked = overlay.liked ?? data?.viewer?.liked ?? false;
  const favorited = overlay.favorited ?? data?.viewer?.favorited ?? false;
  const likeCount = overlay.likeCount ?? data?.metrics.likeCount ?? 0;
  const favoriteCount = overlay.favoriteCount ?? data?.metrics.favoriteCount ?? 0;
  const downloadCount = overlay.downloadCount ?? data?.metrics.downloadCount ?? 0;
  const referenceCount = overlay.referenceCount ?? data?.metrics.referenceCount ?? 0;
  const viewCount = data?.metrics.uvCount ?? 0;

  const invalidate = useCallback(() => {
    if (!id) return Promise.resolve();
    return queryClient.invalidateQueries({ queryKey: galleryQueryKeys.detail(id) });
  }, [id, queryClient]);

  const likeMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('missing gallery post id');
      return liked ? galleryActions.unlike(id) : galleryActions.like(id);
    },
    onMutate: () => {
      const nextLiked = !liked;
      setOverlay((prev) => ({
        ...prev,
        liked: nextLiked,
        likeCount: Math.max(0, likeCount + (nextLiked ? 1 : -1)),
      }));
      return { previousLiked: liked, previousCount: likeCount };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      setOverlay((prev) => ({ ...prev, liked: ctx.previousLiked, likeCount: ctx.previousCount }));
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('missing gallery post id');
      return favorited ? galleryActions.unfavorite(id) : galleryActions.favorite(id);
    },
    onMutate: () => {
      const nextFavorited = !favorited;
      setOverlay((prev) => ({
        ...prev,
        favorited: nextFavorited,
        favoriteCount: Math.max(0, favoriteCount + (nextFavorited ? 1 : -1)),
      }));
      return { previousFavorited: favorited, previousCount: favoriteCount };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      setOverlay((prev) => ({
        ...prev,
        favorited: ctx.previousFavorited,
        favoriteCount: ctx.previousCount,
      }));
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('missing gallery post id');
      return galleryActions.unpublish(id);
    },
    onSuccess: () => invalidate(),
  });

  const republishMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('missing gallery post id');
      return galleryActions.republish(id);
    },
    onSuccess: () => invalidate(),
  });

  const recreateMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('missing gallery post id');
      return galleryActions.recreate(id);
    },
    onSuccess: () => {
      setOverlay((prev) => ({ ...prev, referenceCount: referenceCount + 1 }));
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('missing gallery post id');
      return galleryActions.download(id);
    },
    onSuccess: () => {
      setOverlay((prev) => ({ ...prev, downloadCount: downloadCount + 1 }));
    },
  });

  return {
    query,
    post: data?.post,
    author: data?.author,
    isLoggedInViewer: Boolean(data?.viewer),
    viewCount,
    liked,
    favorited,
    likeCount,
    favoriteCount,
    downloadCount,
    referenceCount,
    toggleLike: () => likeMutation.mutateAsync(),
    toggleFavorite: () => favoriteMutation.mutateAsync(),
    unpublish: () => unpublishMutation.mutateAsync(),
    republish: () => republishMutation.mutateAsync(),
    recreate: () => recreateMutation.mutateAsync(),
    download: () => downloadMutation.mutateAsync(),
    isLiking: likeMutation.isPending,
    isFavoriting: favoriteMutation.isPending,
    isUnpublishing: unpublishMutation.isPending,
    isRepublishing: republishMutation.isPending,
    isRecreating: recreateMutation.isPending,
    isDownloading: downloadMutation.isPending,
  };
}
