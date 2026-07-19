import { GalleryRepository } from './gallery.repository';

/**
 * 视频投稿归属校验必须查 video_clip_generations（现役表）。
 *
 * 回归背景：此前查的是 video_generations —— 该表全仓无 update，行永远停在 pending、
 * generatedVideos 恒空，导致视频投稿的 mediaUrls 永远派生为空。这里锁住「查哪张表」
 * 和「列名映射」两件事，任何一处改回去都会失败。
 */
function makeRepo(row: unknown) {
  const findUnique = vi.fn().mockResolvedValue(row);
  const prisma = {
    video_clip_generations: { findUnique },
    // 故意留一个会炸的第一代表：一旦有人改回去查它，测试立刻红。
    video_generations: {
      findUnique: () => {
        throw new Error('video_generations 是废弃的第一代表，不应再被查询');
      },
    },
  };
  return { repo: new GalleryRepository(prisma as never), findUnique };
}

describe('GalleryRepository.findVideoGenerationOwner', () => {
  it('查 clip 表，并把列名映射成与 image 侧同构的形状', async () => {
    const { repo, findUnique } = makeRepo({
      userId: 'u1',
      resolvedPrompt: 'a cat surfing',
      model: 'seedance-2-0-fast',
      videoUrl: 'https://cdn.test/v.mp4',
      params: {
        content: [
          { type: 'text', text: 'a cat surfing' },
          { type: 'image_url', image_url: { url: 'https://cdn.test/ref.png' } },
        ],
      },
    });

    const gen = await repo.findVideoGenerationOwner('clip-gen-1');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'clip-gen-1' } }),
    );
    expect(gen).toEqual({
      userId: 'u1',
      resolvedPrompt: 'a cat surfing',
      modelUsed: 'seedance-2-0-fast',
      referenceImage: 'https://cdn.test/ref.png',
      generatedVideos: ['https://cdn.test/v.mp4'],
    });
  });

  it('未完成的生成（videoUrl 为空）→ generatedVideos 为空数组，投稿会被上层挡下', async () => {
    const { repo } = makeRepo({
      userId: 'u1',
      resolvedPrompt: 'p',
      model: 'm',
      videoUrl: null,
      params: {},
    });

    const gen = await repo.findVideoGenerationOwner('clip-gen-2');
    expect(gen?.generatedVideos).toEqual([]);
    expect(gen?.referenceImage).toBeNull();
  });

  it('记录不存在 → null（上层 fail-closed 抛 403）', async () => {
    const { repo } = makeRepo(null);
    await expect(repo.findVideoGenerationOwner('nope')).resolves.toBeNull();
  });
});
