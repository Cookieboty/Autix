import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MaterialFoldersService } from './material-folders.service';

function buildService(overrides: { repo?: any; canUse?: boolean; favoriteLibrary?: any } = {}) {
  const repo = {
    findManyByUser: vi.fn().mockResolvedValue([]),
    countAssetsGroupedByFolder: vi.fn().mockResolvedValue([]),
    findOwned: vi.fn(),
    findActiveByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((d: any) => ({ id: 'f-new', ...d })),
    update: vi.fn().mockImplementation((id: string, d: any) => ({ id, ...d })),
    ...(overrides.repo ?? {}),
  };
  const materialsService = {
    assertCanAddOrUse: vi.fn().mockImplementation(async () => {
      if (overrides.canUse === false) throw new ForbiddenException('需要有效会员');
      return { canUse: true };
    }),
  };
  const favoriteLibrary = {
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    ...(overrides.favoriteLibrary ?? {}),
  };
  const service = new MaterialFoldersService(repo as never, materialsService as never, favoriteLibrary as never);
  return { service, repo, materialsService, favoriteLibrary };
}

describe('MaterialFoldersService', () => {
  it('listSidebar 合并计数并产出 total/root', async () => {
    const { service, repo } = buildService();
    repo.findManyByUser.mockResolvedValue([
      { id: 'f1', userId: 'u1', name: 'A', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
    ]);
    repo.countAssetsGroupedByFolder.mockResolvedValue([
      { folderId: 'f1', count: 3 },
      { folderId: null, count: 2 },
    ]);

    const result = await service.listSidebar('u1');

    expect(result.folders[0].assetCount).toBe(3);
    expect(result.rootAssetCount).toBe(2);
    expect(result.totalAssetCount).toBe(5);
  });

  it('create 非会员被拒', async () => {
    const { service } = buildService({ canUse: false });
    await expect(service.create('u1', { name: 'A' })).rejects.toThrow(ForbiddenException);
  });

  it('create 同名(大小写不敏感)抛 ConflictException', async () => {
    const { service, repo } = buildService();
    repo.findActiveByName.mockResolvedValue({ id: 'f1', name: 'logo' });
    await expect(service.create('u1', { name: 'Logo' })).rejects.toThrow(ConflictException);
  });

  it('create 规范化名(trim)并写入', async () => {
    const { service, repo } = buildService();
    await service.create('u1', { name: '  产品图  ' });
    expect(repo.create).toHaveBeenCalledWith({ userId: 'u1', name: '产品图', sortOrder: 0 });
  });

  it('create 并发撞 DB 唯一约束(P2002)转成 ConflictException', async () => {
    const { service, repo } = buildService();
    // pre-check passes (race), DB unique index rejects on insert
    repo.findActiveByName.mockResolvedValue(null);
    repo.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    await expect(service.create('u1', { name: 'Logo' })).rejects.toThrow(ConflictException);
  });

  it('update 并发撞 DB 唯一约束(P2002)转成 ConflictException', async () => {
    const { service, repo } = buildService();
    repo.findOwned.mockResolvedValue({ id: 'f1', userId: 'u1' });
    repo.findActiveByName.mockResolvedValue(null);
    repo.update.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    await expect(service.update('u1', 'f1', { name: 'Logo' })).rejects.toThrow(ConflictException);
  });

  it('update 文件夹不存在抛 NotFound(仅归属,不校验会员)', async () => {
    const { service, repo, materialsService } = buildService();
    repo.findOwned.mockResolvedValue(null);
    await expect(service.update('u1', 'fX', { name: 'B' })).rejects.toThrow(NotFoundException);
    expect(materialsService.assertCanAddOrUse).not.toHaveBeenCalled();
  });

  it('update 成功改名:名称空闲则调用 repo.update', async () => {
    const { service, repo } = buildService();
    repo.findOwned.mockResolvedValue({ id: 'f1', userId: 'u1' });
    repo.findActiveByName.mockResolvedValue(null);
    await service.update('u1', 'f1', { name: 'NewName' });
    expect(repo.update).toHaveBeenCalledWith('f1', { name: 'NewName' });
  });

  it('update 自我重命名不抛异常(排除自身 id)', async () => {
    const { service, repo } = buildService();
    repo.findOwned.mockResolvedValue({ id: 'f1', userId: 'u1' });
    repo.findActiveByName.mockResolvedValue({ id: 'f1', name: 'newname' });
    await service.update('u1', 'f1', { name: 'NewName' });
    expect(repo.update).toHaveBeenCalled();
  });

  it('update 重命名为他人已有文件夹名称抛 ConflictException', async () => {
    const { service, repo } = buildService();
    repo.findOwned.mockResolvedValue({ id: 'f1', userId: 'u1' });
    repo.findActiveByName.mockResolvedValue({ id: 'f2', name: 'taken' });
    await expect(service.update('u1', 'f1', { name: 'Taken' })).rejects.toThrow(ConflictException);
  });

  it('remove 走 FavoriteLibraryService.deleteFolder(仅归属，FAVORITE 联动取消收藏)', async () => {
    const { service, repo, materialsService, favoriteLibrary } = buildService();
    repo.findOwned.mockResolvedValue({ id: 'f1', userId: 'u1' });
    await service.remove('u1', 'f1');
    expect(favoriteLibrary.deleteFolder).toHaveBeenCalledWith('u1', 'f1');
    expect(materialsService.assertCanAddOrUse).not.toHaveBeenCalled();
  });
});
