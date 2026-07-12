import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Plan C Task 10 复审：桌面端模板互动改走专属受守卫路由（通用 /resources 端点已对
 * 模板类型 400）。本测试锁定路由决策层——hasDedicatedInteractionRoute 的分流，
 * 以及 dedicatedInteractionActions 打到正确的 SDK 专属方法：
 *   - IMAGE_TEMPLATE / VIDEO_TEMPLATE → imageTemplateApi / videoTemplateApi 的
 *     like(POST 切换) / favorite(POST) / unfavorite(DELETE)
 *   - SKILL / MCP / AGENT / GALLERY_POST → 不属专属路由，仍走通用端点。
 */

const imageLike = vi.fn();
const imageFavorite = vi.fn();
const imageUnfavorite = vi.fn();
const videoLike = vi.fn();
const videoFavorite = vi.fn();
const videoUnfavorite = vi.fn();

vi.mock('@autix/sdk', () => ({
  imageTemplateApi: { like: imageLike, favorite: imageFavorite, unfavorite: imageUnfavorite },
  videoTemplateApi: { like: videoLike, favorite: videoFavorite, unfavorite: videoUnfavorite },
  // 通用端点方法（本测试不调用，仅需存在以满足模块导入）
  getResourceMetrics: vi.fn(),
  likeResource: vi.fn(),
  unlikeResource: vi.fn(),
  favoriteResource: vi.fn(),
  unfavoriteResource: vi.fn(),
  shareResource: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe('hasDedicatedInteractionRoute', () => {
  it('IMAGE_TEMPLATE / VIDEO_TEMPLATE → true（走专属受守卫路由）', async () => {
    const { hasDedicatedInteractionRoute } = await import('./resource-metrics.actions');
    expect(hasDedicatedInteractionRoute('IMAGE_TEMPLATE')).toBe(true);
    expect(hasDedicatedInteractionRoute('VIDEO_TEMPLATE')).toBe(true);
  });

  it('SKILL / MCP / AGENT / GALLERY_POST → false（仍走通用端点）', async () => {
    const { hasDedicatedInteractionRoute } = await import('./resource-metrics.actions');
    expect(hasDedicatedInteractionRoute('SKILL')).toBe(false);
    expect(hasDedicatedInteractionRoute('MCP')).toBe(false);
    expect(hasDedicatedInteractionRoute('AGENT')).toBe(false);
    expect(hasDedicatedInteractionRoute('GALLERY_POST')).toBe(false);
  });
});

describe('dedicatedInteractionActions — 打到正确的模板专属 SDK 方法', () => {
  it('IMAGE_TEMPLATE toggleLike → imageTemplateApi.like (POST 切换)', async () => {
    imageLike.mockResolvedValue({ data: { liked: true } });
    const { dedicatedInteractionActions } = await import('./resource-metrics.actions');
    const res = await dedicatedInteractionActions.toggleLike('IMAGE_TEMPLATE', 'tpl-1');
    expect(imageLike).toHaveBeenCalledWith('tpl-1');
    expect(res).toEqual({ liked: true });
  });

  it('IMAGE_TEMPLATE favorite → imageTemplateApi.favorite (POST)', async () => {
    imageFavorite.mockResolvedValue({ data: { favorited: true } });
    const { dedicatedInteractionActions } = await import('./resource-metrics.actions');
    const res = await dedicatedInteractionActions.favorite('IMAGE_TEMPLATE', 'tpl-1');
    expect(imageFavorite).toHaveBeenCalledWith('tpl-1');
    expect(res).toEqual({ favorited: true });
  });

  it('IMAGE_TEMPLATE unfavorite → imageTemplateApi.unfavorite (DELETE)', async () => {
    imageUnfavorite.mockResolvedValue({ data: { favorited: false } });
    const { dedicatedInteractionActions } = await import('./resource-metrics.actions');
    const res = await dedicatedInteractionActions.unfavorite('IMAGE_TEMPLATE', 'tpl-1');
    expect(imageUnfavorite).toHaveBeenCalledWith('tpl-1');
    expect(res).toEqual({ favorited: false });
  });

  it('VIDEO_TEMPLATE favorite/unfavorite → videoTemplateApi 对应方法', async () => {
    videoFavorite.mockResolvedValue({ data: { favorited: true } });
    videoUnfavorite.mockResolvedValue({ data: { favorited: false } });
    const { dedicatedInteractionActions } = await import('./resource-metrics.actions');
    await dedicatedInteractionActions.favorite('VIDEO_TEMPLATE', 'v-1');
    await dedicatedInteractionActions.unfavorite('VIDEO_TEMPLATE', 'v-1');
    expect(videoFavorite).toHaveBeenCalledWith('v-1');
    expect(videoUnfavorite).toHaveBeenCalledWith('v-1');
    // 不应误打到图片模板端点
    expect(imageFavorite).not.toHaveBeenCalled();
    expect(imageUnfavorite).not.toHaveBeenCalled();
  });
});
