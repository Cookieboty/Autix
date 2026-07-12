import { ForbiddenException } from '@nestjs/common';
import { GalleryService } from './gallery.service';

/**
 * Plan C Task 4：投稿闭环安全测试。
 * - fail-closed 归属：FROM_GENERATION 的 generation 不存在 / 不属于作者 → 一律 403，
 *   查询异常直接向上抛（不再 best-effort 放行）。
 * - 元数据快照：prompt/model/width/height 从 generation 记录快照，不信任 DTO。
 * - referenceImage 授权：仅 dto.allowPublicReference===true 或参考图本身是公开可复用
 *   站内资源时才快照，否则默认 null。
 */

interface MockImageGeneration {
  userId: string;
  resolvedPrompt: string;
  modelUsed: string;
  width: number | null;
  height: number | null;
  referenceImage: string | null;
}

function makeService(overrides: {
  imageGenerations?: Record<string, MockImageGeneration>;
  findImageGenerationOwnerImpl?: (id: string) => Promise<MockImageGeneration | null>;
  isReferenceImagePubliclyReusable?: boolean;
}) {
  const repo = {
    findImageGenerationOwner:
      overrides.findImageGenerationOwnerImpl ??
      (async (id: string) => overrides.imageGenerations?.[id] ?? null),
    findVideoGenerationOwner: async () => null,
    isReferenceImagePubliclyReusable: async () =>
      overrides.isReferenceImagePubliclyReusable ?? false,
    create: async (data: Record<string, unknown>) => ({ id: 'post-1', ...data }),
  };
  return new GalleryService(repo as never, {} as never, {} as never);
}

describe('GalleryService.createSubmission — fail-closed 归属校验', () => {
  const authorId = 'user-me';
  const myGenId = 'gen-mine';
  const otherUsersGenId = 'gen-other';

  const myGen: MockImageGeneration = {
    userId: authorId,
    resolvedPrompt: 'a cat wearing sunglasses',
    modelUsed: 'flux-pro',
    width: 1024,
    height: 768,
    referenceImage: 'https://cdn.example.com/ref.png',
  };

  it('FROM_GENERATION 投稿：generation 不属于作者 → 拒绝', async () => {
    const service = makeService({
      imageGenerations: { [otherUsersGenId]: { ...myGen, userId: 'someone-else' } },
    });
    await expect(
      service.createSubmission(authorId, {
        kind: 'IMAGE',
        category: 'ai_generated',
        sourceType: 'FROM_GENERATION',
        imageGenerationId: otherUsersGenId,
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('FROM_GENERATION 投稿：generation 不存在 → 拒绝（fail-closed，不再放行）', async () => {
    const service = makeService({ imageGenerations: {} });
    await expect(
      service.createSubmission(authorId, {
        kind: 'IMAGE',
        category: 'ai_generated',
        sourceType: 'FROM_GENERATION',
        imageGenerationId: 'does-not-exist',
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('查询异常直接向上抛出，不吞异常放行', async () => {
    const service = makeService({
      findImageGenerationOwnerImpl: async () => {
        throw new Error('db down');
      },
    });
    await expect(
      service.createSubmission(authorId, {
        kind: 'IMAGE',
        category: 'ai_generated',
        sourceType: 'FROM_GENERATION',
        imageGenerationId: myGenId,
      } as never),
    ).rejects.toThrow('db down');
  });

  it('generation 属于作者本人 → 放行并成功创建投稿', async () => {
    const service = makeService({ imageGenerations: { [myGenId]: myGen } });
    const post = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: myGenId,
    } as never);
    expect(post.id).toBe('post-1');
  });
});

describe('GalleryService.createSubmission — 元数据快照 + 参考图授权', () => {
  const authorId = 'user-me';
  const myGenId = 'gen-mine';

  const myGen: MockImageGeneration = {
    userId: authorId,
    resolvedPrompt: 'a cat wearing sunglasses',
    modelUsed: 'flux-pro',
    width: 1024,
    height: 768,
    referenceImage: 'https://cdn.example.com/ref.png',
  };

  it('未授权参考图默认不快照，但 prompt/model/width/height 仍从 generation 快照', async () => {
    const service = makeService({
      imageGenerations: { [myGenId]: myGen },
      isReferenceImagePubliclyReusable: false,
    });
    const post = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: myGenId,
      allowPublicReference: false,
    } as never);
    expect(post.referenceImage).toBeNull();
    expect(post.prompt).toBe(myGen.resolvedPrompt);
    expect(post.model).toBe(myGen.modelUsed);
    expect(post.width).toBe(myGen.width);
    expect(post.height).toBe(myGen.height);
  });

  it('allowPublicReference===true 时快照参考图', async () => {
    const service = makeService({
      imageGenerations: { [myGenId]: myGen },
      isReferenceImagePubliclyReusable: false,
    });
    const post = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: myGenId,
      allowPublicReference: true,
    } as never);
    expect(post.referenceImage).toBe(myGen.referenceImage);
  });

  it('未显式授权，但参考图本身是公开可复用站内资源时也快照', async () => {
    const service = makeService({
      imageGenerations: { [myGenId]: myGen },
      isReferenceImagePubliclyReusable: true,
    });
    const post = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: myGenId,
    } as never);
    expect(post.referenceImage).toBe(myGen.referenceImage);
  });

  it('DTO 未提供 allowPublicReference（默认 undefined）→ 不视为已授权', async () => {
    const service = makeService({
      imageGenerations: { [myGenId]: myGen },
      isReferenceImagePubliclyReusable: false,
    });
    const post = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: myGenId,
    } as never);
    expect(post.referenceImage).toBeNull();
  });

  it('USER_UPLOAD 来源不触发归属校验、不快照元数据', async () => {
    const service = makeService({});
    const post = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'USER_UPLOAD',
      mediaUrls: ['https://cdn/a.png'],
    } as never);
    expect(post.prompt).toBeUndefined();
    expect(post.referenceImage).toBeNull();
  });
});
