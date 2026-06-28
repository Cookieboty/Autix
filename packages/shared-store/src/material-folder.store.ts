import { create } from 'zustand';
import { materialFoldersApi, type MaterialFolderSidebar } from '@autix/sdk';

// Re-export folder contract types so shared-ui consumes them via shared-store
// (shared-ui must not import @autix/sdk directly — layering boundary).
export type { MaterialFolder, MaterialFolderRow, MaterialFolderSidebar } from '@autix/sdk';

export type ActiveFolderKey = 'all' | 'root' | string;

interface MaterialFolderState {
  sidebar: MaterialFolderSidebar | null;
  activeFolderId: ActiveFolderKey;
  loading: boolean;
  loadFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
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
    await materialFoldersApi.create({ name });
    await get().loadFolders();
  },
  renameFolder: async (id, name) => {
    await materialFoldersApi.update(id, { name });
    await get().loadFolders();
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
