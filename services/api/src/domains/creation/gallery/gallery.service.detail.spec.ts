import { NotFoundException } from '@nestjs/common';
import { ResourceType } from '../../platform/prisma/generated';
import { GalleryService } from './gallery.service';

/**
 * Plan C Task 7：GET /gallery/:id 详情聚合 + 登录态双写 resource_views。
 *
 * 只验证 service 编排逻辑（不加载 Nest 图）：
 * - 可见性：匿名仅 PUBLISHED；作者本人 / 管理员可预览自己的非公开作品。
 * - 聚合：author 经 presentAuthor（DELETED 隐私已在 presenter 单测覆盖）、
 *   metrics 读 resource_metrics（含 downloadCount/referenceCount）、
 *   登录态 viewer.{liked,favorited} 经批量成员查询（findLikedIds/findFavoritedIds）。
 * - 双写：登录访问经 interactions.createView 写一条 resource_views；匿名不写、viewer 省略。
 */

const authorRow = {
  id: 'author-1',
  status: 'ACTIVE',
  realName: 'Real Author',
  username: 'author1',
  avatar: 'author.png',
};

function publishedPost() {
  return {
    id: 'p-pub',
    authorId: 'author-1',
    status: 'PUBLISHED',
    title: 'hello',
    author: authorRow,
  };
}

function makeDetailService(overrides: {
  post?: Record<string, unknown> | null;
  likedIds?: string[];
  favoritedIds?: string[];
  metrics?: Record<string, number>;
  captureCreateView?: (userId: string | undefined, id: string) => void;
}) {
  const createViewCalls: Array<{ userId: string | undefined; id: string }> = [];
  const likedIdsCalls: unknown[][] = [];
  const favoritedIdsCalls: unknown[][] = [];

  const repo = {
    findByIdWithAuthor: async (id: string) =>
      overrides.post === undefined ? publishedPost() : overrides.post,
    // 厂商串 → 展示别名（getDetail 与 feed 同一口径，见 gallery.service.ts）。
    findModelDisplayNames: async (models: string[]) =>
      new Map(models.filter(Boolean).map((m) => [m, `alias-${m}`])),
  };
  const metrics = {
    getMetrics: async () => ({
      viewCount: overrides.metrics?.viewCount ?? 0,
      downloadCount: overrides.metrics?.downloadCount ?? 0,
      referenceCount: overrides.metrics?.referenceCount ?? 0,
      likeCount: overrides.metrics?.likeCount ?? 0,
      favoriteCount: overrides.metrics?.favoriteCount ?? 0,
      pvCount: 0,
      uvCount: 0,
    }),
  };
  const interactions = {
    findLikedIds: async (...args: unknown[]) => {
      likedIdsCalls.push(args);
      return new Set(overrides.likedIds ?? []);
    },
    findFavoritedIds: async (...args: unknown[]) => {
      favoritedIdsCalls.push(args);
      return new Set(overrides.favoritedIds ?? []);
    },
    createView: async (userId: string | undefined, _rt: unknown, id: string) => {
      createViewCalls.push({ userId, id });
      overrides.captureCreateView?.(userId, id);
      return { id: 'view-1' };
    },
  };
  const service = new GalleryService(
    repo as never,
    metrics as never,
    {} as never,
    interactions as never,
  );
  return { service, createViewCalls, likedIdsCalls, favoritedIdsCalls };
}

describe('GalleryService.getDetail — 聚合 + 双写', () => {
  it('登录访问 PUBLISHED：写一条 resource_views，返回 author/metrics/viewer', async () => {
    const { service, createViewCalls, likedIdsCalls, favoritedIdsCalls } = makeDetailService({
      likedIds: ['p-pub'],
      favoritedIds: [],
      metrics: { viewCount: 42, downloadCount: 5, referenceCount: 2, likeCount: 7, favoriteCount: 3 },
    });
    const res = await service.getDetail('p-pub', { id: 'viewer-9' } as never);

    // 双写：登录态写 resource_views 恰好一次
    expect(createViewCalls).toEqual([{ userId: 'viewer-9', id: 'p-pub' }]);

    // author 经 presentAuthor：ACTIVE → displayName(realName) ?? username
    expect(res.author).toEqual({ userId: 'author-1', nickname: 'Real Author', avatar: 'author.png' });

    // metrics 透出计数（含 download/reference）
    expect(res.metrics.viewCount).toBe(42);
    expect(res.metrics.downloadCount).toBe(5);
    expect(res.metrics.referenceCount).toBe(2);
    expect(res.metrics.likeCount).toBe(7);
    expect(res.metrics.favoriteCount).toBe(3);

    // viewer 由批量成员查询得出
    expect(res.viewer).toEqual({ liked: true, favorited: false });

    // 批量查询：以 [id] 数组形式调用（单条详情也走批量形态，Task 8 feed 复用）
    expect(likedIdsCalls).toHaveLength(1);
    expect(favoritedIdsCalls).toHaveLength(1);
    expect(likedIdsCalls[0]).toEqual(['viewer-9', ResourceType.GALLERY_POST, ['p-pub']]);
    expect(favoritedIdsCalls[0]).toEqual(['viewer-9', ResourceType.GALLERY_POST, ['p-pub']]);
  });

  it('displayName 优先取 nickname，其次才回退 realName', async () => {
    const { service } = makeDetailService({
      post: {
        ...publishedPost(),
        author: { ...authorRow, nickname: 'Nick', realName: 'Real Author' },
      },
    });
    const res = await service.getDetail('p-pub', undefined);
    expect(res.author.nickname).toBe('Nick');
  });

  it('匿名访问 PUBLISHED：不写 resource_views、viewer 省略', async () => {
    const { service, createViewCalls, likedIdsCalls } = makeDetailService({});
    const res = await service.getDetail('p-pub', undefined);
    expect(createViewCalls).toHaveLength(0);
    expect(res.viewer).toBeUndefined();
    // 未登录不跑成员查询
    expect(likedIdsCalls).toHaveLength(0);
    expect(res.author.userId).toBe('author-1');
  });

  it('作品不存在 → 404', async () => {
    const { service } = makeDetailService({ post: null });
    await expect(service.getDetail('missing', undefined)).rejects.toThrow(NotFoundException);
  });

  it('匿名访问非 PUBLISHED → 404（不泄漏未公开作品）', async () => {
    const { service, createViewCalls } = makeDetailService({
      post: { ...publishedPost(), status: 'PENDING' },
    });
    await expect(service.getDetail('p-pub', undefined)).rejects.toThrow(NotFoundException);
    expect(createViewCalls).toHaveLength(0);
  });

  it('作者本人可预览自己的非 PUBLISHED 作品（owner 放行），并写 resource_views', async () => {
    const { service, createViewCalls } = makeDetailService({
      post: { ...publishedPost(), status: 'PENDING' },
    });
    const res = await service.getDetail('p-pub', { id: 'author-1' } as never);
    expect(res.author.userId).toBe('author-1');
    expect(createViewCalls).toEqual([{ userId: 'author-1', id: 'p-pub' }]);
  });

  it('管理员可预览他人的非 PUBLISHED 作品（admin 放行）', async () => {
    const { service } = makeDetailService({
      post: { ...publishedPost(), status: 'HIDDEN' },
    });
    const res = await service.getDetail('p-pub', {
      id: 'admin-x',
      roles: ['ADMIN'],
    } as never);
    expect(res.author.userId).toBe('author-1');
  });

  it('他人（登录非作者非管理员）访问他人的非 PUBLISHED 作品 → 404', async () => {
    const { service, createViewCalls } = makeDetailService({
      post: { ...publishedPost(), status: 'PENDING' },
    });
    await expect(
      service.getDetail('p-pub', { id: 'other-user', roles: [] } as never),
    ).rejects.toThrow(NotFoundException);
    expect(createViewCalls).toHaveLength(0);
  });
});

describe('GalleryService.getDetail — 隐私泄漏守卫（返回体绝无原始作者字段）', () => {
  it('DELETED 作者：整个响应序列化后不含 username / deleted_ 前缀 / 旧头像 / status', async () => {
    const { service } = makeDetailService({
      post: {
        ...publishedPost(),
        author: {
          id: 'author-1',
          status: 'DELETED',
          realName: 'Legal Name',
          username: 'deleted_author-1',
          avatar: 'stale.png',
        },
      },
    });
    const res = await service.getDetail('p-pub', { id: 'viewer-9' } as never);
    // presenter 已脱敏
    expect(res.author).toEqual({ userId: 'author-1', nickname: '已注销用户', avatar: null });
    // post 不得再夹带原始 author 关系行
    expect((res.post as Record<string, unknown>).author).toBeUndefined();
    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain('deleted_');
    expect(serialized).not.toContain('deleted_author-1');
    expect(serialized).not.toContain('Legal Name');
    expect(serialized).not.toContain('stale.png');
  });

  it('ACTIVE 作者：post 本体不夹带原始 author 关系行（username/realName/status 均不在 post 内）', async () => {
    const { service } = makeDetailService({
      post: {
        ...publishedPost(),
        author: {
          id: 'author-1',
          status: 'ACTIVE',
          realName: 'Secret Legal Name',
          username: 'raw-username-xyz',
          avatar: 'author.png',
        },
      },
    });
    const res = await service.getDetail('p-pub', undefined);
    // post 不得再夹带原始 author 关系行
    expect((res.post as Record<string, unknown>).author).toBeUndefined();
    const postSerialized = JSON.stringify(res.post);
    expect(postSerialized).not.toContain('Secret Legal Name');
    expect(postSerialized).not.toContain('raw-username-xyz');
    // 原始 username 绝不出现在任何位置（ACTIVE 展示用 displayName，不暴露登录名）
    expect(JSON.stringify(res)).not.toContain('raw-username-xyz');
    // displayName←realName：realName 仅作为脱敏后的展示昵称出现一次，非原始行泄漏
    expect(res.author.nickname).toBe('Secret Legal Name');
    // 保留业务字段（帖子标题）证明只剥离了 author 关系、未误伤 post 本体
    expect((res.post as Record<string, unknown>).title).toBe('hello');
  });
});
