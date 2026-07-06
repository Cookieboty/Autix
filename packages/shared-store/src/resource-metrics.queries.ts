import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  resourceMetricsActions,
  type ResourceMetrics,
  type ResourceType,
} from './resource-metrics.actions';

export const resourceMetricsQueryKeys = {
  root: () => ['resourceMetrics'] as const,
  detail: (type: ResourceType, id: string) =>
    [...resourceMetricsQueryKeys.root(), type, id] as const,
};

export function useResourceMetrics(
  type: ResourceType,
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
export function useResourceInteractions(type: ResourceType, id: string) {
  const queryClient = useQueryClient();
  const queryKey = resourceMetricsQueryKeys.detail(type, id);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);

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

  const likeMutation = useMutation<ResourceMetrics, unknown, void, OptimisticContext>({
    mutationFn: () => resourceMetricsActions.like(type, id),
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
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const unlikeMutation = useMutation<ResourceMetrics, unknown, void, OptimisticContext>({
    mutationFn: () => resourceMetricsActions.unlike(type, id),
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
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const favoriteMutation = useMutation<ResourceMetrics, unknown, void, OptimisticContext>({
    mutationFn: () => resourceMetricsActions.favorite(type, id),
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
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const unfavoriteMutation = useMutation<ResourceMetrics, unknown, void, OptimisticContext>({
    mutationFn: () => resourceMetricsActions.unfavorite(type, id),
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
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
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
