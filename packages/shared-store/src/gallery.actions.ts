import {
  galleryApi,
  type CreateGalleryPostInput,
  type GalleryDetailPost,
  type GalleryDetailResult,
  type GalleryFeedResult,
  type GalleryRecreateResult,
  type ResourceMetrics,
} from '@autix/sdk';

export type {
  CreateGalleryPostInput,
  GalleryAdminSourceType,
  GalleryAdminStatus,
  GalleryDetailAuthor,
  GalleryDetailMetrics,
  GalleryDetailPost,
  GalleryDetailResult,
  GalleryFeedItem,
  GalleryFeedPost,
  GalleryFeedResult,
  GalleryRecreateResult,
  GallerySourceTypeInput,
} from '@autix/sdk';

/**
 * 用户侧广场（gallery_posts）读写入口：Task 12 前端接线——列表/详情/发布/下架/
 * 重新提交/recreate/download + like/favorite（favorite 经 FavoriteLibraryService
 * 幂等 POST=favorite/DELETE=unfavorite，不是切换语义，调用方必须按方向调用）。
 */
export const galleryActions = {
  getFeed: async (params?: {
    kind?: 'IMAGE' | 'VIDEO';
    cursor?: string;
    limit?: number;
  }): Promise<GalleryFeedResult> => {
    const res = await galleryApi.getFeed(params);
    return res.data;
  },
  getDetail: async (id: string): Promise<GalleryDetailResult> => {
    const res = await galleryApi.getDetail(id);
    return res.data;
  },
  /** POST /gallery：先审后发，成功后作品状态为 PENDING（不会立即出现在 feed）。 */
  publish: async (data: CreateGalleryPostInput): Promise<GalleryDetailPost> => {
    const res = await galleryApi.publish(data);
    return res.data;
  },
  unpublish: async (id: string): Promise<GalleryDetailPost> => {
    const res = await galleryApi.unpublish(id);
    return res.data;
  },
  republish: async (id: string): Promise<GalleryDetailPost> => {
    const res = await galleryApi.republish(id);
    return res.data;
  },
  /** DELETE /gallery/:id：作者本人删除自己的作品（→ REMOVED）。 */
  remove: async (id: string): Promise<GalleryDetailPost> => {
    const res = await galleryApi.remove(id);
    return res.data;
  },
  recreate: async (id: string): Promise<GalleryRecreateResult> => {
    const res = await galleryApi.recreate(id);
    return res.data;
  },
  download: async (id: string): Promise<{ downloadUrl: string }> => {
    const res = await galleryApi.download(id);
    return res.data;
  },
  like: async (id: string): Promise<ResourceMetrics> => {
    const res = await galleryApi.like(id);
    return res.data;
  },
  unlike: async (id: string): Promise<ResourceMetrics> => {
    const res = await galleryApi.unlike(id);
    return res.data;
  },
  favorite: async (id: string): Promise<{ favorited: boolean }> => {
    const res = await galleryApi.favorite(id);
    return res.data;
  },
  unfavorite: async (id: string): Promise<{ favorited: boolean }> => {
    const res = await galleryApi.unfavorite(id);
    return res.data;
  },
};

/**
 * 后端错误体固定为 `{ success, code, msg, data, traceId }`（AllExceptionsFilter），**没有顶层
 * `message` 字段**；SDK 的错误拦截器又把 msg 挂到 error.msg 上。所以按 `response.data.message`
 * 去找必然是 undefined —— 那样所有广场操作失败都只会退化成通用兜底文案，把后端给出的真实
 * 原因（如「非法状态转移」）全吞掉。这里按真实形状读：先 err.msg，再 response.data.msg。
 */
function errorMessage(e: unknown): string {
  const err = e as { msg?: string; response?: { data?: { msg?: string } } };
  if (typeof err?.msg === 'string' && err.msg) return err.msg;
  const body = err?.response?.data?.msg;
  if (typeof body === 'string' && body) return body;
  if (e instanceof Error && e.message) return e.message;
  return 'Loading failed. Please try again later.';
}

export { errorMessage as galleryErrorMessage };
