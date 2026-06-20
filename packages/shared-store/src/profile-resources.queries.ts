import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  profileResourcesActions,
  type MeTab,
  type PlatformStats,
  type ProfileResourceItem,
} from './profile-resources.actions';

export interface ProfileResourcesListParams {
  page?: number;
  pageSize?: number;
}

export const profileResourcesQueryKeys = {
  root: () => ['profileResources'] as const,
  listsRoot: () => [...profileResourcesQueryKeys.root(), 'list'] as const,
  list: (
    tab: MeTab,
    params: ProfileResourcesListParams = {},
  ) => {
    const { page, pageSize } = normalizeListParams(params);
    return [...profileResourcesQueryKeys.listsRoot(), tab, page, pageSize] as const;
  },
  platformStats: () =>
    [...profileResourcesQueryKeys.root(), 'platformStats'] as const,
};

function normalizeListParams({
  page = 1,
  pageSize = 20,
}: ProfileResourcesListParams = {}): Required<ProfileResourcesListParams> {
  return { page, pageSize };
}

function errorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  if (typeof data === 'string') return data;
  if (error instanceof Error && error.message) return error.message;
  return '加载失败,请稍后重试';
}

export const fetchProfileResources = profileResourcesActions.listResources;
export const fetchProfilePlatformStats = profileResourcesActions.getPlatformStats;

export function useProfileResourcesQuery(
  tab: MeTab,
  params: ProfileResourcesListParams = {},
  enabled = true,
) {
  const listParams = normalizeListParams(params);
  return useQuery({
    queryKey: profileResourcesQueryKeys.list(tab, listParams),
    queryFn: () => fetchProfileResources(tab, listParams),
    enabled,
  });
}

export function useProfileResourcesController(
  tab: MeTab,
  params: ProfileResourcesListParams = {},
  enabled = true,
) {
  const resourcesQuery = useProfileResourcesQuery(tab, params, enabled);
  const { data, error, isFetching, refetch } = resourcesQuery;

  const fetchResources = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    items: (data ?? []) as ProfileResourceItem[],
    loading: isFetching,
    error: error ? errorMessage(error) : null,
    fetchResources,
    refetch,
    query: resourcesQuery,
  };
}

export function useProfilePlatformStatsQuery(enabled = true) {
  return useQuery({
    queryKey: profileResourcesQueryKeys.platformStats(),
    queryFn: fetchProfilePlatformStats,
    enabled,
  });
}

export function useProfilePlatformStatsController(enabled = true) {
  const statsQuery = useProfilePlatformStatsQuery(enabled);
  const { data, error, isFetching, refetch } = statsQuery;

  const fetchStats = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    stats: (data ?? null) as PlatformStats | null,
    loading: isFetching,
    error: error ? errorMessage(error) : null,
    fetchStats,
    refetch,
    query: statsQuery,
  };
}
