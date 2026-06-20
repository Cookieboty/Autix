import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  marketplaceActions,
  type MarketplaceHome,
} from './marketplace.actions';

export const marketplaceQueryKeys = {
  root: () => ['marketplace'] as const,
  home: () => [...marketplaceQueryKeys.root(), 'home'] as const,
};

function errorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  if (typeof data === 'string') return data;
  if (error instanceof Error && error.message) return error.message;
  return '加载失败,请稍后重试';
}

export function useMarketplaceHomeQuery(enabled = true) {
  return useQuery({
    queryKey: marketplaceQueryKeys.home(),
    queryFn: marketplaceActions.getHome,
    enabled,
  });
}

export function useMarketplaceHomeController(enabled = true) {
  const homeQuery = useMarketplaceHomeQuery(enabled);
  const { data, error, isFetching, refetch } = homeQuery;

  const fetchHome = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const home: MarketplaceHome | null = data ?? null;

  return {
    home,
    loading: isFetching,
    error: error ? errorMessage(error) : null,
    hotRanking: home?.hotRanking ?? [],
    editorPicks: home?.editorPicks ?? [],
    stats: home?.stats ?? null,
    fetchHome,
    refetch,
  };
}
