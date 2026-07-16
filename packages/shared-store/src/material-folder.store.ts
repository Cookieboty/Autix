import { create } from 'zustand';
import { materialFoldersApi, type MaterialFolderRow, type MaterialFolderSidebar } from '@autix/sdk';

// Re-export folder contract types so shared-ui consumes them via shared-store
// (shared-ui must not import @autix/sdk directly — layering boundary).
export type { MaterialFolder, MaterialFolderRow, MaterialFolderSidebar } from '@autix/sdk';

export type ActiveFolderKey = 'all' | 'root' | string;

interface MaterialFolderState {
  sidebar: MaterialFolderSidebar | null;
  activeFolderId: ActiveFolderKey;
  loading: boolean;
  loadFolders: () => Promise<void>;
  /** 返回新建的文件夹行——调用方常要立刻拿 id 用（如「新建并把素材放进去」）。 */
  createFolder: (name: string) => Promise<MaterialFolderRow>;
  renameFolder: (id: string, name: string) => Promise<void>;
  /** 设置/清除文件夹 emoji 图标（null = 清除）。 */
  setFolderIcon: (id: string, icon: string | null) => Promise<void>;
  reorderFolder: (id: string, sortOrder: number) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  setActiveFolder: (key: ActiveFolderKey) => void;
}

export const useMaterialFolderStore = create<MaterialFolderState>((set, get) => ({
  sidebar: null,
  activeFolderId: 'all',
  loading: false,
  loadFolders: async () => {
    set({ loading: true });
    try {
      const res = await materialFoldersApi.list();
      set({ sidebar: res.data, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },
  createFolder: async (name) => {
    const { data } = await materialFoldersApi.create({ name });
    await get().loadFolders();
    return data;
  },
  renameFolder: async (id, name) => {
    await materialFoldersApi.update(id, { name });
    await get().loadFolders();
  },
  setFolderIcon: async (id, icon) => {
    /**
     * 乐观更新：先就地改本地 sidebar，再发请求。
     *
     * 换个图标是纯展示改动、失败率极低，却要顶部标题和侧栏两处同时变——
     * 等接口回来再 loadFolders() 会有肉眼可见的延迟（一来一回两个请求）。
     * 这里先改本地让两处立刻响应；失败则整体回滚到改之前的快照，
     * 不留「界面显示新图标、库里还是旧的」这种假象。
     *
     * 成功后**不**再 loadFolders()：图标不影响任何计数，重拉一次纯属浪费，
     * 而且会让刚变好的图标再闪一下。
     */
    const patchIcon = (next: string | null) =>
      set((state) =>
        state.sidebar
          ? {
              sidebar: {
                ...state.sidebar,
                folders: state.sidebar.folders.map((folder) =>
                  folder.id === id ? { ...folder, icon: next } : folder,
                ),
              },
            }
          : state,
      );

    const previousIcon = get().sidebar?.folders.find((folder) => folder.id === id)?.icon ?? null;
    patchIcon(icon);
    try {
      await materialFoldersApi.update(id, { icon });
    } catch (error) {
      // 只回滚 icon 这一个字段，**不整份还原 sidebar 快照**：
      // 请求期间可能有新建/改名/删除落地，用旧快照覆盖会把它们一起抹掉。
      patchIcon(previousIcon);
      throw error;
    }
  },
  reorderFolder: async (id, sortOrder) => {
    await materialFoldersApi.update(id, { sortOrder });
    await get().loadFolders();
  },
  deleteFolder: async (id) => {
    await materialFoldersApi.remove(id);
    if (get().activeFolderId === id) set({ activeFolderId: 'all' });
    await get().loadFolders();
  },
  setActiveFolder: (key) => set({ activeFolderId: key }),
}));
