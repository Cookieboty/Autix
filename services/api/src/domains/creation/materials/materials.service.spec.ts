import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MaterialsService } from './materials.service';

/** 测试用站内存储域名基准，与 r2 mock 的 getPublicBaseUrl 返回值保持一致（Task 4.5）。 */
const R2_PUBLIC_BASE = 'https://cdn.autix.test';

function buildService(
  overrides: { repo?: any; folders?: any; membership?: any; r2?: any; favoriteLibrary?: any } = {},
) {
  const repo = {
    findMany: jest.fn().mockResolvedValue([[], 0]),
    create: jest.fn().mockImplementation((d: any) => ({ id: 'm1', ...d })),
    update: jest.fn().mockImplementation((id: string, d: any) => ({ id, ...d })),
    findOwned: jest.fn().mockResolvedValue({ id: 'm1', userId: 'u1' }),
    moveMany: jest.fn().mockResolvedValue({ count: 2 }),
    softDelete: jest.fn(),
    softDeleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    ...(overrides.repo ?? {}),
  };
  const membership = overrides.membership ?? {
    getUserMembership: jest.fn().mockResolvedValue({
      membership: {
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 86_400_000),
        level: { level: 1, name: '会员' },
      },
    }),
  };
  const r2 = {
    createPresignedUpload: jest.fn(),
    getPublicBaseUrl: jest.fn().mockResolvedValue(R2_PUBLIC_BASE),
    ...(overrides.r2 ?? {}),
  };
  const foldersService = {
    assertFolderExists: jest.fn().mockResolvedValue(undefined),
    ...(overrides.folders ?? {}),
  };
  const favoriteLibrary = {
    deleteMaterial: jest.fn().mockResolvedValue(undefined),
    deleteMaterials: jest.fn().mockResolvedValue({ count: 0 }),
    assertUsable: jest.fn().mockResolvedValue(undefined),
    ...(overrides.favoriteLibrary ?? {}),
  };
  const service = new MaterialsService(
    repo as never,
    membership as never,
    r2 as never,
    foldersService as never,
    favoriteLibrary as never,
  );
  return { service, repo, foldersService, membership, r2, favoriteLibrary };
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
      getUserMembership: jest.fn().mockResolvedValue({
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
        create: jest.fn().mockResolvedValue(asset),
        findOwned: jest.fn().mockResolvedValue(asset),
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
      repo: { findOwned: jest.fn().mockResolvedValue(usableAsset) },
      favoriteLibrary: {
        assertUsable: jest.fn().mockRejectedValue(new ForbiddenException('该素材的来源资源已不可用')),
      },
    });
    await expect(service.download('user-1', 'asset-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('download：available/unpublished 放行，返回 downloadUrl', async () => {
    const { service, favoriteLibrary } = buildService({
      repo: { findOwned: jest.fn().mockResolvedValue(usableAsset) },
    });
    await expect(service.download('user-1', 'asset-1')).resolves.toEqual({
      downloadUrl: usableAsset.url,
    });
    expect(favoriteLibrary.assertUsable).toHaveBeenCalledWith(usableAsset);
  });

  it('useAsset：sourceState blocked/missing → ForbiddenException（会员校验通过后仍拦截）', async () => {
    const { service } = buildService({
      repo: { findOwned: jest.fn().mockResolvedValue(usableAsset) },
      favoriteLibrary: {
        assertUsable: jest.fn().mockRejectedValue(new ForbiddenException('该素材的来源资源已不可用')),
      },
    });
    await expect(service.useAsset('user-1', 'asset-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('MaterialsService — Plan C Task 10：move 会员规则（过期只能 其他→默认）', () => {
  const expiredMembership = {
    getUserMembership: jest.fn().mockResolvedValue({
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
