import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GalleryStatus, ResourceType } from '../../platform/prisma/generated';
import { GalleryRepository } from './gallery.repository';
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
  activePosts?: Record<string, { id: string; status: string } | null>;
  captureCreate?: (data: Record<string, unknown>) => void;
  createImpl?: (data: Record<string, unknown>) => Promise<unknown>;
  findActivePostImpl?: (imageGenerationId: string) => Promise<{ id: string; status: string } | null>;
}) {
  const repo = {
    findImageGenerationOwner:
      overrides.findImageGenerationOwnerImpl ??
      (async (id: string) => overrides.imageGenerations?.[id] ?? null),
    findVideoGenerationOwner: async () => null,
    isReferenceImagePubliclyReusable: async () =>
      overrides.isReferenceImagePubliclyReusable ?? false,
    findActivePostByImageGenerationId:
      overrides.findActivePostImpl ??
      (async (imageGenerationId: string) => overrides.activePosts?.[imageGenerationId] ?? null),
    create: async (data: Record<string, unknown>) => {
      if (overrides.createImpl) return overrides.createImpl(data);
      overrides.captureCreate?.(data);
      return { id: 'post-new', ...data };
    },
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
    const post: any = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: myGenId,
    } as never);
    expect(post.id).toBe('post-new');
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
    const post: any = await service.createSubmission(authorId, {
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
    const post: any = await service.createSubmission(authorId, {
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
    const post: any = await service.createSubmission(authorId, {
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
    const post: any = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'ai_generated',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: myGenId,
    } as never);
    expect(post.referenceImage).toBeNull();
  });

  it('USER_UPLOAD 来源不触发归属校验、不快照元数据', async () => {
    const service = makeService({});
    const post: any = await service.createSubmission(authorId, {
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
    const post: any = await service.createSubmission(authorId, {
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
    const post: any = await service.createSubmission(authorId, {
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

// ── favorite/unfavorite（Plan C Task 10：改走 FavoriteLibraryService）─────

function makeFavoriteService(overrides: {
  posts?: Record<string, Record<string, unknown>>;
  favoriteLibrary?: { favorite?: jest.Mock; unfavorite?: jest.Mock };
}) {
  const repo = {
    findById: async (id: string) => overrides.posts?.[id] ?? null,
  };
  const favoriteLibrary = {
    favorite: jest.fn().mockResolvedValue({ favorited: true }),
    unfavorite: jest.fn().mockResolvedValue({ favorited: false }),
    ...(overrides.favoriteLibrary ?? {}),
  };
  const service = new GalleryService(
    repo as never,
    {} as never,
    {} as never,
    undefined,
    favoriteLibrary as never,
  );
  return { service, repo, favoriteLibrary };
}

describe('GalleryService.favorite/unfavorite — 单事务收藏耦合(Plan C Task 10)', () => {
  const publishedPost = { id: 'p-pub', status: 'PUBLISHED' };

  it('favorite：仅 PUBLISHED 可收藏，委托给 FavoriteLibraryService.favorite', async () => {
    const { service, favoriteLibrary } = makeFavoriteService({ posts: { 'p-pub': publishedPost } });
    await service.favorite('user-1', 'p-pub');
    expect(favoriteLibrary.favorite).toHaveBeenCalledWith('user-1', ResourceType.GALLERY_POST, 'p-pub');
  });

  it.each(['DRAFT', 'PENDING', 'HIDDEN', 'REJECTED', 'UNPUBLISHED', 'REMOVED'])(
    'favorite：状态为 %s（非 PUBLISHED）→ 拒绝(400)，不调用 FavoriteLibraryService',
    async (status) => {
      const { service, favoriteLibrary } = makeFavoriteService({
        posts: { p1: { ...publishedPost, id: 'p1', status } },
      });
      await expect(service.favorite('user-1', 'p1')).rejects.toThrow(BadRequestException);
      expect(favoriteLibrary.favorite).not.toHaveBeenCalled();
    },
  );

  it('favorite：作品不存在 → 404', async () => {
    const { service } = makeFavoriteService({ posts: {} });
    await expect(service.favorite('user-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('unfavorite：不校验 PUBLISHED 状态（用户应始终能取消自己的收藏），直接委托', async () => {
    const { service, favoriteLibrary } = makeFavoriteService({
      posts: { 'p-hidden': { id: 'p-hidden', status: 'HIDDEN' } },
    });
    await service.unfavorite('user-1', 'p-hidden');
    expect(favoriteLibrary.unfavorite).toHaveBeenCalledWith(
      'user-1',
      ResourceType.GALLERY_POST,
      'p-hidden',
    );
  });
});

// ── recreate（Plan C Task 6）────────────────────────────────────────────

/**
 * recreate 复用 assertLikeableOrFavoritable 的"仅 PUBLISHED"校验（404 不存在 / 400 未发布），
 * 与 like/favorite/download 完全一致。返回值必须来自 gallery_posts 自身的快照字段
 * （prompt/model/referenceImage）—— mock repo 只暴露 post 字段、完全不接触
 * image_generations，足以证明 recreate 读的是 Task 4 落库的快照而非重新查生成记录。
 */
function makeRecreateService(overrides: {
  posts?: Record<string, Record<string, unknown>>;
  recordReferenceImpl?: (...args: unknown[]) => Promise<unknown>;
}) {
  const repo = {
    findById: async (id: string) => overrides.posts?.[id] ?? null,
  };
  const recordReference = jest.fn(
    overrides.recordReferenceImpl ?? (async () => ({ referenceCount: 1 })),
  );
  const metrics = { recordReference };
  const r2 = {};
  const service = new GalleryService(repo as never, metrics as never, r2 as never);
  return { service, repo, metrics, recordReference };
}

describe('GalleryService.recreate — 仅 PUBLISHED，读快照 + referenceCount+1', () => {
  const publishedPost = {
    id: 'p-pub',
    authorId: 'author-1',
    status: 'PUBLISHED',
    prompt: 'a cat wearing sunglasses',
    model: 'flux-pro',
    referenceImage: 'https://cdn/ref.png',
  };
  const draftPost = {
    id: 'd-1',
    authorId: 'author-1',
    status: 'DRAFT',
    prompt: 'draft prompt',
    model: 'flux-pro',
    referenceImage: null,
  };

  it('PUBLISHED：返回 gallery_posts 自身快照 prompt/model/referenceImage，并记一次引用（referenceCount+1）', async () => {
    const { service, recordReference } = makeRecreateService({
      posts: { 'p-pub': publishedPost },
    });
    const result = await service.recreate('user-9', 'p-pub');
    expect(result).toEqual({
      prompt: publishedPost.prompt,
      model: publishedPost.model,
      referenceImage: publishedPost.referenceImage,
    });
    expect(recordReference).toHaveBeenCalledTimes(1);
    expect(recordReference).toHaveBeenCalledWith(
      ResourceType.GALLERY_POST,
      'p-pub',
      'recreate',
      'user-9',
    );
  });

  it('referenceImage 为 null 时不含该字段', async () => {
    const { service } = makeRecreateService({
      posts: { 'p-pub': { ...publishedPost, referenceImage: null } },
    });
    const result = await service.recreate('user-9', 'p-pub');
    expect(result).not.toHaveProperty('referenceImage');
  });

  it('作品不存在 → 404', async () => {
    const { service } = makeRecreateService({ posts: {} });
    await expect(service.recreate('user-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it.each(['DRAFT', 'PENDING', 'HIDDEN', 'REJECTED', 'UNPUBLISHED', 'REMOVED'])(
    '状态为 %s（非 PUBLISHED）→ 拒绝（400），且不记引用',
    async (status) => {
      const { service, recordReference } = makeRecreateService({
        posts: { 'd-1': { ...draftPost, status } },
      });
      await expect(service.recreate('user-1', 'd-1')).rejects.toThrow(BadRequestException);
      expect(recordReference).not.toHaveBeenCalled();
    },
  );
});

// ── createSubmission 投稿幂等（Task 2）────────────────────────────────────

describe('createSubmission —— 一次生成至多一条活着的广场帖', () => {
  const dto = {
    kind: 'IMAGE',
    category: 'portrait',
    sourceType: 'FROM_GENERATION',
    imageGenerationId: 'gen-1',
  } as never;

  const generation = {
    userId: 'user-1',
    resolvedPrompt: 'a cat',
    modelUsed: 'gpt-image',
    width: 1024,
    height: 1024,
    referenceImage: null,
    generatedImages: [`${R2_PUBLIC_BASE}/a.png`, `${R2_PUBLIC_BASE}/b.png`],
  };

  it('已存在活帖时幂等返回该帖，不新建', async () => {
    const created: unknown[] = [];
    const service = makeService({
      imageGenerations: { 'gen-1': generation },
      activePosts: { 'gen-1': { id: 'post-existing', status: 'PENDING' } },
      captureCreate: (data) => created.push(data),
    });

    const result = await service.createSubmission('user-1', dto);

    expect((result as { id: string }).id).toBe('post-existing');
    expect(created).toHaveLength(0);
  });

  it('没有活帖时正常新建 PENDING 帖', async () => {
    const created: unknown[] = [];
    const service = makeService({
      imageGenerations: { 'gen-1': generation },
      activePosts: {},
      captureCreate: (data) => created.push(data),
    });

    await service.createSubmission('user-1', dto);

    expect(created).toHaveLength(1);
    expect((created[0] as { status: string }).status).toBe('PENDING');
  });

  it('并发抢跑撞 DB 唯一索引（P2002）时回查并返回已有帖，不冒泡成 500', async () => {
    let activePost: { id: string; status: string } | null = null;
    const service = makeService({
      imageGenerations: { 'gen-1': generation },
      // 首次查为空（放行到 create），create 抛 P2002，回查时另一方已写入
      findActivePostImpl: async () => activePost,
      createImpl: async () => {
        activePost = { id: 'post-raced', status: 'PENDING' };
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      },
    });

    const result = await service.createSubmission('user-1', dto);

    expect((result as { id: string }).id).toBe('post-raced');
  });
});

// ── createSubmission：DRAFT 不占「一次生成至多一条活帖」的坑（Task 2 审阅发现的回归）───

/**
 * `createDraft` 不做归属校验，`imageGenerationId` 是 DTO 里未经校验的任意字符串——任何人
 * 都能把它填成别人（或自己）某次生成的 id 建一条 DRAFT。若 DRAFT 被
 * `findActivePostByImageGenerationId` 当成「活帖」，就会占住「一次生成至多一条活帖」的坑，
 * 导致真正的作者之后调用 createSubmission 时被这条 DRAFT 幂等短路（或撞库唯一索引后回查
 * 又查到它），永远发不出自己的投稿。
 *
 * 这里不用 makeService 的手写 lookup mock ——那个 mock 本身就是「repo 已经过滤好之后的结果」，
 * 测不出过滤条件本身对不对。要真正锁住 gallery.repository.ts 里的 status 过滤条件，必须接入
 * 真实 GalleryRepository，配一张只解释标准 Prisma where 子句（相等 / notIn / not）的假
 * gallery_posts 表——这样"DRAFT 是否被当成活帖"完全由生产代码的 where 子句决定，而不是由
 * 测试自己重新写一遍判断逻辑。
 */
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];
    if (condition && typeof condition === 'object') {
      const c = condition as { notIn?: unknown[]; not?: unknown };
      if (c.notIn) return !c.notIn.includes(value);
      if ('not' in c) return value !== c.not;
      return true;
    }
    return value === condition;
  });
}

function makeFakeGalleryPostsTable(rows: Array<Record<string, unknown>>) {
  let seq = 0;
  return {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      const match = rows.find((row) => matchesWhere(row, where));
      return match ? { id: match.id, status: match.status } : null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      seq += 1;
      const row = { id: `post-${seq}`, ...data };
      rows.push(row);
      return row;
    },
  };
}

describe('GalleryRepository + GalleryService.createSubmission —— DRAFT 不占坑（回归）', () => {
  const authorId = 'user-1';
  const genId = 'gen-1';

  const generationRow = {
    userId: authorId,
    resolvedPrompt: 'a cat',
    modelUsed: 'gpt-image',
    width: 1024,
    height: 1024,
    referenceImage: null,
    generatedImages: [`${R2_PUBLIC_BASE}/a.png`],
  };

  function wireRealService(existingPost: Record<string, unknown> | null) {
    const rows: Array<Record<string, unknown>> = existingPost ? [existingPost] : [];
    const prisma = {
      gallery_posts: makeFakeGalleryPostsTable(rows),
      image_generations: { findUnique: async () => generationRow },
    };
    const repo = new GalleryRepository(prisma as never);
    const r2 = { getPublicBaseUrl: async () => R2_PUBLIC_BASE };
    const service = new GalleryService(repo, {} as never, r2 as never);
    return { service, rows };
  }

  it('已存在一条 DRAFT（同一次生成）时，createSubmission 正常新建 PENDING 帖，而不是把 DRAFT 幂等返回', async () => {
    const { service, rows } = wireRealService({
      id: 'draft-existing',
      imageGenerationId: genId,
      authorId,
      status: GalleryStatus.DRAFT,
    });

    const result = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'portrait',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: genId,
    } as never);

    expect((result as { id: string; status: string }).id).not.toBe('draft-existing');
    expect((result as { id: string; status: string }).status).toBe(GalleryStatus.PENDING);
    // 原 DRAFT 仍留在表里，新帖是另建的一条——而不是把 DRAFT 原地幂等返回。
    expect(rows).toHaveLength(2);
  });

  it('对照组：存在一条 PENDING（真活帖）时，仍然幂等返回该帖，不新建', async () => {
    const { service, rows } = wireRealService({
      id: 'pending-existing',
      imageGenerationId: genId,
      authorId,
      status: GalleryStatus.PENDING,
    });

    const result = await service.createSubmission(authorId, {
      kind: 'IMAGE',
      category: 'portrait',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: genId,
    } as never);

    expect((result as { id: string }).id).toBe('pending-existing');
    expect(rows).toHaveLength(1);
  });
});
