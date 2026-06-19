import { create } from 'zustand';
import {
  marketplaceApi,
  type MarketplaceHome,
  type AnyResource,
  type PlatformStats,
} from '@autix/sdk';

interface MarketplaceState {
  home: MarketplaceHome | null;
  loading: boolean;
  error: string | null;
  hotRanking: AnyResource[];
  editorPicks: AnyResource[];
  stats: PlatformStats | null;

  fetchHome: () => Promise<void>;
}

function errorMessage(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  if (typeof data === 'string') return data;
  if (e instanceof Error && e.message) return e.message;
  return '加载失败,请稍后重试';
}

export const useMarketplaceStore = create<MarketplaceState>((set) => ({
  home: null,
  loading: false,
  error: null,
  hotRanking: [],
  editorPicks: [],
  stats: null,

  fetchHome: async () => {
    set({ loading: true, error: null });
    try {
      const res = await marketplaceApi.home();
      const home = res.data as MarketplaceHome;
      set({
        home,
        hotRanking: home.hotRanking,
        editorPicks: home.editorPicks,
        stats: home.stats,
      });
    } catch (e) {
      set({ error: errorMessage(e) });
    } finally {
      set({ loading: false });
    }
  },
}));
