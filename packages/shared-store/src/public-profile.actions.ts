import { publicProfileApi, type GalleryFeedItem } from '@autix/sdk';
import type { PublicProfile } from '@autix/domain';

export type { PublicProfile } from '@autix/domain';

/** 个人页 Generations feed 的一页：nextCursor 为 null 表示已到底。 */
export interface PublicProfileGenerationsPage {
  items: GalleryFeedItem[];
  nextCursor: string | null;
}

/** `/@username` 公开个人页只读入口：基础信息 + Generations feed。 */
export const publicProfileActions = {
  getByUsername: async (username: string): Promise<PublicProfile> => {
    const res = await publicProfileApi.getByUsername(username);
    return res.data;
  },
  listGenerations: async (
    username: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<PublicProfileGenerationsPage> => {
    const res = await publicProfileApi.getGenerations(username, params);
    return { items: res.data.items ?? [], nextCursor: res.data.nextCursor ?? null };
  },
};
