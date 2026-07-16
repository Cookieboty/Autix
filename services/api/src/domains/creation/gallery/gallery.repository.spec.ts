import { GalleryRepository } from './gallery.repository';

describe('GalleryRepository.publishIfPending', () => {
  it('以 status=PENDING 为原子条件发布，并回写 publishedAt', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repo = new GalleryRepository({ gallery_posts: { updateMany } } as never);

    const count = await repo.publishIfPending('p1');

    expect(count).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: 'PENDING' },
      data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
    });
  });

  it('作品已被管理员改状态时返回 0，不发布', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const repo = new GalleryRepository({ gallery_posts: { updateMany } } as never);

    expect(await repo.publishIfPending('p2')).toBe(0);
  });
});
