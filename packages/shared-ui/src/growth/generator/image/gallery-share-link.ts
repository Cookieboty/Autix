import type { ImageGenerationGalleryPost } from '@autix/shared-store';
import { galleryPostPath } from './gallery-url';

/**
 * 某次生成的「作品分享链接」——**只有帖子已发布（PUBLISHED）时才有**。
 *
 * 审核中 / 已驳回 / 已下架 / 被隐藏的帖子，广场 feed 与详情接口都不会返回给别人，
 * 给出链接对方只会看到 404，所以这些状态下不给链接（调用方据此不渲染菜单项）。
 *
 * 与「复制图片链接」是两回事：那个是 CDN 上的裸图 URL（谁都能打开、但没有作品页），
 * 这个是站内可浏览的作品详情路由 /gallery/<id>。
 *
 * localize 由调用方从 useLocalizePath() 拿——语种前缀不能在这里瞎猜。
 */
export function resolveGalleryShareUrl(
  galleryPost: ImageGenerationGalleryPost | undefined,
  localize: (path: string) => string,
): string | undefined {
  if (galleryPost?.status !== 'PUBLISHED') return undefined;
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${localize(galleryPostPath(galleryPost.id))}`;
}
