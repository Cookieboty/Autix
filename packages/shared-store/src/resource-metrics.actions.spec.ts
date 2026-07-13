import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Plan C Task 10 复审：like/favorite 的路由分流按资源类型确定，且必须由真实 dispatch 验证
 * （不仅仅是 boolean 判定）：
 *   - IMAGE_TEMPLATE / VIDEO_TEMPLATE → imageTemplateApi / videoTemplateApi 专属方法
 *     （like=POST 切换、favorite=POST、unfavorite=DELETE）
 *   - GALLERY_POST → galleryApi 专属方法（like=POST、unlike=DELETE、favorite=POST、unfavorite=DELETE）
 *   - SKILL / MCP / AGENT → 通用 resourceMetricsActions 层（likeResource/favoriteResource 等 SDK 通用端点）
 */

const imageLike = vi.fn();
const imageFavorite = vi.fn();
const imageUnfavorite = vi.fn();
const videoLike = vi.fn();
const videoFavorite = vi.fn();
const videoUnfavorite = vi.fn();
const galleryLike = vi.fn();
const galleryUnlike = vi.fn();
const galleryFavorite = vi.fn();
const galleryUnfavorite = vi.fn();

// 通用端点 SDK 方法（skill/mcp/agent 经此层）
const likeResource = vi.fn();
const unlikeResource = vi.fn();
const favoriteResource = vi.fn();
const unfavoriteResource = vi.fn();
const shareResource = vi.fn();
const getResourceMetrics = vi.fn();

vi.mock('@autix/sdk', () => ({
  imageTemplateApi: { like: imageLike, favorite: imageFavorite, unfavorite: imageUnfavorite },
  videoTemplateApi: { like: videoLike, favorite: videoFavorite, unfavorite: videoUnfavorite },
  galleryApi: {
    like: galleryLike,
    unlike: galleryUnlike,
    favorite: galleryFavorite,
    unfavorite: galleryUnfavorite,
  },
  likeResource,
  unlikeResource,
  favoriteResource,
  unfavoriteResource,
  shareResource,
  getResourceMetrics,
}));

beforeEach(() => vi.clearAllMocks());

describe('hasDedicatedInteractionRoute', () => {
  it('IMAGE_TEMPLATE / VIDEO_TEMPLATE / GALLERY_POST → true（走专属受守卫路由）', async () => {
    const { hasDedicatedInteractionRoute } = await import('./resource-metrics.actions');
    expect(hasDedicatedInteractionRoute('IMAGE_TEMPLATE')).toBe(true);
    expect(hasDedicatedInteractionRoute('VIDEO_TEMPLATE')).toBe(true);
    expect(hasDedicatedInteractionRoute('GALLERY_POST')).toBe(true);
  });

  it('SKILL / MCP / AGENT → false（仍走通用端点）', async () => {
    const { hasDedicatedInteractionRoute } = await import('./resource-metrics.actions');
    expect(hasDedicatedInteractionRoute('SKILL')).toBe(false);
    expect(hasDedicatedInteractionRoute('MCP')).toBe(false);
    expect(hasDedicatedInteractionRoute('AGENT')).toBe(false);
  });
});

describe('dedicatedInteractionActions — 模板：打到 image/video 专属 SDK 方法', () => {
  it('IMAGE_TEMPLATE like/unlike → imageTemplateApi.like (POST 切换，无 DELETE unlike)', async () => {
    imageLike.mockResolvedValue({ data: { liked: true } });
    const { dedicatedInteractionActions } = await import('./resource-metrics.actions');
    await dedicatedInteractionActions.like('IMAGE_TEMPLATE', 'tpl-1');
    await dedicatedInteractionActions.unlike('IMAGE_TEMPLATE', 'tpl-1');
    expect(imageLike).toHaveBeenCalledTimes(2);
    expect(imageLike).toHaveBeenCalledWith('tpl-1');
  });

  it('IMAGE_TEMPLATE favorite → POST，unfavorite → DELETE 专属方法', async () => {
    imageFavorite.mockResolvedValue({ data: { favorited: true } });
    imageUnfavorite.mockResolvedValue({ data: { favorited: false } });
    const { dedicatedInteractionActions } = await import('./resource-metrics.actions');
    expect(await dedicatedInteractionActions.favorite('IMAGE_TEMPLATE', 'tpl-1')).toEqual({
      favorited: true,
    });
    expect(await dedicatedInteractionActions.unfavorite('IMAGE_TEMPLATE', 'tpl-1')).toEqual({
      favorited: false,
    });
    expect(imageFavorite).toHaveBeenCalledWith('tpl-1');
    expect(imageUnfavorite).toHaveBeenCalledWith('tpl-1');
  });

  it('VIDEO_TEMPLATE favorite/unfavorite → videoTemplateApi，不误打图片端点', async () => {
    videoFavorite.mockResolvedValue({ data: { favorited: true } });
    videoUnfavorite.mockResolvedValue({ data: { favorited: false } });
    const { dedicatedInteractionActions } = await import('./resource-metrics.actions');
    await dedicatedInteractionActions.favorite('VIDEO_TEMPLATE', 'v-1');
    await dedicatedInteractionActions.unfavorite('VIDEO_TEMPLATE', 'v-1');
    expect(videoFavorite).toHaveBeenCalledWith('v-1');
    expect(videoUnfavorite).toHaveBeenCalledWith('v-1');
    expect(imageFavorite).not.toHaveBeenCalled();
    expect(imageUnfavorite).not.toHaveBeenCalled();
  });
});

describe('dedicatedInteractionActions — Gallery：打到 galleryApi 专属方法', () => {
  it('GALLERY_POST like → POST /gallery/:id/like，unlike → DELETE（非重复 POST）', async () => {
    galleryLike.mockResolvedValue({ data: { likeCount: 1 } });
    galleryUnlike.mockResolvedValue({ data: { likeCount: 0 } });
    const { dedicatedInteractionActions } = await import('./resource-metrics.actions');
    await dedicatedInteractionActions.like('GALLERY_POST', 'g-1');
    await dedicatedInteractionActions.unlike('GALLERY_POST', 'g-1');
    expect(galleryLike).toHaveBeenCalledWith('g-1');
    expect(galleryUnlike).toHaveBeenCalledWith('g-1');
    // Gallery 有独立 DELETE unlike——不该像模板那样重复打 POST like
    expect(galleryLike).toHaveBeenCalledTimes(1);
  });

  it('GALLERY_POST favorite → POST，unfavorite → DELETE', async () => {
    galleryFavorite.mockResolvedValue({ data: { favorited: true } });
    galleryUnfavorite.mockResolvedValue({ data: { favorited: false } });
    const { dedicatedInteractionActions } = await import('./resource-metrics.actions');
    expect(await dedicatedInteractionActions.favorite('GALLERY_POST', 'g-1')).toEqual({
      favorited: true,
    });
    expect(await dedicatedInteractionActions.unfavorite('GALLERY_POST', 'g-1')).toEqual({
      favorited: false,
    });
    expect(galleryFavorite).toHaveBeenCalledWith('g-1');
    expect(galleryUnfavorite).toHaveBeenCalledWith('g-1');
    // 不该误打模板端点
    expect(imageFavorite).not.toHaveBeenCalled();
    expect(videoFavorite).not.toHaveBeenCalled();
  });
});

describe('resourceMetricsActions — SKILL/MCP/AGENT 经通用端点层 dispatch（真实调用）', () => {
  it('favorite(SKILL|MCP|AGENT) → 通用 favoriteResource SDK 方法（非专属 api）', async () => {
    favoriteResource.mockResolvedValue({ data: { favoriteCount: 1 } });
    const { resourceMetricsActions } = await import('./resource-metrics.actions');
    for (const type of ['SKILL', 'MCP', 'AGENT'] as const) {
      await resourceMetricsActions.favorite(type, 'r-1');
      expect(favoriteResource).toHaveBeenCalledWith(type, 'r-1');
    }
    // 专属 api 一次都不该被触碰
    expect(imageFavorite).not.toHaveBeenCalled();
    expect(videoFavorite).not.toHaveBeenCalled();
    expect(galleryFavorite).not.toHaveBeenCalled();
  });

  it('like/unlike(SKILL) → 通用 likeResource/unlikeResource', async () => {
    likeResource.mockResolvedValue({ data: { likeCount: 1 } });
    unlikeResource.mockResolvedValue({ data: { likeCount: 0 } });
    const { resourceMetricsActions } = await import('./resource-metrics.actions');
    await resourceMetricsActions.like('SKILL', 'r-1');
    await resourceMetricsActions.unlike('SKILL', 'r-1');
    expect(likeResource).toHaveBeenCalledWith('SKILL', 'r-1');
    expect(unlikeResource).toHaveBeenCalledWith('SKILL', 'r-1');
    expect(imageLike).not.toHaveBeenCalled();
    expect(galleryLike).not.toHaveBeenCalled();
  });
});
