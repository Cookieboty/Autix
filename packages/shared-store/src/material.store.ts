import { create } from 'zustand';
import {
  materialsApi,
  uploadToPresignedUrl,
  videoProjectApi,
  type MaterialAsset,
  type MaterialAssetSourceType,
  type MaterialAssetType,
  type MaterialEntitlement,
  type MaterialLibrarySource,
  type MaterialSourceState,
} from '@autix/sdk';

export type {
  MaterialAsset,
  MaterialAssetSourceType,
  MaterialAssetType,
  MaterialEntitlement,
  MaterialLibrarySource,
  MaterialSourceState,
} from '@autix/sdk';

export type MaterialFilterType = MaterialAssetType | 'all';

export interface MaterialUploadInput {
  type: MaterialAssetType;
  file: File;
  folder?: string;
  folderId?: string | null;
  title?: string;
  thumbnailUrl?: string | null;
  sourceType?: MaterialAssetSourceType;
}

export class MaterialUploadError extends Error {
  constructor(public readonly fileName: string) {
    super(fileName);
    this.name = 'MaterialUploadError';
  }
}

interface MaterialState {
  items: MaterialAsset[];
  entitlement: MaterialEntitlement | null;
  loading: boolean;
  loadMaterials: (params?: {
    type?: MaterialFilterType;
    search?: string;
    page?: number;
    pageSize?: number;
    folderId?: string;
    librarySource?: MaterialLibrarySource;
  }) => Promise<MaterialAsset[]>;
  uploadMaterialFiles: (files: MaterialUploadInput[]) => Promise<MaterialAsset[]>;
  deleteMaterial: (id: string) => Promise<void>;
  deleteMaterials: (ids: string[]) => Promise<void>;
  moveMaterials: (ids: string[], folderId: string | null) => Promise<void>;
  useMaterial: (id: string) => Promise<MaterialAsset | null>;
  createVideoMaterialUpload: (file: File) => Promise<{ url: string; name: string }>;
  /** Plan C Task 10：下载前置 sourceState 拦截（blocked/missing → 403），成功返回下载 URL。 */
  downloadMaterial: (id: string) => Promise<string | null>;
}

/** blocked/missing/unpublished 素材禁用 use/download，仅 available 可用。 */
export function isMaterialUsable(sourceState: MaterialSourceState | undefined): boolean {
  return sourceState === undefined || sourceState === 'available';
}

const inferContentType = (file: File) => file.type || 'application/octet-stream';

export const useMaterialStore = create<MaterialState>((set) => ({
  items: [],
  entitlement: null,
  loading: false,
  loadMaterials: async (params) => {
    set({ loading: true });
    try {
      const res = await materialsApi.list(params);
      const items = res.data.items ?? [];
      set({
        items,
        entitlement: res.data.entitlement,
        loading: false,
      });
      return items;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },
  uploadMaterialFiles: async (files) => {
    const created: MaterialAsset[] = [];
    for (const input of files) {
      const contentType = inferContentType(input.file);
      const presign = await materialsApi.uploadUrl({
        fileName: input.file.name,
        contentType,
        ...(input.folder ? { folder: input.folder } : {}),
      });
      const uploadRes = await uploadToPresignedUrl(presign.data.uploadUrl, input.file, {
        contentType,
      });
      if (!uploadRes.ok) throw new MaterialUploadError(input.file.name);
      const title =
        (input.title ?? input.file.name.replace(/\.[^.]+$/, '')) ||
        input.file.name;
      const res = await materialsApi.create({
        type: input.type,
        title,
        url: presign.data.publicUrl,
        thumbnailUrl:
          input.thumbnailUrl !== undefined
            ? input.thumbnailUrl
            : input.type === 'image'
              ? presign.data.publicUrl
              : null,
        mimeType: input.file.type || null,
        size: input.file.size,
        storageKey: presign.data.key,
        sourceType: input.sourceType ?? 'upload',
        folderId: input.folderId ?? null,
      });
      created.push(res.data);
    }
    set((state) => ({ items: [...created, ...state.items] }));
    return created;
  },
  deleteMaterial: async (id) => {
    await materialsApi.remove(id);
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
  deleteMaterials: async (ids) => {
    await materialsApi.batchDelete(ids);
    const idSet = new Set(ids);
    set((state) => ({ items: state.items.filter((item) => !idSet.has(item.id)) }));
  },
  moveMaterials: async (ids, folderId) => {
    await materialsApi.batchMove(ids, folderId);
    set((state) => ({ items: state.items.filter((item) => !ids.includes(item.id)) }));
  },
  useMaterial: async (id) => {
    try {
      const res = await materialsApi.use(id);
      return res.data;
    } catch {
      return null;
    }
  },
  createVideoMaterialUpload: async (file) => {
    const contentType = inferContentType(file);
    const presign = await videoProjectApi.uploadUrl({
      fileName: file.name,
      contentType,
      folder: 'video-materials',
    });
    await uploadToPresignedUrl(presign.data.uploadUrl, file, { contentType });
    return { url: presign.data.publicUrl, name: file.name };
  },
  downloadMaterial: async (id) => {
    const res = await materialsApi.download(id);
    return res.data.downloadUrl;
  },
}));
