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
}) {
  const repo = {
    findPostsPendingMediaMigration: async () => opts.pending,
    update: async (id: string, data: Record<string, unknown>) => {
      opts.updates.push({ id, data });
      return { id, ...data };
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

  it('迁移成功：回写 R2 新链接并标记 mediaMigrated=true', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const svc = makeService({
      pending: [{ id: 'p1', coverImage: 'https://ext/a.png', mediaUrls: ['https://ext/a.png'], mediaMigrationAttempts: 0 }],
      migrate: () => ({
        data: { coverImage: 'https://r2/a.png', mediaUrls: ['https://r2/a.png'] },
        errors: [],
      }),
      updates,
    });
    const res = await svc.migratePendingBatch();
    expect(res.settled).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.data).toMatchObject({
      coverImage: 'https://r2/a.png',
      mediaUrls: ['https://r2/a.png'],
      mediaMigrated: true,
      mediaMigrationAttempts: 1,
    });
  });

  it('部分失败且未达上限：仅自增尝试次数，保持 mediaMigrated=false 待重试', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const svc = makeService({
      pending: [{ id: 'p2', coverImage: 'https://ext/x.png', mediaUrls: [], mediaMigrationAttempts: 0 }],
      migrate: () => ({ data: { coverImage: 'https://ext/x.png', mediaUrls: [] }, errors: ['coverImage: 403'] }),
      updates,
    });
    const res = await svc.migratePendingBatch({ maxAttempts: 3 });
    expect(res.retry).toBe(1);
    expect(updates[0]!.data).toMatchObject({ mediaMigrated: false, mediaMigrationAttempts: 1 });
  });

  it('失败且达到上限：放弃重试，标记 mediaMigrated=true 止损', async () => {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const svc = makeService({
      pending: [{ id: 'p3', coverImage: 'https://ext/x.png', mediaUrls: [], mediaMigrationAttempts: 2 }],
      migrate: () => ({ data: { coverImage: 'https://ext/x.png', mediaUrls: [] }, errors: ['coverImage: timeout'] }),
      updates,
    });
    const res = await svc.migratePendingBatch({ maxAttempts: 3 });
    expect(res.settled).toBe(1);
    expect(updates[0]!.data).toMatchObject({ mediaMigrated: true, mediaMigrationAttempts: 3 });
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
