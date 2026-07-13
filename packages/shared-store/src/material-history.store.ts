import { create } from 'zustand';
import { materialsApi, type MaterialAsset, type MaterialHistoryItem, type MetricResourceType } from '@autix/sdk';

export type { MaterialHistoryItem, MetricResourceType } from '@autix/sdk';

function historyKey(resourceType: MetricResourceType, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

export { historyKey as materialHistoryKey };

interface MaterialHistoryState {
  items: MaterialHistoryItem[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  /** 本次会话内已成功"保存到素材库"的 (resourceType,resourceId) 集合——用于禁用重复保存按钮。 */
  savedKeys: Set<string>;
  savingKeys: Set<string>;
  /**
   * Plan C Task 11：去重后的浏览历史（GET /materials/history），非"素材库内已保存的历史素材"
   * （那是 materialsApi.list({ librarySource: 'HISTORY' })，走 material.store.loadMaterials）。
   * reset=true 从头拉取；false 追加下一页。
   */
  loadHistory: (opts?: { reset?: boolean }) => Promise<void>;
  /** 从浏览历史保存素材——反伪造由后端校验（未浏览过该资源会 400）。成功后标记 savedKeys。 */
  saveFromHistory: (resourceType: MetricResourceType, resourceId: string) => Promise<MaterialAsset>;
}

export const useMaterialHistoryStore = create<MaterialHistoryState>((set, get) => ({
  items: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  savedKeys: new Set(),
  savingKeys: new Set(),

  loadHistory: async (opts) => {
    const reset = opts?.reset ?? true;
    const cursor = reset ? undefined : (get().nextCursor ?? undefined);
    if (reset) set({ loading: true });
    else set({ loadingMore: true });
    try {
      const res = await materialsApi.history({ cursor, take: 30 });
      set((state) => ({
        items: reset ? res.data.items : [...state.items, ...res.data.items],
        nextCursor: res.data.nextCursor,
      }));
    } finally {
      set({ loading: false, loadingMore: false });
    }
  },

  saveFromHistory: async (resourceType, resourceId) => {
    const key = historyKey(resourceType, resourceId);
    set((state) => ({ savingKeys: new Set(state.savingKeys).add(key) }));
    try {
      const res = await materialsApi.saveFromHistory(resourceType, resourceId);
      set((state) => ({ savedKeys: new Set(state.savedKeys).add(key) }));
      return res.data;
    } finally {
      set((state) => {
        const next = new Set(state.savingKeys);
        next.delete(key);
        return { savingKeys: next };
      });
    }
  },
}));
