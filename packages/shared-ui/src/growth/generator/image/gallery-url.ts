import type { ImageStudioMode } from '../generator-studio-helpers';

/**
 * 生成器 Tab 状态在 URL 里的表示 —— /ai/image 与 /ai/video **共用同一个参数名**。
 *
 * 为什么 Tab 要进 URL：页面默认回落到「历史」Tab，Tab 不进 URL 的话，刷新（或从作品
 * 详情返回）会掉回历史，看起来像状态被吃了。
 *
 *   /ai/image                → 历史 Tab
 *   /ai/image?mode=gallery   → 广场 Tab
 *   /ai/video?mode=gallery   → 视频广场 Tab（此前是 ?tab=gallery，已与 image 统一）
 *
 * **作品详情不在这里** —— 它是独立路由 `/gallery/<id>`（可 SSR、可 SEO、可分享），
 * 而不是往生成器页面上挂一个 query。
 */
export const GALLERY_MODE_PARAM = 'mode';
const GALLERY_MODE = 'gallery';

/** 从 location.search 解析出 Tab。 */
export function parseStudioMode(search: string): ImageStudioMode {
  const params = new URLSearchParams(search);
  return params.get(GALLERY_MODE_PARAM) === GALLERY_MODE ? 'gallery' : 'history';
}

/**
 * 把 Tab 写回 search 串（保留其它 query，如 ?model= / ?prompt=）。
 * 返回值形如 `?mode=gallery`；无参数时返回空串（不留一个光秃秃的 `?`）。
 */
export function buildStudioSearch(currentSearch: string, mode: ImageStudioMode): string {
  const params = new URLSearchParams(currentSearch);
  if (mode === 'gallery') params.set(GALLERY_MODE_PARAM, GALLERY_MODE);
  else params.delete(GALLERY_MODE_PARAM);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** 广场作品详情的站内路径（未加语种前缀——调用方用 localize() 补）。 */
export function galleryPostPath(postId: string): string {
  return `/gallery/${encodeURIComponent(postId)}`;
}

/** 返回广场 Tab 的路径：作品详情页点关闭时回到这里。 */
export const GALLERY_TAB_PATH = `/ai/image?${GALLERY_MODE_PARAM}=${GALLERY_MODE}`;
