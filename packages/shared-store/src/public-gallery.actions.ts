import { galleryApi, type GalleryFeedItem, type GalleryFeedPost } from '@autix/sdk';

export type { GalleryFeedItem, GalleryFeedPost } from '@autix/sdk';

/** 广场 Feed 的一页：nextCursor 为 null 表示已到底，触底加载据此停手。 */
export interface PublicGalleryFeedPage {
  items: GalleryFeedItem[];
  nextCursor: string | null;
}

/** 公开广场（首页图片/视频画廊）消费入口：只读已发布作品的热度 Feed。 */
export const publicGalleryActions = {
  listFeed: async (params?: {
    kind?: 'IMAGE' | 'VIDEO';
    cursor?: string;
    limit?: number;
  }): Promise<PublicGalleryFeedPage> => {
    const res = await galleryApi.feed(params);
    return { items: res.data.items ?? [], nextCursor: res.data.nextCursor ?? null };
  },
};

export type { GalleryFeedItem as PublicGalleryFeedItem };
