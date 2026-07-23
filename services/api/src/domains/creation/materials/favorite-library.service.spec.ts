import { Prisma } from '../../platform/prisma/generated';
import { FavoriteLibraryService } from './favorite-library.service';

/** 生产代码用 `instanceof Prisma.PrismaClientKnownRequestError` 判定 P2002，fake 也必须抛真实子类实例。 */
function uniqueConstraintError(message: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: 'P2002',
    clientVersion: '0.0.0-test',
  });
}

/**
 * Plan C Task 10：单事务收藏耦合 + sourceState + 使用拦截。
 *
 * 沿用 gallery-template-conversion.service.spec.ts 建立的惯例：一个极简内存 prisma mock
 * （resource_favorites / resource_metrics / material_assets / material_folders /
 * gallery_posts / image_templates / video_templates 若干张表 + $transaction 直通回调），
 * 喂给真实的 FavoriteLibraryService 实现，验证"多张表在同一次调用内一起改"的耦合语义。
 */

interface FakeGalleryPost {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  title: string | null;
  coverImage: string | null;
  mediaUrls: string[];
  status: string;
}

interface FakeTemplate {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  exampleImages?: string[];
  exampleMedia?: string[];
}

interface FakeMaterial {
  id: string;
  userId: string;
  type: string;
  title: string;
  url: string | null;
  thumbnailUrl: string | null;
  sourceType: string;
  librarySource: string;
  sourceResourceType: string | null;
  sourceId: string | null;
  folderId: string | null;
  deletedAt: Date | null;
}

interface FakeFavorite {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string;
}

interface FakeMetrics {
  resourceType: string;
  resourceId: string;
  favoriteCount: number;
}

function makeFakePrisma(seed: {
  galleries?: Record<string, FakeGalleryPost>;
  imageTemplates?: Record<string, FakeTemplate>;
  videoTemplates?: Record<string, FakeTemplate>;
} = {}) {
  const galleryStore = new Map(Object.entries(seed.galleries ?? {}));
  const imageTemplateStore = new Map(Object.entries(seed.imageTemplates ?? {}));
  const videoTemplateStore = new Map(Object.entries(seed.videoTemplates ?? {}));
  const materialStore = new Map<string, FakeMaterial>();
  const favoriteStore = new Map<string, FakeFavorite>();
  const metricsStore = new Map<string, FakeMetrics>();
  const folderStore = new Map<string, { id: string; deletedAt: Date | null }>();
  let materialCounter = 0;
  let favoriteCounter = 0;

  function metricsKey(resourceType: string, resourceId: string) {
    return `${resourceType}:${resourceId}`;
  }
  function favoriteKey(userId: string, resourceType: string, resourceId: string) {
    return `${userId}:${resourceType}:${resourceId}`;
  }
  function materialUniqueKey(m: {
    userId: string;
    librarySource: string;
    sourceResourceType: string | null;
    sourceId: string | null;
  }) {
    return `${m.userId}:${m.librarySource}:${m.sourceResourceType}:${m.sourceId}`;
  }

  const prisma = {
    gallery_posts: {
      findUnique: async ({ where }: any) => galleryStore.get(where.id) ?? null,
      findMany: async ({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        return ids.map((id) => galleryStore.get(id)).filter(Boolean) as FakeGalleryPost[];
      },
    },
    image_templates: {
      findUnique: async ({ where }: any) => imageTemplateStore.get(where.id) ?? null,
      findMany: async ({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        return ids.map((id) => imageTemplateStore.get(id)).filter(Boolean) as FakeTemplate[];
      },
    },
    video_templates: {
      findUnique: async ({ where }: any) => videoTemplateStore.get(where.id) ?? null,
      findMany: async ({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        return ids.map((id) => videoTemplateStore.get(id)).filter(Boolean) as FakeTemplate[];
      },
    },
    resource_favorites: {
      createMany: async ({ data, skipDuplicates }: any) => {
        let count = 0;
        for (const row of data) {
          const key = favoriteKey(row.userId, row.resourceType, row.resourceId);
          if (favoriteStore.has(key)) {
            if (skipDuplicates) continue;
            const err = new Error('Unique constraint failed') as Error & { code: string };
            err.code = 'P2002';
            throw err;
          }
          favoriteCounter += 1;
          favoriteStore.set(key, { id: `fav-${favoriteCounter}`, ...row });
          count += 1;
        }
        return { count };
      },
      deleteMany: async ({ where }: any) => {
        const key = favoriteKey(where.userId, where.resourceType, where.resourceId);
        if (favoriteStore.has(key)) {
          favoriteStore.delete(key);
          return { count: 1 };
        }
        return { count: 0 };
      },
      count: async ({ where }: any) => {
        let n = 0;
        for (const row of favoriteStore.values()) {
          if (row.userId === where.userId && row.resourceType === where.resourceType && row.resourceId === where.resourceId) n += 1;
        }
        return n;
      },
    },
    resource_metrics: {
      findUnique: async ({ where }: any) => {
        const key = metricsKey(
          where.resourceType_resourceId.resourceType,
          where.resourceType_resourceId.resourceId,
        );
        return metricsStore.get(key) ?? null;
      },
      upsert: async ({ where, create, update }: any) => {
        const key = metricsKey(
          where.resourceType_resourceId.resourceType,
          where.resourceType_resourceId.resourceId,
        );
        const existing = metricsStore.get(key);
        if (!existing) {
          const row: FakeMetrics = {
            resourceType: create.resourceType,
            resourceId: create.resourceId,
            favoriteCount: create.favoriteCount ?? 0,
          };
          metricsStore.set(key, row);
          return row;
        }
        const next = {
          ...existing,
          favoriteCount: existing.favoriteCount + (update.favoriteCount?.increment ?? 0),
        };
        metricsStore.set(key, next);
        return next;
      },
      updateMany: async ({ where, data }: any) => {
        const key = metricsKey(where.resourceType, where.resourceId);
        const existing = metricsStore.get(key);
        if (!existing) return { count: 0 };
        const decrement = data.favoriteCount?.decrement ?? 0;
        existing.favoriteCount = Math.max(0, existing.favoriteCount - decrement);
        metricsStore.set(key, existing);
        return { count: 1 };
      },
    },
    material_assets: {
      create: async ({ data }: any) => {
        const key = materialUniqueKey(data);
        for (const row of materialStore.values()) {
          if (materialUniqueKey(row) === key) {
            throw uniqueConstraintError('Unique constraint failed on material_assets');
          }
        }
        materialCounter += 1;
        const row: FakeMaterial = {
          id: `mat-${materialCounter}`,
          deletedAt: null,
          ...data,
        };
        materialStore.set(row.id, row);
        return row;
      },
      // 通用 where 匹配（仅比对 where 中出现的键）：deleteMaterial 用 id/userId/deletedAt 三键，
      // Task 11 saveHistoryMaterial 的幂等回读用 userId/librarySource/sourceResourceType/sourceId。
      findFirst: async ({ where }: any) => {
        for (const row of materialStore.values()) {
          const matches = Object.entries(where).every(([key, value]) => (row as any)[key] === value);
          if (matches) return row;
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        return Array.from(materialStore.values()).filter((row) => {
          if (where.userId !== undefined && row.userId !== where.userId) return false;
          if (where.deletedAt !== undefined && row.deletedAt !== where.deletedAt) return false;
          if (where.folderId !== undefined && row.folderId !== where.folderId) return false;
          if (where.id?.in && !where.id.in.includes(row.id)) return false;
          return true;
        });
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of materialStore.entries()) {
          if (
            row.userId === where.userId &&
            row.librarySource === where.librarySource &&
            row.sourceResourceType === where.sourceResourceType &&
            row.sourceId === where.sourceId
          ) {
            materialStore.delete(id);
            count += 1;
          }
        }
        return { count };
      },
      delete: async ({ where }: any) => {
        const row = materialStore.get(where.id);
        materialStore.delete(where.id);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = materialStore.get(where.id);
        if (!row) throw new Error(`material_assets.update: no row ${where.id}`);
        const next = { ...row, ...data };
        materialStore.set(where.id, next);
        return next;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const [id, row] of materialStore.entries()) {
          if (where.id?.in?.includes(id)) {
            materialStore.set(id, { ...row, ...data });
            count += 1;
          }
        }
        return { count };
      },
      count: async ({ where }: any) => {
        return Array.from(materialStore.values()).filter((row) => {
          if (where.userId !== undefined && row.userId !== where.userId) return false;
          if (where.librarySource !== undefined && row.librarySource !== where.librarySource) return false;
          if (where.sourceResourceType !== undefined && row.sourceResourceType !== where.sourceResourceType) return false;
          if (where.sourceId !== undefined && row.sourceId !== where.sourceId) return false;
          if (where.deletedAt !== undefined && row.deletedAt !== where.deletedAt) return false;
          return true;
        }).length;
      },
    },
    material_folders: {
      update: async ({ where, data }: any) => {
        const existing = folderStore.get(where.id) ?? { id: where.id, deletedAt: null };
        const next = { ...existing, ...data };
        folderStore.set(where.id, next);
        return next;
      },
    },
    // 内存 mock：直接把同一个 prisma 当作 tx 传给回调即可，语义上足够覆盖单事务耦合。
    $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  };

  return {
    prisma,
    galleryStore,
    imageTemplateStore,
    videoTemplateStore,
    materialStore,
    favoriteStore,
    metricsStore,
    folderStore,
  };
}

function countMaterials(
  materialStore: Map<string, FakeMaterial>,
  userId: string,
  librarySource: string,
  sourceResourceType: string,
  sourceId: string,
): number {
  let n = 0;
  for (const row of materialStore.values()) {
    if (
      row.userId === userId &&
      row.librarySource === librarySource &&
      row.sourceResourceType === sourceResourceType &&
      row.sourceId === sourceId
    ) {
      n += 1;
    }
  }
  return n;
}

function countFavorites(favoriteStore: Map<string, FakeFavorite>, userId: string, resourceType: string, resourceId: string): number {
  let n = 0;
  for (const row of favoriteStore.values()) {
    if (row.userId === userId && row.resourceType === resourceType && row.resourceId === resourceId) n += 1;
  }
  return n;
}

function readFavoriteCount(metricsStore: Map<string, FakeMetrics>, resourceType: string, resourceId: string): number {
  return metricsStore.get(`${resourceType}:${resourceId}`)?.favoriteCount ?? 0;
}

const userId = 'user-1';
const tplId = 'tpl-1';
const gId = 'gallery-1';

const imageTemplate: FakeTemplate = {
  id: tplId,
  title: '模板 A',
  coverImage: 'https://cdn/tpl-a.png',
  status: 'APPROVED',
  exampleImages: [],
};

const publishedGallery: FakeGalleryPost = {
  id: gId,
  kind: 'IMAGE',
  title: '作品 A',
  coverImage: 'https://cdn/g-a.png',
  mediaUrls: ['https://cdn/g-a.png'],
  status: 'PUBLISHED',
};

describe('FavoriteLibraryService.favorite/unfavorite — 单事务耦合', () => {
  it('收藏落 FAVORITE material；取消收藏同删；删 HISTORY 不动收藏', async () => {
    const { prisma, materialStore, favoriteStore } = makeFakePrisma({
      imageTemplates: { [tplId]: imageTemplate },
    });
    const fav = new FavoriteLibraryService(prisma as never);

    await fav.favorite(userId, 'IMAGE_TEMPLATE' as never, tplId);
    expect(countMaterials(materialStore, userId, 'FAVORITE', 'IMAGE_TEMPLATE', tplId)).toBe(1);
    expect(countFavorites(favoriteStore, userId, 'IMAGE_TEMPLATE', tplId)).toBe(1);

    await fav.unfavorite(userId, 'IMAGE_TEMPLATE' as never, tplId);
    expect(countMaterials(materialStore, userId, 'FAVORITE', 'IMAGE_TEMPLATE', tplId)).toBe(0);
    expect(countFavorites(favoriteStore, userId, 'IMAGE_TEMPLATE', tplId)).toBe(0);
  });

  it('同资源可同时有 FAVORITE 与 HISTORY，删 HISTORY 不取消收藏', async () => {
    const { prisma, materialStore, favoriteStore } = makeFakePrisma({
      galleries: { [gId]: publishedGallery },
    });
    const fav = new FavoriteLibraryService(prisma as never);

    await fav.favorite(userId, 'GALLERY_POST' as never, gId);
    // 模拟一条 HISTORY 素材（本分支尚无 saveFromHistory 生产入口，直接建行覆盖删除联动逻辑）。
    await prisma.material_assets.create({
      data: {
        userId,
        type: 'image',
        title: '历史',
        url: null,
        thumbnailUrl: null,
        sourceType: 'image_generation',
        librarySource: 'HISTORY',
        sourceResourceType: 'GALLERY_POST',
        sourceId: gId,
        folderId: null,
      },
    });
    const history = Array.from(materialStore.values()).find((m) => m.librarySource === 'HISTORY')!;

    await fav.deleteMaterial(userId, history.id);

    expect(countFavorites(favoriteStore, userId, 'GALLERY_POST', gId)).toBe(1); // 未取消
    expect(materialStore.get(history.id)?.deletedAt).not.toBeNull(); // HISTORY 软删
  });

  it('并发/重复 favorite 只 +1 一次（count===1 才计数）', async () => {
    const { prisma, metricsStore } = makeFakePrisma({ galleries: { [gId]: publishedGallery } });
    const fav = new FavoriteLibraryService(prisma as never);

    await Promise.all([
      fav.favorite(userId, 'GALLERY_POST' as never, gId),
      fav.favorite(userId, 'GALLERY_POST' as never, gId),
    ]);

    expect(readFavoriteCount(metricsStore, 'GALLERY_POST', gId)).toBe(1);
  });

  it('取消后再收藏（FAVORITE 硬删）不撞唯一约束', async () => {
    const { prisma, metricsStore } = makeFakePrisma({ galleries: { [gId]: publishedGallery } });
    const fav = new FavoriteLibraryService(prisma as never);

    await fav.favorite(userId, 'GALLERY_POST' as never, gId);
    await fav.unfavorite(userId, 'GALLERY_POST' as never, gId);
    await expect(fav.favorite(userId, 'GALLERY_POST' as never, gId)).resolves.toBeDefined();

    expect(readFavoriteCount(metricsStore, 'GALLERY_POST', gId)).toBe(1);
  });

  it('收藏不存在的资源 → NotFoundException', async () => {
    const { prisma } = makeFakePrisma({});
    const fav = new FavoriteLibraryService(prisma as never);
    await expect(fav.favorite(userId, 'IMAGE_TEMPLATE' as never, 'missing')).rejects.toMatchObject({
      status: 404,
      i18nKey: 'creation.materials.resource_not_found',
    });
  });

  it('重复取消收藏（本就未收藏）是幂等 no-op，不抛错、不倒扣计数', async () => {
    const { prisma, metricsStore } = makeFakePrisma({ galleries: { [gId]: publishedGallery } });
    const fav = new FavoriteLibraryService(prisma as never);
    await expect(fav.unfavorite(userId, 'GALLERY_POST' as never, gId)).resolves.toBeDefined();
    expect(readFavoriteCount(metricsStore, 'GALLERY_POST', gId)).toBe(0);
  });
});

describe('FavoriteLibraryService.deriveSourceState — 穷举映射', () => {
  it('Gallery PUBLISHED=available / UNPUBLISHED=unpublished / 其余=blocked；Template APPROVED=available / 其余=blocked；缺失=missing', async () => {
    const { prisma } = makeFakePrisma({
      galleries: {
        'g-published': { ...publishedGallery, id: 'g-published', status: 'PUBLISHED' },
        'g-unpublished': { ...publishedGallery, id: 'g-unpublished', status: 'UNPUBLISHED' },
        'g-draft': { ...publishedGallery, id: 'g-draft', status: 'DRAFT' },
        'g-pending': { ...publishedGallery, id: 'g-pending', status: 'PENDING' },
        'g-rejected': { ...publishedGallery, id: 'g-rejected', status: 'REJECTED' },
        'g-hidden': { ...publishedGallery, id: 'g-hidden', status: 'HIDDEN' },
        'g-removed': { ...publishedGallery, id: 'g-removed', status: 'REMOVED' },
      },
      imageTemplates: {
        't-approved': { ...imageTemplate, id: 't-approved', status: 'APPROVED' },
        't-pending': { ...imageTemplate, id: 't-pending', status: 'PENDING' },
        't-archived': { ...imageTemplate, id: 't-archived', status: 'ARCHIVED' },
      },
    });
    const fav = new FavoriteLibraryService(prisma as never);

    const items = [
      { id: 'm-g-pub', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-published' },
      { id: 'm-g-unpub', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-unpublished' },
      { id: 'm-g-draft', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-draft' },
      { id: 'm-g-pending', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-pending' },
      { id: 'm-g-rejected', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-rejected' },
      { id: 'm-g-hidden', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-hidden' },
      { id: 'm-g-removed', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-removed' },
      { id: 'm-t-approved', librarySource: 'FAVORITE', sourceResourceType: 'IMAGE_TEMPLATE' as never, sourceId: 't-approved' },
      { id: 'm-t-pending', librarySource: 'FAVORITE', sourceResourceType: 'IMAGE_TEMPLATE' as never, sourceId: 't-pending' },
      { id: 'm-t-archived', librarySource: 'FAVORITE', sourceResourceType: 'IMAGE_TEMPLATE' as never, sourceId: 't-archived' },
      { id: 'm-missing', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-does-not-exist' },
      { id: 'm-upload', librarySource: 'UPLOAD', sourceResourceType: null, sourceId: null },
    ];

    const state = await fav.deriveSourceState(items);

    expect(state.get('m-g-pub')).toBe('available');
    expect(state.get('m-g-unpub')).toBe('unpublished');
    expect(state.get('m-g-draft')).toBe('blocked');
    expect(state.get('m-g-pending')).toBe('blocked');
    expect(state.get('m-g-rejected')).toBe('blocked');
    expect(state.get('m-g-hidden')).toBe('blocked');
    expect(state.get('m-g-removed')).toBe('blocked');
    expect(state.get('m-t-approved')).toBe('available');
    expect(state.get('m-t-pending')).toBe('blocked');
    expect(state.get('m-t-archived')).toBe('blocked');
    expect(state.get('m-missing')).toBe('missing');
    expect(state.get('m-upload')).toBe('available');
  });
});

describe('FavoriteLibraryService.assertUsable', () => {
  it('blocked/missing → 403；unpublished/available 放行', async () => {
    const { prisma } = makeFakePrisma({
      galleries: {
        'g-published': { ...publishedGallery, id: 'g-published', status: 'PUBLISHED' },
        'g-unpublished': { ...publishedGallery, id: 'g-unpublished', status: 'UNPUBLISHED' },
        'g-hidden': { ...publishedGallery, id: 'g-hidden', status: 'HIDDEN' },
      },
    });
    const fav = new FavoriteLibraryService(prisma as never);

    await expect(
      fav.assertUsable({ id: 'm1', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-hidden' }),
    ).rejects.toMatchObject({ status: 403, i18nKey: 'creation.materials.source_unavailable' });
    await expect(
      fav.assertUsable({ id: 'm2', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-does-not-exist' }),
    ).rejects.toMatchObject({ status: 403, i18nKey: 'creation.materials.source_unavailable' });
    await expect(
      fav.assertUsable({ id: 'm3', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-unpublished' }),
    ).resolves.toBeUndefined();
    await expect(
      fav.assertUsable({ id: 'm4', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST' as never, sourceId: 'g-published' }),
    ).resolves.toBeUndefined();
  });
});

describe('FavoriteLibraryService.saveHistoryMaterial — Plan C Task 11', () => {
  it('落 librarySource=HISTORY 素材，快照取自 resolveResourceSnapshot（同 favorite() 一套解析）', async () => {
    const { prisma, materialStore } = makeFakePrisma({
      galleries: { [gId]: publishedGallery },
    });
    const fav = new FavoriteLibraryService(prisma as never);

    const material = await fav.saveHistoryMaterial(userId, 'GALLERY_POST' as never, gId);

    expect(material.librarySource).toBe('HISTORY');
    expect(material.sourceResourceType).toBe('GALLERY_POST');
    expect(material.sourceId).toBe(gId);
    expect(material.title).toBe(publishedGallery.title);
    expect(countMaterials(materialStore, userId, 'HISTORY', 'GALLERY_POST', gId)).toBe(1);
  });

  it('重复保存同一资源 → 幂等返回已存在的那一行，不 500、不重复插入', async () => {
    const { prisma, materialStore } = makeFakePrisma({
      galleries: { [gId]: publishedGallery },
    });
    const fav = new FavoriteLibraryService(prisma as never);

    const first = await fav.saveHistoryMaterial(userId, 'GALLERY_POST' as never, gId);
    const second = await fav.saveHistoryMaterial(userId, 'GALLERY_POST' as never, gId);

    expect(second.id).toBe(first.id);
    expect(countMaterials(materialStore, userId, 'HISTORY', 'GALLERY_POST', gId)).toBe(1);
  });

  it('资源已不存在 → NotFoundException（不落孤儿素材行）', async () => {
    const { prisma } = makeFakePrisma({});
    const fav = new FavoriteLibraryService(prisma as never);
    await expect(
      fav.saveHistoryMaterial(userId, 'GALLERY_POST' as never, 'does-not-exist'),
    ).rejects.toMatchObject({ status: 404, i18nKey: 'creation.materials.resource_not_found' });
  });

  it('删除→再保存：复活软删行（deletedAt 归 null），不返回幻影的仍处删除态的旧行', async () => {
    const { prisma, materialStore } = makeFakePrisma({
      galleries: { [gId]: publishedGallery },
    });
    const fav = new FavoriteLibraryService(prisma as never);

    const first = await fav.saveHistoryMaterial(userId, 'GALLERY_POST' as never, gId);
    await fav.deleteMaterial(userId, first.id);
    // HISTORY 是软删：行还在，deletedAt 已置位；唯一约束没有 deletedAt IS NULL 偏索引，
    // 所以再次保存必然撞 P2002 —— 这正是"幻影成功"曾经发生的地方。
    expect(materialStore.get(first.id)!.deletedAt).not.toBeNull();

    const revived = await fav.saveHistoryMaterial(userId, 'GALLERY_POST' as never, gId);

    expect(revived.id).toBe(first.id);
    expect(revived.deletedAt).toBeNull();
    // 且库里那一行真的活了（list() 按 deletedAt:null 过滤，能重新查到）。
    expect(materialStore.get(first.id)!.deletedAt).toBeNull();
    expect(countMaterials(materialStore, userId, 'HISTORY', 'GALLERY_POST', gId)).toBe(1);
  });

  it('复活时刷新快照字段（标题跟随资源最新状态，不复活出过期僵尸素材）', async () => {
    const { prisma, galleryStore } = makeFakePrisma({
      galleries: { [gId]: publishedGallery },
    });
    const fav = new FavoriteLibraryService(prisma as never);

    const first = await fav.saveHistoryMaterial(userId, 'GALLERY_POST' as never, gId);
    await fav.deleteMaterial(userId, first.id);
    galleryStore.set(gId, { ...publishedGallery, title: '作品 A（改名后）' });

    const revived = await fav.saveHistoryMaterial(userId, 'GALLERY_POST' as never, gId);

    expect(revived.title).toBe('作品 A（改名后）');
    expect(revived.deletedAt).toBeNull();
  });
});

describe('FavoriteLibraryService.deleteMaterials / deleteFolder / purgeUser', () => {
  it('deleteMaterials 批量：FAVORITE 取消收藏，UPLOAD 只软删', async () => {
    const { prisma, materialStore, favoriteStore } = makeFakePrisma({
      galleries: { [gId]: publishedGallery },
    });
    const fav = new FavoriteLibraryService(prisma as never);
    await fav.favorite(userId, 'GALLERY_POST' as never, gId);
    const favMaterial = Array.from(materialStore.values()).find((m) => m.librarySource === 'FAVORITE')!;
    const upload = await prisma.material_assets.create({
      data: {
        userId,
        type: 'image',
        title: '上传',
        url: null,
        thumbnailUrl: null,
        sourceType: 'upload',
        librarySource: 'UPLOAD',
        sourceResourceType: null,
        sourceId: null,
        folderId: null,
      },
    });

    const result = await fav.deleteMaterials(userId, [favMaterial.id, upload.id]);

    expect(result.count).toBe(2);
    expect(materialStore.has(favMaterial.id)).toBe(false); // FAVORITE 硬删
    expect(materialStore.get(upload.id)?.deletedAt).not.toBeNull(); // UPLOAD 软删
    expect(countFavorites(favoriteStore, userId, 'GALLERY_POST', gId)).toBe(0);
  });

  it('deleteFolder：文件夹内 FAVORITE 联动取消收藏，文件夹本身软删', async () => {
    const { prisma, materialStore, favoriteStore, folderStore } = makeFakePrisma({
      galleries: { [gId]: publishedGallery },
    });
    const fav = new FavoriteLibraryService(prisma as never);
    await fav.favorite(userId, 'GALLERY_POST' as never, gId);
    const favMaterial = Array.from(materialStore.values()).find((m) => m.librarySource === 'FAVORITE')!;
    favMaterial.folderId = 'folder-1';

    await fav.deleteFolder(userId, 'folder-1');

    expect(materialStore.has(favMaterial.id)).toBe(false);
    expect(countFavorites(favoriteStore, userId, 'GALLERY_POST', gId)).toBe(0);
    expect(folderStore.get('folder-1')?.deletedAt).not.toBeNull();
  });

  it('purgeUser：清空该用户全部素材，FAVORITE 联动取消收藏', async () => {
    const { prisma, materialStore, favoriteStore } = makeFakePrisma({
      galleries: { [gId]: publishedGallery },
      imageTemplates: { [tplId]: imageTemplate },
    });
    const fav = new FavoriteLibraryService(prisma as never);
    await fav.favorite(userId, 'GALLERY_POST' as never, gId);
    await fav.favorite(userId, 'IMAGE_TEMPLATE' as never, tplId);
    await prisma.material_assets.create({
      data: {
        userId,
        type: 'image',
        title: '上传',
        url: null,
        thumbnailUrl: null,
        sourceType: 'upload',
        librarySource: 'UPLOAD',
        sourceResourceType: null,
        sourceId: null,
        folderId: null,
      },
    });

    await fav.purgeUser(userId);

    const remaining = Array.from(materialStore.values()).filter((m) => m.userId === userId && m.deletedAt === null);
    expect(remaining.length).toBe(0);
    expect(countFavorites(favoriteStore, userId, 'GALLERY_POST', gId)).toBe(0);
    expect(countFavorites(favoriteStore, userId, 'IMAGE_TEMPLATE', tplId)).toBe(0);
  });

  it('deleteMaterial 对不存在/非本人素材 → NotFoundException', async () => {
    const { prisma } = makeFakePrisma({});
    const fav = new FavoriteLibraryService(prisma as never);
    await expect(fav.deleteMaterial(userId, 'missing')).rejects.toMatchObject({
      status: 404,
      i18nKey: 'creation.materials.not_found',
    });
  });
});
