import { useAccumulatingGalleryFeed } from './gallery.queries';
import { publicProfileActions } from './public-profile.actions';

const GENERATIONS_PAGE_SIZE = 24;

/**
 * `/@username` 个人页 Generations feed 控制器：复用通用 feed 核心
 * （游标累积翻页 + 卡片方向性点赞/收藏），只把数据源换成 profiles/:username/generations。
 * username 切换时重置到第一页。
 */
export function useProfileGenerationsController(username: string) {
  return useAccumulatingGalleryFeed(
    (cursor) =>
      publicProfileActions
        .listGenerations(username, { cursor, limit: GENERATIONS_PAGE_SIZE })
        .then((r) => ({ items: r.items, nextCursor: r.nextCursor })),
    username,
  );
}
