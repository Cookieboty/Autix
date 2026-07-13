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
  interactions?: {
    likedIds?: string[];
    favoritedIds?: string[];
    likedIdsCalls?: unknown[][];
    favoritedIdsCalls?: unknown[][];
  };
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
  const interactions = overrides.interactions
    ? {
        findLikedIds: async (...args: unknown[]) => {
          overrides.interactions!.likedIdsCalls?.push(args);
          return new Set(overrides.interactions!.likedIds ?? []);
        },
        findFavoritedIds: async (...args: unknown[]) => {
          overrides.interactions!.favoritedIdsCalls?.push(args);
          return new Set(overrides.interactions!.favoritedIds ?? []);
        },
      }
    : undefined;
  return new GalleryService(repo as never, metrics as never, {} as never, interactions as never);
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

/**
 * Plan C Task 8：feed 登录态批量 overlay（防 N+1）。
 * 登录态：拿到本页 items 后，收集 ids，各跑一次批量查询（findLikedIds/findFavoritedIds），
 * 逐项 overlay boolean liked/favorited —— 无论页面有多少条，都必须恰好 2 次查询，
 * 证明不是逐条查（N+1）。匿名：跳过 overlay，不跑批量查询，字段省略（undefined）。
 */
describe('GalleryService.listFeed — viewer 态批量 overlay（防 N+1）', () => {
  it('登录态：每项回显 boolean favorited/liked', async () => {
    const likedIdsCalls: unknown[][] = [];
    const favoritedIdsCalls: unknown[][] = [];
    const svc = makeService({
      feedItems: [buildPost('a', GalleryKind.IMAGE)],
      interactions: {
        likedIds: ['a'],
        favoritedIds: [],
        likedIdsCalls,
        favoritedIdsCalls,
      },
    });

    const res = await svc.listFeed('IMAGE', undefined, 20, { id: 'viewer-9' } as never);

    expect(typeof res.items[0]!.favorited).toBe('boolean');
    expect(typeof res.items[0]!.liked).toBe('boolean');
    expect(res.items[0]!.liked).toBe(true);
    expect(res.items[0]!.favorited).toBe(false);
  });

  it('匿名：不回显 favorited/liked（undefined），且不跑批量查询', async () => {
    const likedIdsCalls: unknown[][] = [];
    const favoritedIdsCalls: unknown[][] = [];
    const svc = makeService({
      feedItems: [buildPost('a', GalleryKind.IMAGE)],
      interactions: { likedIdsCalls, favoritedIdsCalls },
    });

    const res = await svc.listFeed('IMAGE', undefined, 20, undefined);

    expect(res.items[0]!.favorited).toBeUndefined();
    expect(res.items[0]!.liked).toBeUndefined();
    expect(likedIdsCalls).toHaveLength(0);
    expect(favoritedIdsCalls).toHaveLength(0);
  });

  it('无 N+1：无论本页多少条，批量查询恰好各跑 1 次（共 2 次），一次性传入本页全部 ids', async () => {
    const likedIdsCalls: unknown[][] = [];
    const favoritedIdsCalls: unknown[][] = [];
    const svc = makeService({
      feedItems: [
        buildPost('a', GalleryKind.IMAGE),
        buildPost('b', GalleryKind.IMAGE),
        buildPost('c', GalleryKind.IMAGE),
      ],
      interactions: {
        likedIds: ['a', 'c'],
        favoritedIds: ['b'],
        likedIdsCalls,
        favoritedIdsCalls,
      },
    });

    const res = await svc.listFeed('IMAGE', undefined, 20, { id: 'viewer-9' } as never);

    // 固定 2 查：不管页大小是 3 条还是更多，findLikedIds/findFavoritedIds 各恰好调用 1 次。
    expect(likedIdsCalls).toHaveLength(1);
    expect(favoritedIdsCalls).toHaveLength(1);
    expect(likedIdsCalls[0]).toEqual(['viewer-9', ResourceType.GALLERY_POST, ['a', 'b', 'c']]);
    expect(favoritedIdsCalls[0]).toEqual(['viewer-9', ResourceType.GALLERY_POST, ['a', 'b', 'c']]);

    expect(res.items.map((i) => ({ id: i.post.id, liked: i.liked, favorited: i.favorited }))).toEqual([
      { id: 'a', liked: true, favorited: false },
      { id: 'b', liked: false, favorited: true },
      { id: 'c', liked: true, favorited: false },
    ]);
  });

  it('空 feed（0 条）登录态也不跑批量查询（无 id 可查）', async () => {
    const likedIdsCalls: unknown[][] = [];
    const favoritedIdsCalls: unknown[][] = [];
    const svc = makeService({
      feedItems: [],
      interactions: { likedIdsCalls, favoritedIdsCalls },
    });

    await svc.listFeed('IMAGE', undefined, 20, { id: 'viewer-9' } as never);

    expect(likedIdsCalls).toHaveLength(0);
    expect(favoritedIdsCalls).toHaveLength(0);
  });
});
