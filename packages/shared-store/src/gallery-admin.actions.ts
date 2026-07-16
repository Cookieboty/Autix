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
// 注：gallery import 已下线（后端 /admin/gallery/import 端点已删除，见 Plan C Task 1）；
// batchJobApi 仍保留供 useGalleryBatchJobPoller 复用通用 batch-job 轮询。

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
};
