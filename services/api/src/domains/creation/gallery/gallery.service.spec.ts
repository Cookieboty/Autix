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
  posts?: Record<string, Record<string, unknown>>;
  captureUpdate?: (id: string, data: Record<string, unknown>) => void;
}) {
  const repo = {
    findImageGenerationOwner:
      overrides.findImageGenerationOwnerImpl ??
      (async (id: string) => overrides.imageGenerations?.[id] ?? null),
    findVideoGenerationOwner: async () => null,
    isReferenceImagePubliclyReusable: async () =>
      overrides.isReferenceImagePubliclyReusable ?? false,
    create: async (data: Record<string, unknown>) => ({ id: 'post-1', ...data }),
    findById: async (id: string) => overrides.posts?.[id] ?? null,
    update: async (id: string, data: Record<string, unknown>) => {
      overrides.captureUpdate?.(id, data);
      return { id, ...(overrides.posts?.[id] ?? {}), ...data };
    },
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

describe('GalleryService.submitDraft — 草稿→提交时快照元数据', () => {
  const authorId = 'user-me';
  const myGenId = 'gen-mine';
  const draftId = 'draft-1';

  const myGen: MockImageGeneration = {
    userId: authorId,
    resolvedPrompt: 'a cat wearing sunglasses',
    modelUsed: 'flux-pro',
    width: 1024,
    height: 768,
    referenceImage: 'https://cdn.example.com/ref.png',
  };

  function draftPost(): Record<string, unknown> {
    return {
      id: draftId,
      authorId,
      kind: 'IMAGE',
      status: 'DRAFT',
      sourceType: 'FROM_GENERATION',
      mediaUrls: ['https://cdn/a.png'],
      imageTemplateId: null,
      videoTemplateId: null,
      imageGenerationId: myGenId,
      videoGenerationId: null,
    };
  }

  it('FROM_GENERATION 草稿 submitDraft 后：prompt/model/width/height 从 generation 快照，referenceImage 未公开可复用 → null', async () => {
    let captured: Record<string, unknown> | null = null;
    const service = makeService({
      imageGenerations: { [myGenId]: myGen },
      isReferenceImagePubliclyReusable: false,
      posts: { [draftId]: draftPost() },
      captureUpdate: (_id, data) => {
        captured = data;
      },
    });
    await service.submitDraft(authorId, draftId);
    expect(captured).not.toBeNull();
    expect(captured!.status).toBe('PENDING');
    expect(captured!.prompt).toBe(myGen.resolvedPrompt);
    expect(captured!.model).toBe(myGen.modelUsed);
    expect(captured!.width).toBe(myGen.width);
    expect(captured!.height).toBe(myGen.height);
    expect(captured!.referenceImage).toBeNull();
  });

  it('草稿路径不认用户 flag：即便参考图公开可复用才快照，否则保持 null', async () => {
    let captured: Record<string, unknown> | null = null;
    const service = makeService({
      imageGenerations: { [myGenId]: myGen },
      isReferenceImagePubliclyReusable: true,
      posts: { [draftId]: draftPost() },
      captureUpdate: (_id, data) => {
        captured = data;
      },
    });
    await service.submitDraft(authorId, draftId);
    expect(captured!.referenceImage).toBe(myGen.referenceImage);
  });

  it('generation 不属于作者 → submitDraft 拒绝（fail-closed）', async () => {
    const service = makeService({
      imageGenerations: { [myGenId]: { ...myGen, userId: 'someone-else' } },
      posts: { [draftId]: draftPost() },
    });
    await expect(service.submitDraft(authorId, draftId)).rejects.toThrow(ForbiddenException);
  });

  it('USER_UPLOAD 草稿 submitDraft 不写入生成元数据', async () => {
    let captured: Record<string, unknown> | null = null;
    const uploadDraft = {
      ...draftPost(),
      sourceType: 'USER_UPLOAD',
      imageGenerationId: null,
    };
    const service = makeService({
      posts: { [draftId]: uploadDraft },
      captureUpdate: (_id, data) => {
        captured = data;
      },
    });
    await service.submitDraft(authorId, draftId);
    expect(captured!.status).toBe('PENDING');
    expect(captured!).not.toHaveProperty('prompt');
    expect(captured!).not.toHaveProperty('referenceImage');
  });
});

describe('GalleryService.updatePost — 仅在来源/生成引用变动时才重新快照', () => {
  const authorId = 'user-me';
  const genA = 'gen-a';
  const genB = 'gen-b';
  const postId = 'post-x';

  const genAImage: MockImageGeneration = {
    userId: authorId,
    resolvedPrompt: 'prompt A',
    modelUsed: 'model-A',
    width: 512,
    height: 512,
    referenceImage: 'https://cdn.example.com/ref-a.png',
  };
  const genBImage: MockImageGeneration = {
    userId: authorId,
    resolvedPrompt: 'prompt B',
    modelUsed: 'model-B',
    width: 1024,
    height: 1024,
    referenceImage: 'https://cdn.example.com/ref-b.png',
  };

  /** 已通过 createSubmission(allowPublicReference:true) 写入了一张“非公开可复用”的私有参考图。 */
  function existingPost(): Record<string, unknown> {
    return {
      id: postId,
      authorId,
      kind: 'IMAGE',
      status: 'PENDING',
      sourceType: 'FROM_GENERATION',
      mediaUrls: ['https://cdn/a.png'],
      imageTemplateId: null,
      videoTemplateId: null,
      imageGenerationId: genA,
      videoGenerationId: null,
      prompt: 'prompt A',
      model: 'model-A',
      width: 512,
      height: 512,
      referenceImage: 'https://cdn.example.com/ref-a.png',
    };
  }

  it('只改无关字段（title）→ 不重新快照，已授权的私有 referenceImage/prompt/width 存活', async () => {
    let captured: Record<string, unknown> | null = null;
    const service = makeService({
      imageGenerations: { [genA]: genAImage },
      isReferenceImagePubliclyReusable: false, // 该私有参考图并非站内公开可复用
      posts: { [postId]: existingPost() },
      captureUpdate: (_id, data) => {
        captured = data;
      },
    });
    await service.updatePost(authorId, postId, { title: '新标题' } as never);
    expect(captured!.title).toBe('新标题');
    // 未改来源 → 不应写入任何元数据字段（保留库中原值，不被 null 覆盖）
    expect(captured!).not.toHaveProperty('referenceImage');
    expect(captured!).not.toHaveProperty('prompt');
    expect(captured!).not.toHaveProperty('width');
    expect(captured!).not.toHaveProperty('height');
    expect(captured!).not.toHaveProperty('model');
  });

  it('改 imageGenerationId → 用新 generation 重新快照（保守分支 referenceImage=null）', async () => {
    let captured: Record<string, unknown> | null = null;
    const service = makeService({
      imageGenerations: { [genA]: genAImage, [genB]: genBImage },
      isReferenceImagePubliclyReusable: false,
      posts: { [postId]: existingPost() },
      captureUpdate: (_id, data) => {
        captured = data;
      },
    });
    await service.updatePost(authorId, postId, { imageGenerationId: genB } as never);
    expect(captured!.prompt).toBe(genBImage.resolvedPrompt);
    expect(captured!.model).toBe(genBImage.modelUsed);
    expect(captured!.width).toBe(genBImage.width);
    expect(captured!.height).toBe(genBImage.height);
    expect(captured!.referenceImage).toBeNull();
  });

  it('改 imageGenerationId 指向他人 generation → Forbidden（fail-closed）', async () => {
    const service = makeService({
      imageGenerations: {
        [genA]: genAImage,
        [genB]: { ...genBImage, userId: 'someone-else' },
      },
      posts: { [postId]: existingPost() },
    });
    await expect(
      service.updatePost(authorId, postId, { imageGenerationId: genB } as never),
    ).rejects.toThrow(ForbiddenException);
  });
});
