import {
  batchJobApi,
  galleryAdminApi,
  type GalleryAdminKind,
  type GalleryAdminListParams,
  type GalleryAdminListResult,
  type GalleryAdminSourceType,
  type GalleryAdminStatus,
  type GalleryPostAdminItem,
} from '@autix/sdk';

export type {
  GalleryAdminKind,
  GalleryAdminListParams,
  GalleryAdminListResult,
  GalleryAdminSourceType,
  GalleryAdminStatus,
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
  importGallery: (items: Record<string, any>[]) => galleryAdminApi.importGallery(items),
  getGalleryImportTemplate: async (): Promise<Record<string, any>[]> => {
    const { data } = await galleryAdminApi.getGalleryImportTemplate();
    return data;
  },
  /** 复用与模板导入相同的通用 batch-job 轮询接口，不新建第二套轮询。 */
  getBatchJob: async (jobId: string) => {
    const { data } = await batchJobApi.get(jobId);
    return data;
  },
};
