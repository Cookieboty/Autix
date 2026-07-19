'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import {
  materialsApi,
  type MaterialAsset,
  type MaterialCounts,
  type MaterialEntitlement,
} from '@autix/sdk';
import { useAuthStore } from './auth.store';

export type { MaterialCounts } from '@autix/sdk';

const ASSET_PAGE_SIZE = 40;

/**
 * /asset 页面的数据源：素材库的**累积翻页**控制器。
 *
 * 为什么不用 useMaterialStore.loadMaterials：那个 action 每次都整体替换 items
 * （见 material.store.ts），旧 /materials 的分页按钮式 UI 够用，但 /asset 是无限滚动网格
 * ——翻第二页会把第一页顶掉。这里按本仓库列表页的统一风格（手动分页状态 + 累积 items，
 * 不用 useInfiniteQuery）另起一个控制器，与 useGalleryFeedController 同构。
 *
 * 素材库是 offset 分页（page/pageSize/hasMore），不是游标，故用 pageRef 而非 cursorRef。
 */

/** /asset 的分桶：URL 上的一段，决定往素材库带哪组筛选。 */
export type AssetBucket = 'all' | 'favorites' | 'uploads' | 'image' | 'video' | 'audio';

export interface AssetLibraryQuery {
  bucket: AssetBucket;
  /** 文件夹视图：素材库接口的 folderId（'root' = 未归类）。与 bucket 正交。 */
  folderId?: string;
  search?: string;
}

/**
 * bucket → 素材库 list 参数。
 *
 * 收藏的是**别人的作品**，不算用户自己的素材，只在「收藏」分桶里出现 ——
 * 所以除收藏外的每个分桶都要 excludeFavorites，否则 All / Image / Video 里
 * 会混进别人的东西。
 */
function bucketParams(bucket: AssetBucket) {
  switch (bucket) {
    case 'image':
      return { type: 'image' as const, excludeFavorites: true };
    case 'video':
      return { type: 'video' as const, excludeFavorites: true };
    // 音频没有生成链路，这个分桶里全是用户上传的参考音频；仍要 excludeFavorites，
    // 理由同上（收藏的是别人的作品，不该混进类型分桶）。
    case 'audio':
      return { type: 'audio' as const, excludeFavorites: true };
    case 'favorites':
      return { librarySource: 'FAVORITE' as const };
    // 用户主动上传的素材（工具里传的参考图/视频/音频，以及素材库页的上传）。
    // 后端在 POST /materials 里把 librarySource 硬写为 UPLOAD，故只按它筛即可。
    case 'uploads':
      return { librarySource: 'UPLOAD' as const };
    case 'all':
    default:
      return { excludeFavorites: true };
  }
}

/**
 * 导航角标计数的存放处。
 *
 * **必须放 store，不能放组件 state**：切分桶会让 /asset/[bucket] 的页面组件重挂载，
 * 组件内 state 随之归零 —— 表现就是「点一下侧栏，上面几项和 Type 的数字先消失、
 * 再闪回来」。而角标跟当前看的是哪个分桶毫无关系，不该跟着重来。
 * 侧栏的文件夹列表本来就在 store 里，所以它的数字从不闪——这里对齐同一做法。
 */
interface AssetCountsState {
  counts: MaterialCounts | null;
  refresh: () => Promise<void>;
  /** 登出/换用户时清空——store 是模块级的，不清会把上一个用户的数字带给下一个。 */
  reset: () => void;
}

export const useAssetCountsStore = create<AssetCountsState>((set) => ({
  counts: null,
  refresh: async () => {
    try {
      const { data } = await materialsApi.counts();
      set({ counts: data });
    } catch {
      // 角标拿不到不该影响素材本身的浏览，静默失败即可。
    }
  },
  reset: () => set({ counts: null }),
}));

/**
 * 左侧导航角标。与素材列表分开拉：列表随分桶/搜索反复重拉，
 * 而角标要在所有分桶上同时显示，不能只反映当前这一桶。
 * 增删素材后由调用方 refresh() 同步。
 */
export function useAssetCounts() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const canFetch = hydrated && isAuthenticated;
  const counts = useAssetCountsStore((s) => s.counts);
  const refresh = useAssetCountsStore((s) => s.refresh);
  const reset = useAssetCountsStore((s) => s.reset);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 换人（含登出）先清空：store 是模块级的、跨挂载存活，同一个标签页里
    // 上一个用户的角标会原样留给下一个用户——而下面的「只在 null 时首拉」
    // 恰好会认为已有数据、不再请求，于是错误数字会一直挂着。
    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId;
      reset();
    }
    if (!canFetch) return;
    // 只在还没有数据时首拉。切分桶造成的重挂载不该再请求一次——
    // 数字已经在 store 里，直接接着显示。
    if (useAssetCountsStore.getState().counts === null) void refresh();
  }, [canFetch, refresh, reset, userId]);

  return { counts, refresh };
}

export function useAssetLibraryController(query: AssetLibraryQuery) {
  // 未登录绝不能发这个请求：素材库是鉴权接口，401 会被 SDK 的响应拦截器
  // （client-core：clearTokens + navigation.push('/login')）全局劫持成跳转登录页，
  // 于是「未登录访问 /asset 应该看到素材库外壳 + 登录弹窗」会变成直接被弹去 /login。
  // 与 /ai/image 历史一样，等 hydrated 且已登录再拉。
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const canFetch = hydrated && isAuthenticated;

  const [items, setItems] = useState<MaterialAsset[]>([]);
  const [entitlement, setEntitlement] = useState<MaterialEntitlement | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);
  // fetchPage 要保持稳定引用（否则每次 query 变化都重建、useEffect 反复触发），
  // 故把当前 query 放 ref 里读，而不是进依赖数组。
  const queryRef = useRef(query);
  queryRef.current = query;
  /**
   * 请求序号：只有**最后一次**发起的请求可以写回状态。
   *
   * 没有它就会串台：点 Image（慢）→ 立刻点 Video（快，先回）→ Image 的响应后到，
   * 无条件 setItems 把 Video 的结果覆盖成图片；pageRef 也会被过期响应写坏，
   * 接着「加载更多」会去追错分桶的第 2 页。快速打字搜索同理。
   */
  const requestSeqRef = useRef(0);

  const fetchPage = useCallback(async (append: boolean) => {
    const current = queryRef.current;
    const seq = ++requestSeqRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const { data: result } = await materialsApi.list({
        ...bucketParams(current.bucket),
        ...(current.folderId ? { folderId: current.folderId } : {}),
        ...(current.search ? { search: current.search } : {}),
        page: append ? pageRef.current + 1 : 1,
        pageSize: ASSET_PAGE_SIZE,
      });
      // 已被更新的请求取代 → 整份结果丢弃，连 loading 都不要碰（那是新请求的）。
      if (seq !== requestSeqRef.current) return;
      pageRef.current = result.page;
      setItems((prev) => (append ? [...prev, ...result.items] : result.items));
      setEntitlement(result.entitlement);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      if (!append) setItems([]);
    } finally {
      if (seq === requestSeqRef.current) {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    }
  }, []);

  const { bucket, folderId, search } = query;
  useEffect(() => {
    // 未登录时保持 loading=false + 空列表：外层 layout 已经唤起登录弹窗，
    // 这里再摆一个"加载中"会一直转下去。
    if (!canFetch) {
      setItems([]);
      setLoading(!hydrated);
      return;
    }
    pageRef.current = 1;
    void fetchPage(false);
    // fetchPage 无依赖、引用稳定；筛选条件任一变化都回到第一页重拉。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, folderId, search, canFetch, hydrated]);

  const loadMore = useCallback(() => {
    if (!canFetch || loading || loadingMore || !hasMore) return;
    void fetchPage(true);
  }, [canFetch, fetchPage, hasMore, loading, loadingMore]);

  /** 删除后就地摘掉，不整页重拉——避免滚动位置被打断。 */
  const removeItems = useCallback((ids: string[]) => {
    const drop = new Set(ids);
    setItems((prev) => prev.filter((item) => !drop.has(item.id)));
    setTotal((prev) => Math.max(0, prev - ids.length));
  }, []);

  /**
   * 就地更新单条素材（如归类到文件夹后的 folderId）。
   *
   * 与 useGalleryFeedController.patchItem 同一意图：改一条的属性不该整页重拉——
   * 那会把滚动位置和已加载的分页全部打掉，用户只是勾了个文件夹。
   */
  const patchItem = useCallback((id: string, patch: Partial<MaterialAsset>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const refresh = useCallback(() => {
    if (!canFetch) return;
    pageRef.current = 1;
    void fetchPage(false);
  }, [canFetch, fetchPage]);

  return {
    items,
    entitlement,
    total,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    removeItems,
    patchItem,
  };
}
