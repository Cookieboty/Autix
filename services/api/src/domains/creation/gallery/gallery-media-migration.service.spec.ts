import { GalleryMediaMigrationService } from './gallery-media-migration.service';

type PendingPost = {
  id: string;
  coverImage: string | null;
  mediaUrls: string[];
  mediaMigrationAttempts: number;
  createdAt: Date;
};

function makeService(opts: {
  pending: PendingPost[];
  migrate: (data: Record<string, unknown>) => { data: Record<string, unknown>; errors: string[] };
  updates: Array<{ id: string; data: Record<string, unknown> }>;
  published?: string[];
  publishCalls?: Array<{ id: string; publishedAt: Date }>;
  publishCount?: number;
}) {
  const repo = {
    findPostsPendingMediaMigration: async () => opts.pending,
    update: async (id: string, data: Record<string, unknown>) => {
      opts.updates.push({ id, data });
      return { id, ...data };
    },
    publishIfPending: async (id: string, publishedAt: Date) => {
      opts.published?.push(id);
      opts.publishCalls?.push({ id, publishedAt });
      return opts.publishCount ?? 1;
    },
  };
  const migration = {
    migrateMediaFields: async (data: Record<string, unknown>) => opts.migrate(data),
  };
  return new GalleryMediaMigrationService(repo as never, migration as never);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_OFFSET_MS = 5 * 60 * 1000; // 5 分钟
const MAX_OFFSET_MS = 6 * 60 * 60 * 1000; // 6 小时

describe('GalleryMediaMigrationService.migratePendingBatch', () => {
  it('无待迁移作品时不做任何事', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const svc = makeService({ pending: [], migrate: () => ({ data: {}, errors: [] }), updates });
    const res = await svc.migratePendingBatch();
    expect(res.scanned).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it('全部搬运成功：回写 R2 链接、标记 mediaMigrated=true 并发布', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const published: string[] = [];
    const svc = makeService({
      pending: [
        { id: 'p1', coverImage: 'https://ext/a.png', mediaUrls: ['https://ext/a.png'], mediaMigrationAttempts: 0, createdAt: new Date(Date.now() - DAY_MS) },
      ],
      migrate: () => ({
        data: { coverImage: 'https://r2/a.png', mediaUrls: ['https://r2/a.png'] },
        errors: [],
      }),
      updates,
      published,
    });

    const res = await svc.migratePendingBatch();

    expect(res.published).toBe(1);
    expect(published).toEqual(['p1']);
    expect(updates[0]!.data).toMatchObject({
      coverImage: 'https://r2/a.png',
      mediaUrls: ['https://r2/a.png'],
      mediaMigrated: true,
      mediaMigrationAttempts: 1,
    });
  });

  it('搬运失败且未达上限：不发布，保持 mediaMigrated=false 待重试', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const published: string[] = [];
    const svc = makeService({
      pending: [{ id: 'p2', coverImage: 'https://ext/x.png', mediaUrls: [], mediaMigrationAttempts: 0, createdAt: new Date(Date.now() - DAY_MS) }],
      migrate: () => ({ data: { coverImage: 'https://ext/x.png', mediaUrls: [] }, errors: ['coverImage: 403'] }),
      updates,
      published,
    });

    const res = await svc.migratePendingBatch({ maxAttempts: 3 });

    expect(res.retry).toBe(1);
    expect(res.published).toBe(0);
    expect(published).toEqual([]);
    expect(updates[0]!.data).toMatchObject({ mediaMigrated: false, mediaMigrationAttempts: 1 });
  });

  it('搬运失败且达到上限：滞留 PENDING 不发布，mediaMigrated 仍为 false', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const published: string[] = [];
    const svc = makeService({
      pending: [{ id: 'p3', coverImage: 'https://ext/x.png', mediaUrls: [], mediaMigrationAttempts: 2, createdAt: new Date(Date.now() - DAY_MS) }],
      migrate: () => ({ data: { coverImage: 'https://ext/x.png', mediaUrls: [] }, errors: ['coverImage: timeout'] }),
      updates,
      published,
    });

    const res = await svc.migratePendingBatch({ maxAttempts: 3 });

    expect(res.stranded).toBe(1);
    expect(res.published).toBe(0);
    expect(published).toEqual([]);
    // 关键：达上限不等于已站内化。字段必须诚实反映"媒体仍是外链"。
    expect(updates[0]!.data).toMatchObject({ mediaMigrated: false, mediaMigrationAttempts: 3 });
  });

  it('部分成功：已搬好的链接照常回写保留进度，但整条不发布', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const published: string[] = [];
    const svc = makeService({
      pending: [
        { id: 'p4', coverImage: 'https://ext/c.png', mediaUrls: ['https://ext/a.png', 'https://ext/b.png'], mediaMigrationAttempts: 0, createdAt: new Date(Date.now() - DAY_MS) },
      ],
      migrate: () => ({
        data: { coverImage: 'https://r2/c.png', mediaUrls: ['https://r2/a.png', 'https://ext/b.png'] },
        errors: ['mediaUrls[1]: 404'],
      }),
      updates,
      published,
    });

    const res = await svc.migratePendingBatch({ maxAttempts: 3 });

    expect(res.published).toBe(0);
    expect(published).toEqual([]);
    expect(updates[0]!.data).toMatchObject({
      coverImage: 'https://r2/c.png',
      mediaUrls: ['https://r2/a.png', 'https://ext/b.png'],
      mediaMigrated: false,
    });
  });

  it('管理员已抢先处置（publishIfPending 返回 0）时不计入 published', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const svc = makeService({
      pending: [{ id: 'p5', coverImage: 'https://ext/a.png', mediaUrls: [], mediaMigrationAttempts: 0, createdAt: new Date(Date.now() - DAY_MS) }],
      migrate: () => ({ data: { coverImage: 'https://r2/a.png', mediaUrls: [] }, errors: [] }),
      updates,
      publishCount: 0,
    });

    const res = await svc.migratePendingBatch();

    expect(res.published).toBe(0);
    expect(updates[0]!.data).toMatchObject({ mediaMigrated: true });
  });

  // 广场 feed 按 publishedAt 排序；搬运成功后随机撒开发布时间，
  // publishedAt = createdAt + random(5分钟, 6小时)。Math.random 打桩确定化。
  it('搬运成功：publishedAt = createdAt + offset，offset 落在 [5分钟, 6小时]', async () => {
    const fixedNow = new Date('2026-07-17T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const createdAt = new Date(fixedNow.getTime() - DAY_MS); // 远早于 now，offset 加上去不会撞到 now 的夹子
      const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
      const publishCalls: Array<{ id: string; publishedAt: Date }> = [];
      const svc = makeService({
        pending: [{ id: 'p6', coverImage: 'https://ext/a.png', mediaUrls: [], mediaMigrationAttempts: 0, createdAt }],
        migrate: () => ({ data: { coverImage: 'https://r2/a.png', mediaUrls: [] }, errors: [] }),
        updates,
        publishCalls,
      });

      await svc.migratePendingBatch();

      const expectedOffset = MIN_OFFSET_MS + 0.5 * (MAX_OFFSET_MS - MIN_OFFSET_MS);
      expect(publishCalls).toHaveLength(1);
      expect(publishCalls[0]!.id).toBe('p6');
      expect(publishCalls[0]!.publishedAt.getTime()).toBe(createdAt.getTime() + expectedOffset);
      // 断言 offset 确实落在设计区间内（不是巧合命中某个具体数）。
      const actualOffset = publishCalls[0]!.publishedAt.getTime() - createdAt.getTime();
      expect(actualOffset).toBeGreaterThanOrEqual(MIN_OFFSET_MS);
      expect(actualOffset).toBeLessThanOrEqual(MAX_OFFSET_MS);
    } finally {
      randomSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  // 夹住 now 的边界：createdAt 极近（1 分钟前）+ 最大偏移（6 小时）会产生未来的 publishedAt——
  // 那条作品会永远钉在 feed 顶部并显示"N 小时后发布"。必须夹到 now。
  it('夹住 now 的边界：createdAt 极近 + 大偏移时，publishedAt 不得超过 now', async () => {
    const fixedNow = new Date('2026-07-17T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1); // 最大偏移 6 小时
    try {
      const createdAt = new Date(fixedNow.getTime() - 60 * 1000); // 1 分钟前
      const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
      const publishCalls: Array<{ id: string; publishedAt: Date }> = [];
      const svc = makeService({
        pending: [{ id: 'p7', coverImage: 'https://ext/a.png', mediaUrls: [], mediaMigrationAttempts: 0, createdAt }],
        migrate: () => ({ data: { coverImage: 'https://r2/a.png', mediaUrls: [] }, errors: [] }),
        updates,
        publishCalls,
      });

      await svc.migratePendingBatch();

      expect(publishCalls).toHaveLength(1);
      // 不夹住的话应为 createdAt + 6h，远超 fixedNow —— 必须被夹到 fixedNow。
      expect(publishCalls[0]!.publishedAt.getTime()).toBe(fixedNow.getTime());
      expect(publishCalls[0]!.publishedAt.getTime()).toBeLessThanOrEqual(fixedNow.getTime());
    } finally {
      randomSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  // stranded 路径必须保住不变式：publishedAt 非空 ⇔ 真的发布过。
  // 搬运失败止损的作品即便 createdAt 是随机过去时间，也绝不能被 publishIfPending 碰到。
  it('stranded 路径：publishIfPending 不被调用，publishedAt 不被写入', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const publishCalls: Array<{ id: string; publishedAt: Date }> = [];
    const svc = makeService({
      pending: [
        {
          id: 'p8',
          coverImage: 'https://ext/x.png',
          mediaUrls: [],
          mediaMigrationAttempts: 2,
          createdAt: new Date(Date.now() - DAY_MS),
        },
      ],
      migrate: () => ({ data: { coverImage: 'https://ext/x.png', mediaUrls: [] }, errors: ['coverImage: timeout'] }),
      updates,
      publishCalls,
    });

    const res = await svc.migratePendingBatch({ maxAttempts: 3 });

    expect(res.stranded).toBe(1);
    expect(publishCalls).toEqual([]);
    expect(updates[0]!.data).not.toHaveProperty('publishedAt');
  });

  // 这条只保证「整批都被处理一次」，对并发度无约束；
  // 并发行为由 run-with-concurrency.spec.ts 直接覆盖。
  it('整批作品都被更新一次', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pending: PendingPost[] = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      coverImage: `https://ext/${i}.png`,
      mediaUrls: [],
      mediaMigrationAttempts: 0,
      createdAt: new Date(Date.now() - DAY_MS),
    }));
    const svc = makeService({
      pending,
      migrate: (d) => ({ data: d, errors: [] }),
      updates,
    });
    const res = await svc.migratePendingBatch({ concurrency: 4 });
    expect(res.scanned).toBe(12);
    expect(new Set(updates.map((u) => u.id)).size).toBe(12);
  });
});
