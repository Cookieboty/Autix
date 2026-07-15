import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MaterialsService } from './materials.service';

/** 测试用站内存储域名基准，与 r2 mock 的 getPublicBaseUrl 返回值保持一致（Task 4.5）。 */
const R2_PUBLIC_BASE = 'https://cdn.autix.test';

function buildService(
  overrides: {
    repo?: any;
    folders?: any;
    membership?: any;
    r2?: any;
    favoriteLibrary?: any;
    activityRepository?: any;
  } = {},
) {
  const repo = {
    findMany: vi.fn().mockResolvedValue([[], 0]),
    create: vi.fn().mockImplementation((d: any) => ({ id: 'm1', ...d })),
    update: vi.fn().mockImplementation((id: string, d: any) => ({ id, ...d })),
    findOwned: vi.fn().mockResolvedValue({ id: 'm1', userId: 'u1' }),
    moveMany: vi.fn().mockResolvedValue({ count: 2 }),
    softDelete: vi.fn(),
    softDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    ...(overrides.repo ?? {}),
  };
  const membership = overrides.membership ?? {
    getUserMembership: vi.fn().mockResolvedValue({
      membership: {
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 86_400_000),
        level: { level: 1, name: '会员' },
      },
    }),
  };
  const r2 = {
    createPresignedUpload: vi.fn(),
    getPublicBaseUrl: vi.fn().mockResolvedValue(R2_PUBLIC_BASE),
    ...(overrides.r2 ?? {}),
  };
  const foldersService = {
    assertFolderExists: vi.fn().mockResolvedValue(undefined),
    ...(overrides.folders ?? {}),
  };
  const favoriteLibrary = {
    deleteMaterial: vi.fn().mockResolvedValue(undefined),
    deleteMaterials: vi.fn().mockResolvedValue({ count: 0 }),
    assertUsable: vi.fn().mockResolvedValue(undefined),
    deriveSourceState: vi.fn().mockResolvedValue(new Map()),
    saveHistoryMaterial: vi.fn().mockResolvedValue({ id: 'hist-1', librarySource: 'HISTORY' }),
    ...(overrides.favoriteLibrary ?? {}),
  };
  const activityRepository = {
    hasViewed: vi.fn().mockResolvedValue(true),
    listHistory: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    ...(overrides.activityRepository ?? {}),
  };
  const service = new MaterialsService(
    repo as never,
    membership as never,
    r2 as never,
    foldersService as never,
    favoriteLibrary as never,
    activityRepository as never,
  );
  return { service, repo, foldersService, membership, r2, favoriteLibrary, activityRepository };
}

describe('MaterialsService folder support', () => {
  it('list folderId="root" → where.folderId 为 null', async () => {
    const { service, repo } = buildService();
    await service.list('u1', { folderId: 'root' });
    const where = repo.findMany.mock.calls[0][0].where;
    expect(where.folderId).toBeNull();
  });

  it('list folderId=具体 id → where.folderId = id', async () => {
    const { service, repo } = buildService();
    await service.list('u1', { folderId: 'f1' });
    const where = repo.findMany.mock.calls[0][0].where;
    expect(where.folderId).toBe('f1');
  });

  it('list 不传 folderId → where 不含 folderId 键', async () => {
    const { service, repo } = buildService();
    await service.list('u1', {});
    const where = repo.findMany.mock.calls[0][0].where;
    expect('folderId' in where).toBe(false);
  });

  it('create 带 folderId 时校验文件夹存在', async () => {
    const { service, foldersService } = buildService();
    await service.create('u1', {
      type: 'image', title: 't', url: `${R2_PUBLIC_BASE}/y.png`,
      sourceType: 'upload', folderId: 'f1',
    });
    expect(foldersService.assertFolderExists).toHaveBeenCalledWith('u1', 'f1');
  });

  it('create 写入 librarySource=UPLOAD（素材库手动上传创建）', async () => {
    const { service, repo } = buildService();
    await service.create('u1', {
      type: 'image', title: 't', url: `${R2_PUBLIC_BASE}/y.png`,
      sourceType: 'upload',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ librarySource: 'UPLOAD' }),
    );
  });

  it('batchMove 校验目标文件夹并返回 count（Plan C Task 10：非 null 目标需过一次会员校验）', async () => {
    const { service, repo, foldersService, membership } = buildService();
    const res = await service.batchMove('u1', ['m1', 'm2'], 'f1');
    expect(foldersService.assertFolderExists).toHaveBeenCalledWith('u1', 'f1');
    expect(repo.moveMany).toHaveBeenCalledWith('u1', ['m1', 'm2'], 'f1');
    expect(res).toEqual({ count: 2 });
    expect(membership.getUserMembership).toHaveBeenCalled(); // 活跃会员：放行但仍需查一次
  });

  it('batchMove folderId=null → assertFolderExists called with null (no-op)', async () => {
    const { service, foldersService, repo, membership } = buildService();
    await service.batchMove('u1', ['m1'], null);
    expect(foldersService.assertFolderExists).toHaveBeenCalledWith('u1', null);
    expect(repo.moveMany).toHaveBeenCalledWith('u1', ['m1'], null);
    expect(membership.getUserMembership).not.toHaveBeenCalled();
  });

  it('update with folderId="f1" → assertFolderExists called and folder connect used', async () => {
    const { service, repo, foldersService } = buildService();
    await service.update('u1', 'm1', { folderId: 'f1' });
    expect(foldersService.assertFolderExists).toHaveBeenCalledWith('u1', 'f1');
    expect(repo.update).toHaveBeenCalledWith('m1', expect.objectContaining({
      folder: { connect: { id: 'f1' } },
    }));
  });

  it('update with folderId=null → folder disconnect used', async () => {
    const { service, repo } = buildService();
    await service.update('u1', 'm1', { folderId: null });
    expect(repo.update).toHaveBeenCalledWith('m1', expect.objectContaining({
      folder: { disconnect: true },
    }));
  });
});

describe('MaterialsService entitlement', () => {
  it('allows expired members to list assets but blocks add and use', async () => {
    const expiredMembershipMock = {
      getUserMembership: vi.fn().mockResolvedValue({
        membership: {
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() - 86_400_000),
          level: { level: 1, name: 'Starter' },
        },
      }),
    };
    const { service } = buildService({ membership: expiredMembershipMock });

    await expect(service.list('user-1', {})).resolves.toMatchObject({
      entitlement: { canAdd: false, canUse: false },
    });
    await expect(
      service.create('user-1', {
        type: 'image',
        title: 'asset',
        url: 'https://example.com/a.png',
        sourceType: 'upload',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.useAsset('user-1', 'asset-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates and uses assets for active members; remove/useAsset 走 FavoriteLibraryService', async () => {
    const asset = {
      id: 'asset-1',
      userId: 'user-1',
      type: 'image',
      title: 'asset',
      url: `${R2_PUBLIC_BASE}/a.png`,
      sourceType: 'upload',
      librarySource: 'UPLOAD',
      sourceResourceType: null,
      sourceId: null,
      tags: [],
      deletedAt: null,
    };
    const { service, repo, favoriteLibrary } = buildService({
      repo: {
        create: vi.fn().mockResolvedValue(asset),
        findOwned: vi.fn().mockResolvedValue(asset),
      },
    });

    await expect(
      service.create('user-1', {
        type: 'image',
        title: ' asset ',
        url: `${R2_PUBLIC_BASE}/a.png`,
        sourceType: 'upload',
        tags: [' ref ', 'ref', ''],
      }),
    ).resolves.toMatchObject({ id: 'asset-1' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'asset',
        tags: ['ref'],
      }),
    );

    await expect(service.useAsset('user-1', 'asset-1')).resolves.toMatchObject({ id: 'asset-1' });
    expect(favoriteLibrary.assertUsable).toHaveBeenCalledWith(asset);

    await expect(service.remove('user-1', 'asset-1')).resolves.toBeUndefined();
    expect(favoriteLibrary.deleteMaterial).toHaveBeenCalledWith('user-1', 'asset-1');
  });
});

describe('MaterialsService — Plan C Task 10：download / useAsset 的 sourceState 拦截', () => {
  const usableAsset = {
    id: 'asset-1',
    userId: 'user-1',
    type: 'image',
    url: `${R2_PUBLIC_BASE}/a.png`,
    thumbnailUrl: null,
    librarySource: 'FAVORITE',
    sourceResourceType: 'GALLERY_POST',
    sourceId: 'g1',
    deletedAt: null,
  };

  it('download：来源 blocked/missing → ForbiddenException（assertUsable 抛出）', async () => {
    const { service } = buildService({
      repo: { findOwned: vi.fn().mockResolvedValue(usableAsset) },
      favoriteLibrary: {
        assertUsable: vi.fn().mockRejectedValue(new ForbiddenException('该素材的来源资源已不可用')),
      },
    });
    await expect(service.download('user-1', 'asset-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('download：available/unpublished 放行，返回 downloadUrl', async () => {
    const { service, favoriteLibrary } = buildService({
      repo: { findOwned: vi.fn().mockResolvedValue(usableAsset) },
    });
    await expect(service.download('user-1', 'asset-1')).resolves.toEqual({
      downloadUrl: usableAsset.url,
    });
    expect(favoriteLibrary.assertUsable).toHaveBeenCalledWith(usableAsset);
  });

  it('useAsset：sourceState blocked/missing → ForbiddenException（会员校验通过后仍拦截）', async () => {
    const { service } = buildService({
      repo: { findOwned: vi.fn().mockResolvedValue(usableAsset) },
      favoriteLibrary: {
        assertUsable: vi.fn().mockRejectedValue(new ForbiddenException('该素材的来源资源已不可用')),
      },
    });
    await expect(service.useAsset('user-1', 'asset-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('MaterialsService — Plan C Task 10：move 会员规则（过期只能 其他→默认）', () => {
  const expiredMembership = {
    getUserMembership: vi.fn().mockResolvedValue({
      membership: {
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 86_400_000),
        level: { level: 1, name: 'Starter' },
      },
    }),
  };

  it('update：会员过期，默认(null)→其他文件夹 → ForbiddenException', async () => {
    const { service } = buildService({ membership: expiredMembership });
    await expect(service.update('user-1', 'm1', { folderId: 'folder-x' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('update：会员过期，其他文件夹→默认(null) → 放行', async () => {
    const { service, repo } = buildService({ membership: expiredMembership });
    await expect(service.update('user-1', 'm1', { folderId: null })).resolves.toBeDefined();
    expect(repo.update).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ folder: { disconnect: true } }),
    );
  });

  it('batchMove：会员过期，目标为具体文件夹 → ForbiddenException', async () => {
    const { service } = buildService({ membership: expiredMembership });
    await expect(service.batchMove('user-1', ['m1'], 'folder-x')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('batchMove：会员过期，目标为 null（移回默认） → 放行', async () => {
    const { service, repo } = buildService({ membership: expiredMembership });
    await expect(service.batchMove('user-1', ['m1'], null)).resolves.toEqual({ count: 2 });
    expect(repo.moveMany).toHaveBeenCalledWith('user-1', ['m1'], null);
  });

  it('update/batchMove：活跃会员不受限，任意方向都放行', async () => {
    const { service } = buildService();
    await expect(service.update('user-1', 'm1', { folderId: 'folder-x' })).resolves.toBeDefined();
    await expect(service.batchMove('user-1', ['m1'], 'folder-x')).resolves.toEqual({ count: 2 });
  });
});

describe('MaterialsService.create — Task 4.5：站内来源写入守卫', () => {
  it('拒绝公网 URL / external 来源', async () => {
    const { service } = buildService();
    await expect(
      service.create('u1', {
        type: 'image',
        title: 'evil',
        url: 'https://evil.com/x.png',
        sourceType: 'external',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('拒绝非站内 host 的 url（即便 sourceType 是合法的 upload）', async () => {
    const { service } = buildService();
    await expect(
      service.create('u1', {
        type: 'image',
        title: 'evil upload',
        url: 'https://evil.com/x.png',
        sourceType: 'upload',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('拒绝 sourceType=external（即使 url 本身是站内域名）', async () => {
    const { service } = buildService();
    await expect(
      service.create('u1', {
        type: 'image',
        title: 'external',
        url: `${R2_PUBLIC_BASE}/a.png`,
        sourceType: 'external',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('拒绝非站内 host 的 thumbnailUrl', async () => {
    const { service } = buildService();
    await expect(
      service.create('u1', {
        type: 'image',
        title: 'evil thumb',
        url: `${R2_PUBLIC_BASE}/a.png`,
        thumbnailUrl: 'https://evil.com/thumb.png',
        sourceType: 'upload',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('站内 url（image_generation 来源）放行', async () => {
    const { service, repo } = buildService();
    await expect(
      service.create('u1', {
        type: 'image',
        title: 'from gen',
        url: `${R2_PUBLIC_BASE}/gen-a.png`,
        sourceType: 'image_generation',
      }),
    ).resolves.toMatchObject({ id: 'm1' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${R2_PUBLIC_BASE}/gen-a.png` }),
    );
  });
});

describe('MaterialsService.update — Task 4.6：thumbnailUrl 站内守卫', () => {
  it('拒绝非站内 host 的 thumbnailUrl', async () => {
    const { service } = buildService();
    await expect(
      service.update('u1', 'm1', { thumbnailUrl: 'https://evil.com/thumb.png' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('站内 thumbnailUrl 放行并写入', async () => {
    const { service, repo } = buildService();
    await service.update('u1', 'm1', { thumbnailUrl: `${R2_PUBLIC_BASE}/thumb.png` });
    expect(repo.update).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ thumbnailUrl: `${R2_PUBLIC_BASE}/thumb.png` }),
    );
  });

  it('thumbnailUrl=null（清空）不触发 host 校验', async () => {
    const { service, repo } = buildService();
    await service.update('u1', 'm1', { thumbnailUrl: null });
    expect(repo.update).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ thumbnailUrl: null }),
    );
  });
});

describe('MaterialsService.list — Plan C Task 11：librarySource 筛选 + sourceState 批量回填', () => {
  const items = [
    { id: 'm1', librarySource: 'FAVORITE', sourceResourceType: 'GALLERY_POST', sourceId: 'g1' },
    { id: 'm2', librarySource: 'UPLOAD', sourceResourceType: null, sourceId: null },
  ];

  it('传 librarySource 时 where.librarySource 归一化为大写枚举值', async () => {
    const { service, repo } = buildService();
    await service.list('u1', { librarySource: 'history' });
    const where = repo.findMany.mock.calls[0][0].where;
    expect(where.librarySource).toBe('HISTORY');
  });

  it('不传 librarySource 时 where 不含 librarySource 键', async () => {
    const { service, repo } = buildService();
    await service.list('u1', {});
    const where = repo.findMany.mock.calls[0][0].where;
    expect('librarySource' in where).toBe(false);
  });

  it('librarySource 传非法值 → BadRequestException', async () => {
    const { service } = buildService();
    await expect(service.list('u1', { librarySource: 'bogus' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('列表项批量带回 sourceState（一次 deriveSourceState 调用，覆盖全部 items——不 N+1）', async () => {
    const stateMap = new Map([
      ['m1', 'blocked'],
      ['m2', 'available'],
    ]);
    const { service, favoriteLibrary } = buildService({
      repo: { findMany: vi.fn().mockResolvedValue([items, items.length]) },
      favoriteLibrary: { deriveSourceState: vi.fn().mockResolvedValue(stateMap) },
    });

    const result = await service.list('u1', {});

    expect(favoriteLibrary.deriveSourceState).toHaveBeenCalledTimes(1);
    expect(favoriteLibrary.deriveSourceState).toHaveBeenCalledWith(items);
    expect(result.items).toEqual([
      { ...items[0], sourceState: 'blocked' },
      { ...items[1], sourceState: 'available' },
    ]);
  });
});

describe('MaterialsService.saveFromHistory — Plan C Task 11：反伪造 + 类型校验', () => {
  it('resourceType 不属可映射类型（如 SKILL）→ BadRequestException，不查 resource_views', async () => {
    const { service, activityRepository } = buildService();
    await expect(service.saveFromHistory('u1', 'SKILL', 'r1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(activityRepository.hasViewed).not.toHaveBeenCalled();
  });

  it('resourceId 为空 → BadRequestException', async () => {
    const { service } = buildService();
    await expect(service.saveFromHistory('u1', 'GALLERY_POST', '  ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('用户未浏览过该资源（hasViewed=false）→ BadRequestException，不落素材（反伪造历史保存）', async () => {
    const { service, favoriteLibrary, activityRepository } = buildService({
      activityRepository: { hasViewed: vi.fn().mockResolvedValue(false) },
    });
    await expect(service.saveFromHistory('u1', 'GALLERY_POST', 'g1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(activityRepository.hasViewed).toHaveBeenCalledWith('u1', 'GALLERY_POST', 'g1');
    expect(favoriteLibrary.saveHistoryMaterial).not.toHaveBeenCalled();
  });

  it('校验通过 → 落 librarySource=HISTORY（委托 FavoriteLibraryService.saveHistoryMaterial）', async () => {
    const { service, favoriteLibrary, activityRepository } = buildService();
    const result = await service.saveFromHistory('u1', 'GALLERY_POST', 'g1');
    expect(activityRepository.hasViewed).toHaveBeenCalledWith('u1', 'GALLERY_POST', 'g1');
    expect(favoriteLibrary.saveHistoryMaterial).toHaveBeenCalledWith('u1', 'GALLERY_POST', 'g1');
    expect(result).toEqual({ id: 'hist-1', librarySource: 'HISTORY' });
  });
});

describe('MaterialsService.listHistory — Plan C Task 11：GET /materials/history 游标分页', () => {
  const viewedAt = new Date('2026-07-01T10:00:00.000Z');
  const nextCursor = { viewedAt, resourceType: 'GALLERY_POST', resourceId: 'g1' };

  it('无 cursor → 以 undefined 游标查询，take 默认 30', async () => {
    const { service, activityRepository } = buildService();
    await service.listHistory('u1', {});
    expect(activityRepository.listHistory).toHaveBeenCalledWith('u1', undefined, 30);
  });

  it('take 归一化：越界收敛到 [1,100]，非数字回落默认值（NaN 绝不进 SQL 的 LIMIT）', async () => {
    const { service, activityRepository } = buildService();
    await service.listHistory('u1', { take: 999 });
    expect(activityRepository.listHistory).toHaveBeenLastCalledWith('u1', undefined, 100);
    await service.listHistory('u1', { take: 0 });
    expect(activityRepository.listHistory).toHaveBeenLastCalledWith('u1', undefined, 1);
    await service.listHistory('u1', { take: Number('abc') });
    expect(activityRepository.listHistory).toHaveBeenLastCalledWith('u1', undefined, 30);
  });

  it('nextCursor 编码为不透明串；把它回传能解码回同一个三元组（游标往返闭环）', async () => {
    const { service, activityRepository } = buildService({
      activityRepository: {
        hasViewed: vi.fn(),
        listHistory: vi.fn().mockResolvedValue({ items: [], nextCursor }),
      },
    });

    const page1 = await service.listHistory('u1', {});
    expect(typeof page1.nextCursor).toBe('string');
    expect(page1.nextCursor).not.toContain('g1'); // 不透明：不是明文三元组

    await service.listHistory('u1', { cursor: page1.nextCursor! });
    const passed = activityRepository.listHistory.mock.calls[1][1];
    expect(passed.resourceType).toBe('GALLERY_POST');
    expect(passed.resourceId).toBe('g1');
    expect(passed.viewedAt.getTime()).toBe(viewedAt.getTime());
  });

  it('nextCursor 为 null 时透传 null（无下一页）', async () => {
    const { service } = buildService();
    await expect(service.listHistory('u1', {})).resolves.toMatchObject({ nextCursor: null });
  });

  it.each([
    ['非 base64/非 JSON 的垃圾串', 'not-a-valid-cursor!!!'],
    ['合法 base64 但不是对象', Buffer.from('"just-a-string"', 'utf8').toString('base64url')],
    [
      'viewedAt 不是可解析时间',
      Buffer.from(
        JSON.stringify({ viewedAt: 'nonsense', resourceType: 'GALLERY_POST', resourceId: 'g1' }),
        'utf8',
      ).toString('base64url'),
    ],
    [
      'resourceType 不是合法枚举（防止畸形值进 SQL 的枚举 cast）',
      Buffer.from(
        JSON.stringify({
          viewedAt: '2026-07-01T10:00:00.000Z',
          resourceType: `X'; DROP TABLE "resource_views"; --`,
          resourceId: 'g1',
        }),
        'utf8',
      ).toString('base64url'),
    ],
    [
      'resourceId 为空',
      Buffer.from(
        JSON.stringify({
          viewedAt: '2026-07-01T10:00:00.000Z',
          resourceType: 'GALLERY_POST',
          resourceId: '   ',
        }),
        'utf8',
      ).toString('base64url'),
    ],
  ])('畸形 cursor(%s) → BadRequestException，且绝不查询到仓储层', async (_label, cursor) => {
    const { service, activityRepository } = buildService();
    await expect(service.listHistory('u1', { cursor: cursor as string })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(activityRepository.listHistory).not.toHaveBeenCalled();
  });
});
