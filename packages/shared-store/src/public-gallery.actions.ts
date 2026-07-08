import { galleryApi, type GalleryFeedItem, type GalleryFeedPost } from '@autix/sdk';

export type { GalleryFeedItem, GalleryFeedPost } from '@autix/sdk';

/** 公开广场（首页图片/视频画廊）消费入口：只读已发布作品的热度 Feed。 */
export const publicGalleryActions = {
  listFeed: async (params?: {
    kind?: 'IMAGE' | 'VIDEO';
    cursor?: string;
    limit?: number;
  }): Promise<GalleryFeedItem[]> => {
    const res = await galleryApi.feed(params);
    return res.data.items ?? [];
  },
};

export type { GalleryFeedItem as PublicGalleryFeedItem };
