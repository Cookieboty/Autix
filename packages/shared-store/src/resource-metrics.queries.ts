import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dedicatedInteractionActions,
  hasDedicatedInteractionRoute,
  resourceMetricsActions,
  type DedicatedInteractionType,
  type MetricResourceType,
  type ResourceMetrics,
} from './resource-metrics.actions';

/** dedicated 专属端点只回 { liked } / { favorited }，通用端点回完整 ResourceMetrics。 */
type InteractionResult = ResourceMetrics | { liked: boolean } | { favorited: boolean };

export const resourceMetricsQueryKeys = {
  root: () => ['resourceMetrics'] as const,
  detail: (type: MetricResourceType, id: string) =>
    [...resourceMetricsQueryKeys.root(), type, id] as const,
};

export function useResourceMetrics(
  type: MetricResourceType,
  id: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: resourceMetricsQueryKeys.detail(type, id ?? ''),
    queryFn: () => resourceMetricsActions.getMetrics(type, id as string),
    enabled: enabled && Boolean(id),
  });
}

interface OptimisticContext {
  previous?: ResourceMetrics;
}

/**
 * 点赞/收藏/分享互动：对 useResourceMetrics 的缓存做乐观更新，失败时回滚。
 *
 * 后端接口不返回"当前用户是否已点赞/收藏"，因此 liked/favorited 是纯前端本地状态
 * （默认 false，随交互切换），仅用于驱动按钮的乐观 UI，不代表服务端已知状态。
 */
export function useResourceInteractions(type: MetricResourceType, id: string) {
  const queryClient = useQueryClient();
  const queryKey = resourceMetricsQueryKeys.detail(type, id);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);

  // Plan C Task 10：IMAGE_TEMPLATE / VIDEO_TEMPLATE 的 like/favorite 必须走各自受守卫的
  // 专属端点（通用端点已对它们 400）。SKILL / MCP / AGENT 继续走通用 resourceMetricsActions。
  // 专属端点只回 { liked } / { favorited }（非完整指标），故成功后靠乐观增量 + 失效重取
  // metrics（GET 对全类型仍开放）来同步真实计数；share 无专属路由、始终走通用端点。
  const dedicated = hasDedicatedInteractionRoute(type);
  const dedicatedType = type as DedicatedInteractionType;

  const applyDelta = useCallback(
    (patch: Partial<ResourceMetrics>) => {
      const previous = queryClient.getQueryData<ResourceMetrics>(queryKey);
      if (previous) {
        queryClient.setQueryData<ResourceMetrics>(queryKey, { ...previous, ...patch });
      }
      return previous;
    },
    [queryClient, queryKey],
  );

  // 成功后：专属端点回 boolean 态 → 同步本地 liked/favorited 并失效重取真实指标；
  // 通用端点回完整指标 → 直接写入缓存。
  const finalizeSuccess = useCallback(
    (data: InteractionResult) => {
      if (dedicated) {
        if ('liked' in data) setLiked(data.liked);
        if ('favorited' in data) setFavorited(data.favorited);
        void queryClient.invalidateQueries({ queryKey });
        return;
      }
      queryClient.setQueryData(queryKey, data as ResourceMetrics);
    },
    [dedicated, queryClient, queryKey],
  );

  const likeMutation = useMutation<InteractionResult, unknown, void, OptimisticContext>({
    // 专属 like 端点为 POST 切换（无 DELETE 反向）——本 mutation 仅在 !liked 时触发（见 toggleLike），
    // 故 POST 恒切换为已点赞。
    mutationFn: () =>
      dedicated
        ? dedicatedInteractionActions.toggleLike(dedicatedType, id)
        : resourceMetricsActions.like(type, id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = applyDelta({
        likeCount: (queryClient.getQueryData<ResourceMetrics>(queryKey)?.likeCount ?? 0) + 1,
      });
      setLiked(true);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setLiked(false);
    },
    onSuccess: finalizeSuccess,
  });

  const unlikeMutation = useMutation<InteractionResult, unknown, void, OptimisticContext>({
    // 专属端点无 DELETE unlike——再次 POST 同一 like 端点即切换为未点赞（本 mutation 仅在 liked 时触发）。
    mutationFn: () =>
      dedicated
        ? dedicatedInteractionActions.toggleLike(dedicatedType, id)
        : resourceMetricsActions.unlike(type, id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = applyDelta({
        likeCount: Math.max(
          (queryClient.getQueryData<ResourceMetrics>(queryKey)?.likeCount ?? 0) - 1,
          0,
        ),
      });
      setLiked(false);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setLiked(true);
    },
    onSuccess: finalizeSuccess,
  });

  const favoriteMutation = useMutation<InteractionResult, unknown, void, OptimisticContext>({
    mutationFn: () =>
      dedicated
        ? dedicatedInteractionActions.favorite(dedicatedType, id)
        : resourceMetricsActions.favorite(type, id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = applyDelta({
        favoriteCount:
          (queryClient.getQueryData<ResourceMetrics>(queryKey)?.favoriteCount ?? 0) + 1,
      });
      setFavorited(true);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setFavorited(false);
    },
    onSuccess: finalizeSuccess,
  });

  const unfavoriteMutation = useMutation<InteractionResult, unknown, void, OptimisticContext>({
    mutationFn: () =>
      dedicated
        ? dedicatedInteractionActions.unfavorite(dedicatedType, id)
        : resourceMetricsActions.unfavorite(type, id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = applyDelta({
        favoriteCount: Math.max(
          (queryClient.getQueryData<ResourceMetrics>(queryKey)?.favoriteCount ?? 0) - 1,
          0,
        ),
      });
      setFavorited(false);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setFavorited(true);
    },
    onSuccess: finalizeSuccess,
  });

  const shareMutation = useMutation<ResourceMetrics, unknown, void, OptimisticContext>({
    mutationFn: () => resourceMetricsActions.share(type, id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = applyDelta({
        shareCount: (queryClient.getQueryData<ResourceMetrics>(queryKey)?.shareCount ?? 0) + 1,
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const toggleLike = useCallback(() => {
    if (liked) unlikeMutation.mutate();
    else likeMutation.mutate();
  }, [liked, likeMutation, unlikeMutation]);

  const toggleFavorite = useCallback(() => {
    if (favorited) unfavoriteMutation.mutate();
    else favoriteMutation.mutate();
  }, [favorited, favoriteMutation, unfavoriteMutation]);

  const share = useCallback(() => {
    shareMutation.mutate();
  }, [shareMutation]);

  return {
    liked,
    favorited,
    toggleLike,
    toggleFavorite,
    share,
    isLiking: likeMutation.isPending || unlikeMutation.isPending,
    isFavoriting: favoriteMutation.isPending || unfavoriteMutation.isPending,
    isSharing: shareMutation.isPending,
  };
}
