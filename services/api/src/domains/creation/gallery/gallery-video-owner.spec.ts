import { GalleryRepository } from './gallery.repository';

/**
 * 视频投稿归属校验必须查 video_clip_generations（现役表）。
 *
 * 回归背景：此前查的是 video_generations —— 该表全仓无 update，行永远停在 pending、
 * generatedVideos 恒空，导致视频投稿的 mediaUrls 永远派生为空。该表现已删除。
 *
 * 这里锁住列名映射，尤其是两个曾经写错的点：
 * 1. 参考图必须从**真实的** params 形状里取（materials[] / providerRequest.content[]），
 *    不是顶层 content[]——那个形状生产上不存在，会让参考图快照静默恒为 null；
 * 2. coverImage 必须单独给，不能沿用「取 mediaUrls[0]」——视频的 [0] 是 mp4。
 */
function makeRepo(row: unknown) {
  const findUnique = vi.fn().mockResolvedValue(row);
  const prisma = {
    video_clip_generations: { findUnique },
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
      thumbnailUrl: null,
      lastFrameUrl: 'https://cdn.test/last.jpg',
      durationSec: 5,
      // 直连链路的真实 params 形状（buildDirectGenerationParamsSnapshot 产出）。
      // 别改成顶层 content[] —— 那个形状生产上不存在。
      params: {
        schemaVersion: 1,
        mode: 'direct',
        options: { duration: 5, ratio: '16:9' },
        materials: [{ role: 'first_frame', url: 'https://cdn.test/ref.png' }],
        providerRequest: {
          content: [{ type: 'text', text: 'a cat surfing' }],
        },
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
      // 封面不能是 mp4：投稿的 coverImage 会被当 <img src> / <video poster> 用
      coverImage: 'https://cdn.test/last.jpg',
      // 展示字段也从生成记录取，不采信 DTO
      aspectRatio: '16:9',
      durationSec: 5,
    });
  });

  it('参考图退到 providerRequest.content[]（materials 里没有图时）', async () => {
    const { repo } = makeRepo({
      userId: 'u1',
      resolvedPrompt: 'p',
      model: 'm',
      videoUrl: 'https://cdn.test/v.mp4',
      thumbnailUrl: 'https://cdn.test/thumb.jpg',
      lastFrameUrl: 'https://cdn.test/last.jpg',
      params: {
        mode: 'direct',
        materials: [{ role: 'reference_audio', url: 'https://cdn.test/a.mp3' }],
        providerRequest: {
          content: [
            { type: 'text', text: 'p' },
            { type: 'image_url', image_url: { url: 'https://cdn.test/ref2.png' } },
          ],
        },
      },
    });

    const gen = await repo.findVideoGenerationOwner('clip-gen-3');
    expect(gen?.referenceImage).toBe('https://cdn.test/ref2.png');
    // thumbnailUrl 优先于 lastFrameUrl
    expect(gen?.coverImage).toBe('https://cdn.test/thumb.jpg');
  });

  it('分镜/项目链路的 params（无输入媒体）→ 参考图为 null，不炸', async () => {
    const { repo } = makeRepo({
      userId: 'u1',
      resolvedPrompt: 'p',
      model: 'm',
      videoUrl: 'https://cdn.test/v.mp4',
      thumbnailUrl: null,
      lastFrameUrl: null,
      // normalizeClipParams 产出的模板参数记录，不带 materials / providerRequest
      params: { duration: 5, ratio: '16:9', resolution: '1080p', generateAudio: true },
    });

    const gen = await repo.findVideoGenerationOwner('clip-gen-4');
    expect(gen?.referenceImage).toBeNull();
    expect(gen?.coverImage).toBeNull();
  });

  it('未完成的生成（videoUrl 为空）→ generatedVideos 为空数组，投稿会被上层挡下', async () => {
    const { repo } = makeRepo({
      userId: 'u1',
      resolvedPrompt: 'p',
      model: 'm',
      videoUrl: null,
      thumbnailUrl: null,
      lastFrameUrl: null,
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
