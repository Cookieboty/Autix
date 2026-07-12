import { ForbiddenException } from '@nestjs/common';
import { MaterialsService } from './materials.service';

function buildService(overrides: { repo?: any; folders?: any; membership?: any } = {}) {
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
  const r2 = { createPresignedUpload: jest.fn() };
  const foldersService = {
    assertFolderExists: jest.fn().mockResolvedValue(undefined),
    ...(overrides.folders ?? {}),
  };
  const service = new MaterialsService(repo as never, membership as never, r2 as never, foldersService as never);
  return { service, repo, foldersService, membership };
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
      type: 'image', title: 't', url: 'https://x/y.png',
      sourceType: 'upload', folderId: 'f1',
    });
    expect(foldersService.assertFolderExists).toHaveBeenCalledWith('u1', 'f1');
  });

  it('create 写入 librarySource=UPLOAD（素材库手动上传创建）', async () => {
    const { service, repo } = buildService();
    await service.create('u1', {
      type: 'image', title: 't', url: 'https://x/y.png',
      sourceType: 'upload',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ librarySource: 'UPLOAD' }),
    );
  });

  it('batchMove 校验目标文件夹并返回 count', async () => {
    const { service, repo, foldersService, membership } = buildService();
    const res = await service.batchMove('u1', ['m1', 'm2'], 'f1');
    expect(foldersService.assertFolderExists).toHaveBeenCalledWith('u1', 'f1');
    expect(repo.moveMany).toHaveBeenCalledWith('u1', ['m1', 'm2'], 'f1');
    expect(res).toEqual({ count: 2 });
    expect(membership.getUserMembership).not.toHaveBeenCalled();
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

  it('creates, uses and soft deletes assets for active members', async () => {
    const asset = {
      id: 'asset-1',
      userId: 'user-1',
      type: 'image',
      title: 'asset',
      url: 'https://example.com/a.png',
      sourceType: 'upload',
      tags: [],
      deletedAt: null,
    };
    const { service, repo } = buildService({
      repo: {
        create: jest.fn().mockResolvedValue(asset),
        findOwned: jest.fn().mockResolvedValue(asset),
        softDelete: jest.fn().mockResolvedValue({ ...asset, deletedAt: new Date() }),
      },
    });

    await expect(
      service.create('user-1', {
        type: 'image',
        title: ' asset ',
        url: 'https://example.com/a.png',
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
    await expect(service.remove('user-1', 'asset-1')).resolves.toBeUndefined();
    expect(repo.softDelete).toHaveBeenCalledWith('asset-1');
  });
});
