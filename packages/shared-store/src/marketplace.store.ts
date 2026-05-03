import { create } from 'zustand';
import {
  marketplaceApi,
  type MarketplaceHome,
  type AnyResource,
  type PlatformStats,
} from '@autix/shared-lib';

interface MarketplaceState {
  home: MarketplaceHome | null;
  loading: boolean;
  hotRanking: AnyResource[];
  editorPicks: AnyResource[];
  stats: PlatformStats | null;

  fetchHome: () => Promise<void>;
}

export const useMarketplaceStore = create<MarketplaceState>((set) => ({
  home: null,
  loading: false,
  hotRanking: [],
  editorPicks: [],
  stats: null,

  fetchHome: async () => {
    set({ loading: true });
    try {
      const res = await marketplaceApi.home();
      const home = res.data as MarketplaceHome;
      set({
        home,
        hotRanking: home.hotRanking,
        editorPicks: home.editorPicks,
        stats: home.stats,
      });
    } finally {
      set({ loading: false });
    }
  },
}));
