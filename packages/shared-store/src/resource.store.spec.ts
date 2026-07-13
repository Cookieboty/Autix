import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageTemplate } from '@autix/sdk';

const favoriteMock = vi.fn();
const unfavoriteMock = vi.fn();

vi.mock('@autix/sdk', () => ({
  imageTemplateApi: {
    favorite: favoriteMock,
    unfavorite: unfavoriteMock,
  },
  videoTemplateApi: {
    favorite: vi.fn(),
    unfavorite: vi.fn(),
  },
  skillApi: {
    favorite: vi.fn(),
    unfavorite: vi.fn(),
  },
  mcpApi: {
    favorite: vi.fn(),
    unfavorite: vi.fn(),
  },
  agentApi: {
    favorite: vi.fn(),
    unfavorite: vi.fn(),
  },
  acquisitionsApi: {
    acquire: vi.fn(),
  },
}));

const resource: ImageTemplate = {
  id: 'tpl-1',
  title: 'Template',
  category: 'portrait',
  tags: [],
  version: 1,
  pointsCost: 0,
  runtimeRequirement: 'CLOUD',
  runtimeDetectedBy: 'AUTO',
  status: 'APPROVED',
  authorId: 'author-1',
  useCount: 0,
  likeCount: 0,
  favoriteCount: 3,
  viewCount: 8,
  prompt: 'prompt',
  variables: [],
  exampleImages: [],
  isHot: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Plan C Task 10：favorite/unfavorite 现为幂等 POST=favorite/DELETE=unfavorite，不再是服务端
// 切换语义——这些用例覆盖 toggleFavorite 的方向性（按本地 favoritedIds 决定调哪个端点），
// 防止回归成"每次都 POST favorite，计数只加不减"的旧 bug（见 Plan C Task 12 brief #8）。
describe('useResourceStore.toggleFavorite', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useResourceStore } = await import('./resource.store');
    useResourceStore.setState({
      items: [],
      currentResource: null,
      error: null,
      favoritedIds: new Set(),
    });
  });

  it('calls favorite() and increments counts when not yet favorited locally', async () => {
    favoriteMock.mockResolvedValue({ data: { favorited: true } });
    const { useResourceStore } = await import('./resource.store');
    useResourceStore.setState({ items: [resource], currentResource: resource });

    await useResourceStore.getState().toggleFavorite('image-templates', 'tpl-1');

    expect(favoriteMock).toHaveBeenCalledWith('tpl-1');
    expect(unfavoriteMock).not.toHaveBeenCalled();
    expect(useResourceStore.getState().currentResource?.favoriteCount).toBe(4);
    expect(useResourceStore.getState().items[0]?.favoriteCount).toBe(4);
    expect(useResourceStore.getState().favoritedIds.has('tpl-1')).toBe(true);
  });

  it('calls unfavorite() and decrements counts when already favorited locally', async () => {
    unfavoriteMock.mockResolvedValue({ data: { favorited: false } });
    const { useResourceStore } = await import('./resource.store');
    useResourceStore.setState({
      items: [resource],
      currentResource: resource,
      favoritedIds: new Set(['tpl-1']),
    });

    await useResourceStore.getState().toggleFavorite('image-templates', 'tpl-1');

    expect(unfavoriteMock).toHaveBeenCalledWith('tpl-1');
    expect(favoriteMock).not.toHaveBeenCalled();
    expect(useResourceStore.getState().currentResource?.favoriteCount).toBe(2);
    expect(useResourceStore.getState().items[0]?.favoriteCount).toBe(2);
    expect(useResourceStore.getState().favoritedIds.has('tpl-1')).toBe(false);
  });

  it('does not drift the count across repeated toggles (directional, not a blind +1 every call)', async () => {
    favoriteMock.mockResolvedValue({ data: { favorited: true } });
    unfavoriteMock.mockResolvedValue({ data: { favorited: false } });
    const { useResourceStore } = await import('./resource.store');
    useResourceStore.setState({ items: [resource], currentResource: resource });

    await useResourceStore.getState().toggleFavorite('image-templates', 'tpl-1');
    await useResourceStore.getState().toggleFavorite('image-templates', 'tpl-1');

    expect(favoriteMock).toHaveBeenCalledTimes(1);
    expect(unfavoriteMock).toHaveBeenCalledTimes(1);
    expect(useResourceStore.getState().currentResource?.favoriteCount).toBe(3);
    expect(useResourceStore.getState().items[0]?.favoriteCount).toBe(3);
  });
});
