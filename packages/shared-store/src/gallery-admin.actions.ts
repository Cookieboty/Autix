import {
  batchJobApi,
  galleryAdminApi,
  type GalleryAdminKind,
  type GalleryAdminListParams,
  type GalleryAdminListResult,
  type GalleryAdminSourceType,
  type GalleryAdminStatus,
  type GalleryBatchAction,
  type GalleryBatchResult,
  type GalleryPostAdminItem,
} from '@autix/sdk';
// batchJobApi 供 useGalleryBatchJobPoller 复用通用 batch-job 轮询，不新建第二套。

export type {
  GalleryAdminKind,
  GalleryAdminListParams,
  GalleryAdminListResult,
  GalleryAdminSourceType,
  GalleryAdminStatus,
  GalleryBatchAction,
  GalleryBatchResult,
  GalleryPostAdminItem,
};

export const galleryAdminActions = {
  list: async (params: GalleryAdminListParams = {}): Promise<GalleryAdminListResult> => {
    const { data } = await galleryAdminApi.list(params);
    return data;
  },
  listCategories: async (): Promise<string[]> => {
    const { data } = await galleryAdminApi.listCategories();
    return data;
  },
  approve: (id: string) => galleryAdminApi.approve(id),
  reject: (id: string, reason: string) => galleryAdminApi.reject(id, reason),
  hide: (id: string) => galleryAdminApi.hide(id),
  remove: (id: string) => galleryAdminApi.remove(id),
  resolveReport: (reportId: string, status: 'RESOLVED' | 'DISMISSED') =>
    galleryAdminApi.resolveReport(reportId, status),
  batch: async (
    ids: string[],
    action: GalleryBatchAction,
    reason?: string,
  ): Promise<GalleryBatchResult> => {
    const { data } = await galleryAdminApi.batch(ids, action, reason);
    return data;
  },
  /** 复用与模板导入相同的通用 batch-job 轮询接口，不新建第二套轮询。 */
  getBatchJob: async (jobId: string) => {
    const { data } = await batchJobApi.get(jobId);
    return data;
  },
  /** JSON 批量导入 → 返回 batch job id，由 useGalleryBatchJobPoller 轮询进度。 */
  importGallery: async (items: Record<string, any>[]): Promise<{ jobId: string }> => {
    const { data } = await galleryAdminApi.importGallery(items);
    return data;
  },
};
