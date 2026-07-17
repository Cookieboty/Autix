import { GalleryRepository } from './gallery.repository';

describe('GalleryRepository.publishIfPending', () => {
  it('以 status=PENDING 为原子条件发布，并回写 publishedAt', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repo = new GalleryRepository({ gallery_posts: { updateMany } } as never);

    const count = await repo.publishIfPending('p1');

    expect(count).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: 'PENDING', sourceType: 'ADMIN_CURATED' },
      data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
    });
  });

  it('作品已被管理员改状态时返回 0，不发布', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const repo = new GalleryRepository({ gallery_posts: { updateMany } } as never);

    expect(await repo.publishIfPending('p2')).toBe(0);
  });
});

// Fix 3：自动发布闸门此前只靠 `mediaMigrated @default(true)` 这个巧合撑着——
// findPostsPendingMediaMigration / publishIfPending 都只按 mediaMigrated/id 过滤，
// 未显式限定 sourceType=ADMIN_CURATED。哪天别的代码路径给非管理端投稿也回填
// mediaMigrated=false，worker 就会把它们静默绕过审核发布。把隐含假设改成显式谓词。
describe('GalleryRepository — 迁移队列显式限定 ADMIN_CURATED（Fix 3）', () => {
  it('findPostsPendingMediaMigration 只取 ADMIN_CURATED 且 mediaMigrated=false 的作品', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new GalleryRepository({ gallery_posts: { findMany } } as never);

    await repo.findPostsPendingMediaMigration(3, 20);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mediaMigrated: false,
          mediaMigrationAttempts: { lt: 3 },
          sourceType: 'ADMIN_CURATED',
        },
      }),
    );
  });

  it('publishIfPending 的 updateMany where 显式限定 sourceType=ADMIN_CURATED', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repo = new GalleryRepository({ gallery_posts: { updateMany } } as never);

    await repo.publishIfPending('p3');

    const call = updateMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where.sourceType).toBe('ADMIN_CURATED');
  });
});
