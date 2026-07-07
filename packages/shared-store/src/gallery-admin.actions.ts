import {
  galleryAdminApi,
  type GalleryAdminStatus,
  type GalleryPendingPage,
  type GalleryPostAdminItem,
} from '@autix/sdk';

export type { GalleryAdminStatus, GalleryPendingPage, GalleryPostAdminItem };

export const galleryAdminActions = {
  listPending: async (cursor?: string): Promise<GalleryPendingPage> => {
    const { data } = await galleryAdminApi.listPending(cursor);
    return data;
  },
  listByStatus: async (
    status: GalleryAdminStatus,
    cursor?: string,
  ): Promise<GalleryPendingPage> => {
    const { data } = await galleryAdminApi.listByStatus(status, cursor);
    return data;
  },
  approve: (id: string) => galleryAdminApi.approve(id),
  reject: (id: string, reason: string) => galleryAdminApi.reject(id, reason),
  hide: (id: string) => galleryAdminApi.hide(id),
  remove: (id: string) => galleryAdminApi.remove(id),
  resolveReport: (reportId: string, status: 'RESOLVED' | 'DISMISSED') =>
    galleryAdminApi.resolveReport(reportId, status),
};
