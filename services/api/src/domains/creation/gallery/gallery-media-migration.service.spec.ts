import { GalleryMediaMigrationService } from './gallery-media-migration.service';

type PendingPost = {
  id: string;
  coverImage: string | null;
  mediaUrls: string[];
  mediaMigrationAttempts: number;
};

function makeService(opts: {
  pending: PendingPost[];
  migrate: (data: Record<string, unknown>) => { data: Record<string, unknown>; errors: string[] };
  updates: Array<{ id: string; data: Record<string, unknown> }>;
  published?: string[];
  publishCount?: number;
}) {
  const repo = {
    findPostsPendingMediaMigration: async () => opts.pending,
    update: async (id: string, data: Record<string, unknown>) => {
      opts.updates.push({ id, data });
      return { id, ...data };
    },
    publishIfPending: async (id: string) => {
      opts.published?.push(id);
      return opts.publishCount ?? 1;
    },
  };
  const migration = {
    migrateMediaFields: async (data: Record<string, unknown>) => opts.migrate(data),
  };
  return new GalleryMediaMigrationService(repo as never, migration as never);
}

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
        { id: 'p1', coverImage: 'https://ext/a.png', mediaUrls: ['https://ext/a.png'], mediaMigrationAttempts: 0 },
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
      pending: [{ id: 'p2', coverImage: 'https://ext/x.png', mediaUrls: [], mediaMigrationAttempts: 0 }],
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
      pending: [{ id: 'p3', coverImage: 'https://ext/x.png', mediaUrls: [], mediaMigrationAttempts: 2 }],
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
        { id: 'p4', coverImage: 'https://ext/c.png', mediaUrls: ['https://ext/a.png', 'https://ext/b.png'], mediaMigrationAttempts: 0 },
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
      pending: [{ id: 'p5', coverImage: 'https://ext/a.png', mediaUrls: [], mediaMigrationAttempts: 0 }],
      migrate: () => ({ data: { coverImage: 'https://r2/a.png', mediaUrls: [] }, errors: [] }),
      updates,
      publishCount: 0,
    });

    const res = await svc.migratePendingBatch();

    expect(res.published).toBe(0);
    expect(updates[0]!.data).toMatchObject({ mediaMigrated: true });
  });

  it('并发处理整批（所有作品都被更新一次）', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pending: PendingPost[] = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      coverImage: `https://ext/${i}.png`,
      mediaUrls: [],
      mediaMigrationAttempts: 0,
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
