import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  marketplaceActions,
  type AnyResource,
  type MarketplaceTypeSlug,
  type MarketplaceResourceListSort,
} from './marketplace.actions';

export type ResourceListSort = MarketplaceResourceListSort;

export type ResourceListItem = AnyResource;

export interface ResourceListParams {
  slug: MarketplaceTypeSlug;
  category?: string;
  search?: string;
  sort?: ResourceListSort;
  page?: number;
  pageSize?: number;
}

export const resourceQueryKeys = {
  root: () => ['resource'] as const,
  listsRoot: () => [...resourceQueryKeys.root(), 'list'] as const,
  list: ({
    slug,
    category = '',
    search = '',
    sort = 'newest',
    page = 1,
    pageSize = 20,
  }: ResourceListParams) =>
    [
      ...resourceQueryKeys.listsRoot(),
      slug,
      category,
      search,
      sort,
      page,
      pageSize,
    ] as const,
};

function errorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  if (typeof data === 'string') return data;
  if (error instanceof Error && error.message) return error.message;
  return '加载失败,请稍后重试';
}

export const fetchResourceList = marketplaceActions.listResources;

export function useResourceListQuery(params: ResourceListParams, enabled = true) {
  return useQuery({
    queryKey: resourceQueryKeys.list(params),
    queryFn: () => fetchResourceList(params),
    enabled,
  });
}

export function useResourceListController(
  params: ResourceListParams,
  enabled = true,
) {
  const listQuery = useResourceListQuery(params, enabled);
  const { data, error, isFetching, refetch } = listQuery;

  const fetchList = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? params.page ?? 1,
    pageSize: data?.pageSize ?? params.pageSize ?? 20,
    hasMore: data?.hasMore ?? false,
    loading: isFetching,
    error: error ? errorMessage(error) : null,
    fetchList,
    refetch,
    query: listQuery,
  };
}
