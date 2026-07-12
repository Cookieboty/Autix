import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ResourceType } from '../../platform/prisma/generated';
import { GalleryService } from './gallery.service';

/**
 * Plan C Task 4：投稿闭环安全测试。
 * - fail-closed 归属：FROM_GENERATION 的 generation 不存在 / 不属于作者 → 一律 403，
 *   查询异常直接向上抛（不再 best-effort 放行）。
 * - 元数据快照：prompt/model/width/height 从 generation 记录快照，不信任 DTO。
 * - referenceImage 授权：仅 dto.allowPublicReference===true 或参考图本身是公开可复用
 *   站内资源时才快照，否则默认 null。
 *
 * Task 4.5：站内来源写入守卫。
 * - FROM_GENERATION：mediaUrls/coverImage 完全从 generation.generatedImages 派生，忽略 DTO。
 * - USER_UPLOAD：mediaUrls/coverImage 必须命中站内存储域名（r2.getPublicBaseUrl），否则 400。
 */

/** 测试用站内存储域名基准，与 r2 mock 的 getPublicBaseUrl 返回值保持一致。 */
const R2_PUBLIC_BASE = 'https://cdn';

interface MockImageGeneration {
  userId: string;
  resolvedPrompt: string;
  modelUsed: string;
  width: number | null;
  height: number | null;
  referenceImage: string | null;
  generatedImages?: string[];
}

function makeService(overrides: {
  imageGenerations?: Record<string, MockImageGeneration>;
  findImageGenerationOwnerImpl?: (id: string) => Promise<MockImageGeneration | null>;
  isReferenceImagePubliclyReusable?: boolean;
  posts?: Record<string, Record<string, unknown>>;
  captureUpdate?: (id: string, data: Record<string, unknown>) => void;
  r2PublicBaseUrl?: string;
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
  const r2 = {
    getPublicBaseUrl: async () => overrides.r2PublicBaseUrl ?? R2_PUBLIC_BASE,
  };
  return new GalleryService(repo as never, {} as never, r2 as never);
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
    generatedImages: ['https://cdn/gen.png'],
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
    expect(post.mediaUrls).toEqual(myGen.generatedImages);
    expect(post.coverImage).toBe(myGen.generatedImages![0]);
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
    generatedImages: ['https://cdn/gen.png'],
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

describe('GalleryService.createSubmission — Task 4.5：站内来源写入守卫', () => {
  const authorId = 'user-me';
  const myGenId = 'gen-mine';

  const myGen: MockImageGeneration = {
    userId: authorId,
    resolvedPrompt: 'a cat wearing sunglasses',
    modelUsed: 'flux-pro',
    width: 1024,
    height: 768,
    referenceImage: null,
    generatedImages: ['https://cdn/real-a.png', 'https://cdn/real-b.png'],
  };

  it('FROM_GENERATION 忽略 DTO mediaUrls，用 generation.generatedImages', async () => {
    const service = makeService({ imageGenerations: { [myGenId]: myGen } });
    const post = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: myGenId,
      mediaUrls: ['https://evil.com/x.png'],
    } as never);
    expect(post.mediaUrls).toEqual(myGen.generatedImages); // 不采信 DTO
    expect(post.coverImage).toBe(myGen.generatedImages![0]);
  });

  it('FROM_GENERATION：generation.generatedImages 为空 → 400（无可投稿媒体）', async () => {
    const service = makeService({
      imageGenerations: { [myGenId]: { ...myGen, generatedImages: [] } },
    });
    await expect(
      service.createSubmission(authorId, {
        kind: 'IMAGE',
        category: 'ai_generated',
        sourceType: 'FROM_GENERATION',
        imageGenerationId: myGenId,
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('USER_UPLOAD 拒绝非站内存储域名 URL', async () => {
    const service = makeService({});
    await expect(
      service.createSubmission(authorId, {
        kind: 'IMAGE',
        category: 'ai_generated',
        sourceType: 'USER_UPLOAD',
        mediaUrls: ['https://evil.com/x.png'],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('USER_UPLOAD 拒绝非站内 coverImage（即便 mediaUrls 全部站内）', async () => {
    const service = makeService({});
    await expect(
      service.createSubmission(authorId, {
        kind: 'IMAGE',
        category: 'ai_generated',
        sourceType: 'USER_UPLOAD',
        mediaUrls: ['https://cdn/a.png'],
        coverImage: 'https://evil.com/cover.png',
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('USER_UPLOAD 站内 mediaUrls/coverImage 全部放行', async () => {
    const service = makeService({});
    const post = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'USER_UPLOAD',
      mediaUrls: ['https://cdn/a.png'],
      coverImage: 'https://cdn/a.png',
    } as never);
    expect(post.mediaUrls).toEqual(['https://cdn/a.png']);
    expect(post.coverImage).toBe('https://cdn/a.png');
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
    generatedImages: ['https://cdn/gen.png'],
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
    generatedImages: ['https://cdn/gen-a.png'],
  };
  const genBImage: MockImageGeneration = {
    userId: authorId,
    resolvedPrompt: 'prompt B',
    modelUsed: 'model-B',
    width: 1024,
    height: 1024,
    referenceImage: 'https://cdn.example.com/ref-b.png',
    generatedImages: ['https://cdn/gen-b.png'],
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

describe('GalleryService — Task 4.6：草稿 / 更新路径 bypass 关闭', () => {
  const authorId = 'user-me';

  const inStationGen: MockImageGeneration = {
    userId: authorId,
    resolvedPrompt: 'p',
    modelUsed: 'm',
    width: null,
    height: null,
    referenceImage: null,
    generatedImages: ['https://cdn/real.png'],
  };

  // ── createDraft ──────────────────────────────────────────────────────
  it('createDraft(USER_UPLOAD, evil.com) → 拒绝，不把外链落进 DRAFT', async () => {
    const service = makeService({});
    await expect(
      service.createDraft(authorId, {
        kind: 'IMAGE',
        sourceType: 'USER_UPLOAD',
        mediaUrls: ['https://evil.com/x.png'],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('createDraft(FROM_GENERATION, mediaUrls:[evil.com]) → 不采信 DTO，mediaUrls 存为空', async () => {
    const service = makeService({});
    const draft = await service.createDraft(authorId, {
      kind: 'IMAGE',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: 'gen-x',
      mediaUrls: ['https://evil.com/x.png'],
      coverImage: 'https://evil.com/x.png',
    } as never);
    expect(draft.mediaUrls).toEqual([]);
    expect(draft.coverImage).toBeNull();
  });

  // ── updateDraft ──────────────────────────────────────────────────────
  it('updateDraft(USER_UPLOAD, evil.com) → 拒绝', async () => {
    const draft = {
      id: 'd0', authorId, kind: 'IMAGE', status: 'DRAFT', sourceType: 'USER_UPLOAD',
      mediaUrls: [], coverImage: null,
    };
    const service = makeService({ posts: { d0: draft } });
    await expect(
      service.updateDraft(authorId, 'd0', { mediaUrls: ['https://evil.com/x.png'] } as never),
    ).rejects.toThrow(BadRequestException);
  });

  // ── submitDraft（强制点：内容变公开） ────────────────────────────────
  it('submitDraft：USER_UPLOAD 草稿即便已存 evil.com，提交时强制校验 host → 拒绝', async () => {
    const evilDraft = {
      id: 'd1', authorId, kind: 'IMAGE', status: 'DRAFT', sourceType: 'USER_UPLOAD',
      mediaUrls: ['https://evil.com/x.png'], coverImage: null,
      imageTemplateId: null, videoTemplateId: null,
      imageGenerationId: null, videoGenerationId: null,
    };
    const service = makeService({ posts: { d1: evilDraft } });
    await expect(service.submitDraft(authorId, 'd1')).rejects.toThrow(BadRequestException);
  });

  it('submitDraft：FROM_GENERATION 草稿存了 evil.com，提交后媒体=生成记录，不采信草稿', async () => {
    let captured: Record<string, unknown> | null = null;
    const evilDraft = {
      id: 'd2', authorId, kind: 'IMAGE', status: 'DRAFT', sourceType: 'FROM_GENERATION',
      mediaUrls: ['https://evil.com/x.png'], coverImage: 'https://evil.com/x.png',
      imageTemplateId: null, videoTemplateId: null,
      imageGenerationId: 'gen-y', videoGenerationId: null,
    };
    const service = makeService({
      imageGenerations: { 'gen-y': inStationGen },
      posts: { d2: evilDraft },
      captureUpdate: (_id, data) => { captured = data; },
    });
    await service.submitDraft(authorId, 'd2');
    expect(captured!.mediaUrls).toEqual(inStationGen.generatedImages);
    expect(captured!.coverImage).toBe(inStationGen.generatedImages![0]);
    expect(captured!.status).toBe('PENDING');
  });

  // ── updatePost（一次请求换外链） ─────────────────────────────────────
  it('updatePost：USER_UPLOAD 一次请求把 mediaUrls 换成 evil.com → 拒绝', async () => {
    const post = {
      id: 'p1', authorId, kind: 'IMAGE', status: 'PENDING', sourceType: 'USER_UPLOAD',
      mediaUrls: ['https://cdn/a.png'], coverImage: 'https://cdn/a.png',
      imageTemplateId: null, videoTemplateId: null,
      imageGenerationId: null, videoGenerationId: null,
    };
    const service = makeService({ posts: { p1: post } });
    await expect(
      service.updatePost(authorId, 'p1', { mediaUrls: ['https://evil.com/x.png'] } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('updatePost：USER_UPLOAD 只换 coverImage 为 evil.com → 拒绝', async () => {
    const post = {
      id: 'p1b', authorId, kind: 'IMAGE', status: 'PENDING', sourceType: 'USER_UPLOAD',
      mediaUrls: ['https://cdn/a.png'], coverImage: 'https://cdn/a.png',
      imageTemplateId: null, videoTemplateId: null,
      imageGenerationId: null, videoGenerationId: null,
    };
    const service = makeService({ posts: { p1b: post } });
    await expect(
      service.updatePost(authorId, 'p1b', {
        mediaUrls: ['https://cdn/a.png'],
        coverImage: 'https://evil.com/x.png',
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('updatePost：FROM_GENERATION 带 mediaUrls:[evil.com] → 用生成记录派生，忽略 DTO', async () => {
    let captured: Record<string, unknown> | null = null;
    const post = {
      id: 'p2', authorId, kind: 'IMAGE', status: 'PENDING', sourceType: 'FROM_GENERATION',
      mediaUrls: ['https://cdn/old.png'], coverImage: 'https://cdn/old.png',
      imageTemplateId: null, videoTemplateId: null,
      imageGenerationId: 'gen-z', videoGenerationId: null,
    };
    const service = makeService({
      imageGenerations: { 'gen-z': inStationGen },
      posts: { p2: post },
      captureUpdate: (_id, data) => { captured = data; },
    });
    await service.updatePost(authorId, 'p2', { mediaUrls: ['https://evil.com/x.png'] } as never);
    expect(captured!.mediaUrls).toEqual(inStationGen.generatedImages);
    expect(captured!.coverImage).toBe(inStationGen.generatedImages![0]);
  });
});

// ── download（Plan C Task 5）──────────────────────────────────────────────

/**
 * download 复用 assertLikeableOrFavoritable 的"仅 PUBLISHED"校验（404 不存在 / 400 未发布），
 * 与 like/favorite 完全一致。不同点：download 不去重——每次调用都必须真实触发
 * metrics.recordDownload（同步事务插事件 + INCR downloadCount），不能被短路/吞掉。
 */
function makeDownloadService(overrides: {
  posts?: Record<string, Record<string, unknown>>;
  recordDownloadImpl?: (...args: unknown[]) => Promise<unknown>;
}) {
  const repo = {
    findById: async (id: string) => overrides.posts?.[id] ?? null,
  };
  const recordDownload = jest.fn(
    overrides.recordDownloadImpl ?? (async () => ({ downloadCount: 1 })),
  );
  const metrics = { recordDownload };
  const r2 = {};
  const service = new GalleryService(repo as never, metrics as never, r2 as never);
  return { service, repo, metrics, recordDownload };
}

describe('GalleryService.download — 仅 PUBLISHED + 非幂等计数', () => {
  const publishedPost = {
    id: 'p-pub',
    authorId: 'author-1',
    status: 'PUBLISHED',
    mediaUrls: ['https://cdn/a.png', 'https://cdn/b.png'],
    coverImage: 'https://cdn/cover.png',
  };

  it('作品不存在 → 404', async () => {
    const { service } = makeDownloadService({ posts: {} });
    await expect(service.download('user-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it.each(['DRAFT', 'PENDING', 'HIDDEN', 'REJECTED', 'UNPUBLISHED', 'REMOVED'])(
    '状态为 %s（非 PUBLISHED）→ 拒绝下载（400），且不触发计数',
    async (status) => {
      const { service, recordDownload } = makeDownloadService({
        posts: { p1: { ...publishedPost, id: 'p1', status } },
      });
      await expect(service.download('user-1', 'p1')).rejects.toThrow(BadRequestException);
      expect(recordDownload).not.toHaveBeenCalled();
    },
  );

  it('PUBLISHED 作品：返回 mediaUrls[0] 作为下载 URL，并调用 metrics.recordDownload 一次', async () => {
    const { service, recordDownload } = makeDownloadService({
      posts: { 'p-pub': publishedPost },
    });
    const result = await service.download('user-9', 'p-pub');
    expect(result).toEqual({ downloadUrl: 'https://cdn/a.png' });
    expect(recordDownload).toHaveBeenCalledTimes(1);
    expect(recordDownload).toHaveBeenCalledWith(
      ResourceType.GALLERY_POST,
      'p-pub',
      'user-9',
    );
  });

  it('mediaUrls 为空时兜底 coverImage', async () => {
    const { service } = makeDownloadService({
      posts: { p2: { ...publishedPost, id: 'p2', mediaUrls: [] } },
    });
    const result = await service.download('user-1', 'p2');
    expect(result).toEqual({ downloadUrl: publishedPost.coverImage });
  });

  it('mediaUrls 和 coverImage 均缺失 → 404（无可下载资源）', async () => {
    const { service, recordDownload } = makeDownloadService({
      posts: { p3: { ...publishedPost, id: 'p3', mediaUrls: [], coverImage: null } },
    });
    await expect(service.download('user-1', 'p3')).rejects.toThrow(NotFoundException);
    expect(recordDownload).not.toHaveBeenCalled();
  });

  it('非幂等：同一用户连续下载同一作品两次 → metrics.recordDownload 被调用两次（不去重）', async () => {
    let calls = 0;
    const { service, recordDownload } = makeDownloadService({
      posts: { 'p-pub': publishedPost },
      recordDownloadImpl: async () => {
        calls += 1;
        return { downloadCount: calls };
      },
    });
    await service.download('user-1', 'p-pub');
    await service.download('user-1', 'p-pub');
    expect(recordDownload).toHaveBeenCalledTimes(2);
    expect(calls).toBe(2);
  });
});
