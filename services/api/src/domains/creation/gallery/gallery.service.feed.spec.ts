import { GalleryKind, GalleryStatus, ResourceType } from '../../platform/prisma/generated';
import { GalleryService } from './gallery.service';

/** 公开热度 Feed（GET /gallery/feed）单元测试：只验证 service 编排逻辑，不加载 Nest 图。 */
function buildPost(id: string, kind: GalleryKind) {
  return {
    id,
    kind,
    title: `post-${id}`,
    coverImage: `https://cdn/${id}.jpg`,
    mediaUrls: [],
    status: GalleryStatus.PUBLISHED,
    category: 'art',
    publishedAt: new Date(),
  };
}

function makeService(overrides: {
  feedItems: ReturnType<typeof buildPost>[];
  nextCursor?: string | null;
  metricsMap?: Map<string, { likeCount: number; favoriteCount: number; viewCount: number; referenceCount: number }>;
  captureKind?: (kind: GalleryKind) => void;
}) {
  const repo = {
    findPublishedFeed: async (kind: GalleryKind) => {
      overrides.captureKind?.(kind);
      return { items: overrides.feedItems, nextCursor: overrides.nextCursor ?? null };
    },
  };
  const metrics = {
    getMetricsMap: async () => overrides.metricsMap ?? new Map(),
  };
  return new GalleryService(repo as never, metrics as never, {} as never);
}

describe('GalleryService.listFeed', () => {
  it('kind=video 归一化为 VIDEO 并透传到 repository', async () => {
    let seen: GalleryKind | null = null;
    const svc = makeService({ feedItems: [], captureKind: (k) => (seen = k) });
    await svc.listFeed('video', undefined, 24);
    expect(seen).toBe(GalleryKind.VIDEO);
  });

  it('缺省/非法 kind 归一化为 IMAGE', async () => {
    let seen: GalleryKind | null = null;
    const svc = makeService({ feedItems: [], captureKind: (k) => (seen = k) });
    await svc.listFeed(undefined, undefined, 24);
    expect(seen).toBe(GalleryKind.IMAGE);
  });

  it('把 PUBLISHED 作品映射为 GalleryFeedItem 并附上指标', async () => {
    const svc = makeService({
      feedItems: [buildPost('a', GalleryKind.IMAGE)],
      metricsMap: new Map([['a', { likeCount: 7, favoriteCount: 3, viewCount: 42, referenceCount: 1 }]]),
    });
    const res = await svc.listFeed('IMAGE', undefined, 24);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]!.post.id).toBe('a');
    expect(res.items[0]!.metrics).toEqual({
      pvCount: 0,
      uvCount: 0,
      likeCount: 7,
      favoriteCount: 3,
      viewCount: 42,
      referenceCount: 1,
    });
  });

  it('无指标行的作品指标补零，不丢弃作品', async () => {
    const svc = makeService({ feedItems: [buildPost('b', GalleryKind.IMAGE)], metricsMap: new Map() });
    const res = await svc.listFeed('IMAGE', undefined, 24);
    expect(res.items[0]!.metrics).toEqual({
      pvCount: 0,
      uvCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      viewCount: 0,
      referenceCount: 0,
    });
  });

  it('take 被夹在 1..48 之间', async () => {
    let seenTake = 0;
    const repo = {
      findPublishedFeed: async (_k: GalleryKind, _c: string | undefined, take: number) => {
        seenTake = take;
        return { items: [], nextCursor: null };
      },
    };
    const metrics = { getMetricsMap: async () => new Map() };
    const svc = new GalleryService(repo as never, metrics as never, {} as never);
    await svc.listFeed('IMAGE', undefined, 999);
    expect(seenTake).toBe(48);
    await svc.listFeed('IMAGE', undefined, 0);
    expect(seenTake).toBe(1);
  });

  it('透传 metrics 查询用 GALLERY_POST 资源类型', async () => {
    let seenType: ResourceType | null = null;
    const repo = {
      findPublishedFeed: async () => ({ items: [buildPost('c', GalleryKind.IMAGE)], nextCursor: null }),
    };
    const metrics = {
      getMetricsMap: async (type: ResourceType) => {
        seenType = type;
        return new Map();
      },
    };
    const svc = new GalleryService(repo as never, metrics as never, {} as never);
    await svc.listFeed('IMAGE', undefined, 24);
    expect(seenType).toBe(ResourceType.GALLERY_POST);
  });
});
