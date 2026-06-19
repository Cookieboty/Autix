import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageTemplate } from '@autix/sdk';

const favoriteMock = vi.fn();

vi.mock('@autix/sdk', () => ({
  imageTemplateApi: {
    favorite: favoriteMock,
  },
  videoTemplateApi: {
    favorite: vi.fn(),
  },
  skillApi: {
    favorite: vi.fn(),
  },
  mcpApi: {
    favorite: vi.fn(),
  },
  agentApi: {
    favorite: vi.fn(),
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

describe('useResourceStore.toggleFavorite', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useResourceStore } = await import('./resource.store');
    useResourceStore.setState({
      items: [],
      currentResource: null,
      error: null,
    });
  });

  it('increments current and list favorite counts when backend favorites the resource', async () => {
    favoriteMock.mockResolvedValue({ data: { favorited: true } });
    const { useResourceStore } = await import('./resource.store');
    useResourceStore.setState({
      items: [resource],
      currentResource: resource,
    });

    await useResourceStore.getState().toggleFavorite('image-templates', 'tpl-1');

    expect(useResourceStore.getState().currentResource?.favoriteCount).toBe(4);
    expect(useResourceStore.getState().items[0]?.favoriteCount).toBe(4);
  });

  it('decrements current and list favorite counts when backend unfavorites the resource', async () => {
    favoriteMock.mockResolvedValue({ data: { favorited: false } });
    const { useResourceStore } = await import('./resource.store');
    useResourceStore.setState({
      items: [resource],
      currentResource: resource,
    });

    await useResourceStore.getState().toggleFavorite('image-templates', 'tpl-1');

    expect(useResourceStore.getState().currentResource?.favoriteCount).toBe(2);
    expect(useResourceStore.getState().items[0]?.favoriteCount).toBe(2);
  });
});
