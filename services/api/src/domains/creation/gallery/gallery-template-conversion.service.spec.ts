import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GalleryRepository } from './gallery.repository';
import { GalleryService } from './gallery.service';
import { GalleryTemplateConversionService } from './gallery-template-conversion.service';

/**
 * Plan C Task 9：convert-to-template（仅 PUBLISHED+IMAGE+prompt 非空）+
 * REMOVED→ARCHIVED 单事务联动。
 *
 * 用一个极简的内存 prisma mock（gallery_posts / image_templates 两张表 +
 * $transaction 直通回调）同时驱动 GalleryRepository（真实实现，只是喂假 prisma）
 * 与 GalleryTemplateConversionService，这样才能验证"admin.remove 触发的归档"与
 * "conversion service 写入的模板"是同一份数据、同一事务语义。
 */

interface FakeGalleryPost {
  id: string;
  status: string;
  kind: string;
  prompt: string | null;
  title: string | null;
  category: string;
  coverImage: string | null;
  mediaUrls: string[];
  model: string | null;
  authorId: string;
}

function makeFakePrisma(galleries: Record<string, FakeGalleryPost>) {
  const galleryStore = new Map(Object.entries(galleries));
  const templateStore = new Map<string, Record<string, unknown>>(); // key: sourceGalleryPostId
  let idCounter = 0;

  const galleryDelegate = {
    findUnique: async ({ where }: any) => galleryStore.get(where.id) ?? null,
    update: async ({ where, data }: any) => {
      const cur = galleryStore.get(where.id);
      if (!cur) throw new Error('not found');
      const next = { ...cur, ...data };
      galleryStore.set(where.id, next);
      return next;
    },
  };

  const templateDelegate = {
    findUnique: async ({ where }: any) => {
      if (where.sourceGalleryPostId) {
        return templateStore.get(where.sourceGalleryPostId) ?? null;
      }
      return null;
    },
    create: async ({ data }: any) => {
      const key = data.sourceGalleryPostId as string;
      if (templateStore.has(key)) {
        const err = new Error('Unique constraint failed on sourceGalleryPostId') as Error & {
          code: string;
        };
        err.code = 'P2002';
        throw err;
      }
      idCounter += 1;
      const row = { id: `tpl-${idCounter}`, ...data };
      templateStore.set(key, row);
      return row;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const [key, row] of templateStore.entries()) {
        if (row.sourceGalleryPostId !== where.sourceGalleryPostId) continue;
        if (where.status?.not && row.status === where.status.not) continue;
        templateStore.set(key, { ...row, ...data });
        count += 1;
      }
      return { count };
    },
  };

  const prisma = {
    gallery_posts: galleryDelegate,
    image_templates: templateDelegate,
    admin_audit_logs: {
      create: async ({ data }: any) => ({ id: 'audit-1', ...data }),
    },
    // 内存 mock：直接把同一个 prisma 当作 tx 传给回调即可，语义上足够覆盖
    // "两张表在同一次调用内一起改" 这件事，不需要真实的隔离/回滚能力。
    $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  };

  return { prisma, galleryStore, templateStore };
}

const adminId = 'admin-1';
const galleryAuthorId = 'author-1';

const publishedImageGallery: FakeGalleryPost = {
  id: 'gallery-published-img',
  status: 'PUBLISHED',
  kind: 'IMAGE',
  prompt: 'a cat wearing sunglasses',
  title: '我的作品',
  category: 'ai_generated',
  coverImage: 'https://cdn/cover.png',
  mediaUrls: ['https://cdn/a.png', 'https://cdn/b.png'],
  model: 'flux-pro',
  authorId: galleryAuthorId,
};

const noPromptGallery: FakeGalleryPost = {
  id: 'gallery-no-prompt',
  status: 'PUBLISHED',
  kind: 'IMAGE',
  prompt: '',
  title: null,
  category: 'ai_generated',
  coverImage: null,
  mediaUrls: [],
  model: null,
  authorId: galleryAuthorId,
};

const pendingImageGallery: FakeGalleryPost = {
  ...publishedImageGallery,
  id: 'gallery-pending-img',
  status: 'PENDING',
};

const publishedVideoGallery: FakeGalleryPost = {
  ...publishedImageGallery,
  id: 'gallery-published-video',
  kind: 'VIDEO',
};

function makeConversionService(galleries: Record<string, FakeGalleryPost>) {
  const { prisma, galleryStore, templateStore } = makeFakePrisma(galleries);
  const repo = new GalleryRepository(prisma as never);
  const conv = new GalleryTemplateConversionService(prisma as never, repo);
  return { conv, repo, prisma, galleryStore, templateStore };
}

describe('GalleryTemplateConversionService.convertToTemplate', () => {
  it('转换：仅 PUBLISHED IMAGE 且 prompt 非空；字段映射齐全', async () => {
    const { conv } = makeConversionService({
      [publishedImageGallery.id]: publishedImageGallery,
    });
    const t = await conv.convertToTemplate(adminId, publishedImageGallery.id);
    expect(t.sourceType).toBe('GALLERY_CONVERSION');
    expect(t.status).toBe('APPROVED');
    expect(t.reviewedById).toBe(adminId);
    expect(t.authorId).toBe(galleryAuthorId);
    expect(t.createdById).toBe(adminId);
    expect(t.sourceGalleryPostId).toBe(publishedImageGallery.id);
    expect(t.title).toBeTruthy();
    expect(t.category).toBeTruthy();
    expect(t.prompt).toBe(publishedImageGallery.prompt);
    expect(t.variables).toEqual({});
    expect(t.coverImage).toBe(publishedImageGallery.coverImage);
    expect(t.exampleImages).toEqual(publishedImageGallery.mediaUrls);
    expect(t.modelHint).toBe(publishedImageGallery.model);
    expect(t.reviewedAt).toBeInstanceOf(Date);
  });

  it('title 缺失时兜底为"来自作品 {id前8位}"', async () => {
    const gallery = { ...publishedImageGallery, id: 'gallery-no-title', title: null };
    const { conv } = makeConversionService({ [gallery.id]: gallery });
    const t = await conv.convertToTemplate(adminId, gallery.id);
    expect(t.title).toBe(`来自作品 ${gallery.id.slice(0, 8)}`);
  });

  it('coverImage 缺失时兜底 mediaUrls[0]', async () => {
    const gallery = { ...publishedImageGallery, id: 'gallery-no-cover', coverImage: null };
    const { conv } = makeConversionService({ [gallery.id]: gallery });
    const t = await conv.convertToTemplate(adminId, gallery.id);
    expect(t.coverImage).toBe(gallery.mediaUrls[0]);
  });

  it('prompt 为空的 Gallery 拒绝转换', async () => {
    const { conv } = makeConversionService({ [noPromptGallery.id]: noPromptGallery });
    await expect(conv.convertToTemplate(adminId, noPromptGallery.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('非 PUBLISHED（如 PENDING）拒绝转换', async () => {
    const { conv } = makeConversionService({ [pendingImageGallery.id]: pendingImageGallery });
    await expect(conv.convertToTemplate(adminId, pendingImageGallery.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('非 IMAGE（如 VIDEO）拒绝转换', async () => {
    const { conv } = makeConversionService({
      [publishedVideoGallery.id]: publishedVideoGallery,
    });
    await expect(conv.convertToTemplate(adminId, publishedVideoGallery.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('Gallery 不存在 → 404', async () => {
    const { conv } = makeConversionService({});
    await expect(conv.convertToTemplate(adminId, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('重复转换幂等：返回已有模板（200），不新建不抛错', async () => {
    const { conv, templateStore } = makeConversionService({
      [publishedImageGallery.id]: publishedImageGallery,
    });
    const a = await conv.convertToTemplate(adminId, publishedImageGallery.id);
    const b = await conv.convertToTemplate(adminId, publishedImageGallery.id);
    expect(b.id).toBe(a.id);
    expect(templateStore.size).toBe(1);
  });

  it('转换会写入 admin_audit_logs', async () => {
    const { prisma } = makeConversionService({
      [publishedImageGallery.id]: publishedImageGallery,
    });
    const repo = new GalleryRepository(prisma as never);
    const conv = new GalleryTemplateConversionService(prisma as never, repo);
    const auditSpy = jest.spyOn(prisma.admin_audit_logs, 'create');
    await conv.convertToTemplate(adminId, publishedImageGallery.id);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });

  it('幂等无条件：转换后作品迁到 HIDDEN，再次转换仍返回同一模板（不因状态门禁抛错）', async () => {
    const gallery = { ...publishedImageGallery, id: 'gallery-then-hidden' };
    const { conv, galleryStore, templateStore } = makeConversionService({
      [gallery.id]: gallery,
    });
    const a = await conv.convertToTemplate(adminId, gallery.id);
    // convertToTemplate 不改动作品状态；模拟作品被合法迁到 HIDDEN（PUBLISHED→HIDDEN）。
    galleryStore.set(gallery.id, { ...galleryStore.get(gallery.id)!, status: 'HIDDEN' });
    const b = await conv.convertToTemplate(adminId, gallery.id);
    expect(b.id).toBe(a.id);
    expect(templateStore.size).toBe(1);
  });
});

describe('GalleryService.remove（管理端）→ 关联模板同事务 ARCHIVED', () => {
  it('管理员 REMOVE Gallery：关联模板同事务 ARCHIVED', async () => {
    const gallery = { ...publishedImageGallery, id: 'gallery-remove-me' };
    const { prisma, galleryStore } = makeFakePrisma({ [gallery.id]: gallery });
    const repo = new GalleryRepository(prisma as never);
    const conv = new GalleryTemplateConversionService(prisma as never, repo);
    const gallerySvc = new GalleryService(repo as never, {} as never, {} as never);

    const created = await conv.convertToTemplate(adminId, gallery.id);
    await gallerySvc.remove(adminId, gallery.id);

    const tpl = await prisma.image_templates.findUnique({
      where: { sourceGalleryPostId: gallery.id },
    });
    expect(tpl!.status).toBe('ARCHIVED');
    expect(tpl!.id).toBe(created.id);
    expect(galleryStore.get(gallery.id)!.status).toBe('REMOVED');
  });

  it('作者 DELETE（removePost）已转换作品：关联模板同事务 ARCHIVED', async () => {
    const gallery = { ...publishedImageGallery, id: 'gallery-author-remove-me' };
    const { prisma, galleryStore } = makeFakePrisma({ [gallery.id]: gallery });
    const repo = new GalleryRepository(prisma as never);
    const conv = new GalleryTemplateConversionService(prisma as never, repo);
    const gallerySvc = new GalleryService(repo as never, {} as never, {} as never);

    const created = await conv.convertToTemplate(adminId, gallery.id);
    // convertToTemplate 保持作品 PUBLISHED；作者可自删（PUBLISHED→REMOVED, 'author'）。
    await gallerySvc.removePost(galleryAuthorId, gallery.id);

    const tpl = await prisma.image_templates.findUnique({
      where: { sourceGalleryPostId: gallery.id },
    });
    expect(tpl!.status).toBe('ARCHIVED');
    expect(tpl!.id).toBe(created.id);
    expect(galleryStore.get(gallery.id)!.status).toBe('REMOVED');
  });

  it('UNPUBLISHED（作者自行下架）不触发归档', async () => {
    const gallery = { ...publishedImageGallery, id: 'gallery-unpublish-me' };
    const { prisma } = makeFakePrisma({ [gallery.id]: gallery });
    const repo = new GalleryRepository(prisma as never);
    const conv = new GalleryTemplateConversionService(prisma as never, repo);
    const gallerySvc = new GalleryService(repo as never, {} as never, {} as never);

    await conv.convertToTemplate(adminId, gallery.id);
    await gallerySvc.unpublish(galleryAuthorId, gallery.id);

    const tpl = await prisma.image_templates.findUnique({
      where: { sourceGalleryPostId: gallery.id },
    });
    expect(tpl!.status).toBe('APPROVED');
  });
});
