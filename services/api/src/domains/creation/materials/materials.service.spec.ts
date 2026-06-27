import { MaterialsService } from './materials.service';

function buildService(overrides: { repo?: any; folders?: any } = {}) {
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
  const membership = {
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
  return { service, repo, foldersService };
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

  it('batchMove 校验目标文件夹并返回 count', async () => {
    const { service, repo, foldersService } = buildService();
    const res = await service.batchMove('u1', ['m1', 'm2'], 'f1');
    expect(foldersService.assertFolderExists).toHaveBeenCalledWith('u1', 'f1');
    expect(repo.moveMany).toHaveBeenCalledWith('u1', ['m1', 'm2'], 'f1');
    expect(res).toEqual({ count: 2 });
  });

  it('batchMove folderId=null(移回未分类)不校验文件夹', async () => {
    const { service, foldersService, repo } = buildService();
    await service.batchMove('u1', ['m1'], null);
    expect(foldersService.assertFolderExists).toHaveBeenCalledWith('u1', null);
    expect(repo.moveMany).toHaveBeenCalledWith('u1', ['m1'], null);
  });
});
