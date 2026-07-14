import { ImageWorkbenchService } from './image-workbench.service';

/**
 * history 回传广场提交态：
 * - 每条生成记录附 galleryPost（无活帖则不附）；
 * - 整页只查一次 gallery_posts（防 N+1 回归）。
 */
function makeService(overrides: {
  generations?: Array<{ id: string; generatedImages: string[] }>;
  activePosts?: Map<string, { id: string; status: string; rejectReason?: string | null }>;
  onFindActivePosts?: () => void;
  onDelete?: () => void;
}) {
  const generations = overrides.generations ?? [];

  const repo = {
    ensureWorkbenchTemplate: async () => ({ id: 'tpl-1', status: 'ARCHIVED' }),
    archiveTemplate: async () => undefined,
    findHistoryItems: async () => [
      generations.map((gen) => ({
        id: gen.id,
        resolvedPrompt: 'a cat',
        generatedImages: gen.generatedImages,
        referenceImage: null,
        variables: {},
        modelUsed: 'gpt-image',
        status: 'success',
        durationMs: 1000,
        createdAt: new Date('2026-07-14T00:00:00Z'),
      })),
      generations.length,
    ],
    deleteHistoryItem: async () => {
      overrides.onDelete?.();
    },
  };

  const gallery = {
    findActivePostsByGenerationIds: async () => {
      overrides.onFindActivePosts?.();
      return overrides.activePosts ?? new Map();
    },
  };

  return new ImageWorkbenchService(repo as never, gallery as never);
}

describe('ImageWorkbenchService.getHistory —— 广场提交态', () => {
  it('有活帖的生成记录附带 galleryPost，没有的不附', async () => {
    const service = makeService({
      generations: [
        { id: 'gen-1', generatedImages: ['https://cdn/a.png'] },
        { id: 'gen-2', generatedImages: ['https://cdn/b.png'] },
      ],
      activePosts: new Map([['gen-1', { id: 'post-1', status: 'PENDING', rejectReason: null }]]),
    });

    const result = await service.getHistory('user-1');

    expect(result.items[0].galleryPost).toEqual({
      id: 'post-1',
      status: 'PENDING',
      rejectReason: null,
    });
    expect(result.items[1].galleryPost).toBeUndefined();
  });

  it('整页只查一次 gallery_posts（防 N+1）', async () => {
    let calls = 0;
    const service = makeService({
      generations: [
        { id: 'gen-1', generatedImages: ['https://cdn/a.png'] },
        { id: 'gen-2', generatedImages: ['https://cdn/b.png'] },
        { id: 'gen-3', generatedImages: ['https://cdn/c.png'] },
      ],
      onFindActivePosts: () => {
        calls += 1;
      },
    });

    await service.getHistory('user-1');

    expect(calls).toBe(1);
  });
});

describe('ImageWorkbenchService.deleteHistoryItem —— 活帖守卫', () => {
  it('该生成有活帖时抛 409，并带上帖子状态', async () => {
    const service = makeService({
      generations: [{ id: 'gen-1', generatedImages: ['https://cdn/a.png'] }],
      activePosts: new Map([['gen-1', { id: 'post-1', status: 'PUBLISHED', rejectReason: null }]]),
    });

    let caught: unknown;
    try {
      await service.deleteHistoryItem('user-1', 'gen-1');
    } catch (err) {
      caught = err;
    }

    expect((caught as { status: number }).status).toBe(409);
    expect((caught as { response: { galleryPost: { status: string } } }).response.galleryPost.status)
      .toBe('PUBLISHED');
  });

  it('没有活帖时正常删除', async () => {
    let deleted = false;
    const service = makeService({
      generations: [{ id: 'gen-1', generatedImages: ['https://cdn/a.png'] }],
      activePosts: new Map(),
      onDelete: () => {
        deleted = true;
      },
    });

    await service.deleteHistoryItem('user-1', 'gen-1');

    expect(deleted).toBe(true);
  });
});
