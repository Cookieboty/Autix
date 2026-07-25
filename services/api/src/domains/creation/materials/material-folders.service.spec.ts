import { MaterialFoldersService } from './material-folders.service';

function buildService(overrides: { repo?: any; favoriteLibrary?: any } = {}) {
  const repo = {
    findManyByUser: vi.fn().mockResolvedValue([]),
    countAssetsGroupedByFolder: vi.fn().mockResolvedValue([]),
    findOwned: vi.fn(),
    findActiveByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((d: any) => ({ id: 'f-new', ...d })),
    update: vi.fn().mockImplementation((id: string, d: any) => ({ id, ...d })),
    ...(overrides.repo ?? {}),
  };
  const favoriteLibrary = {
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    ...(overrides.favoriteLibrary ?? {}),
  };
  const service = new MaterialFoldersService(repo as never, favoriteLibrary as never);
  return { service, repo, favoriteLibrary };
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

  it('create 同名(大小写不敏感)抛 ConflictException', async () => {
    const { service, repo } = buildService();
    repo.findActiveByName.mockResolvedValue({ id: 'f1', name: 'logo' });
    await expect(service.create('u1', { name: 'Logo' })).rejects.toMatchObject({
      status: 409,
      i18nKey: 'creation.materials.folder_name_exists',
    });
  });

  it('create 规范化名(trim)并写入；未给图标时落 null', async () => {
    const { service, repo } = buildService();
    await service.create('u1', { name: '  产品图  ' });
    expect(repo.create).toHaveBeenCalledWith({
      userId: 'u1',
      name: '产品图',
      icon: null,
      sortOrder: 0,
    });
  });

  it('create 带 emoji 图标：原样入库', async () => {
    const { service, repo } = buildService();
    await service.create('u1', { name: '产品图', icon: '🎨' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '产品图', icon: '🎨' }),
    );
  });

  it('create 多码位 ZWJ emoji 完整入库，不从中间劈开', async () => {
    const { service, repo } = buildService();
    // 👨‍👩‍👧‍👦 是 7 码位的 ZWJ 组合序列。列宽 VarChar(16) 放得下，必须原样保留——
    // 截断会得到「两个人 + 一个悬空连接符」的乱码。
    await service.create('u1', { name: '产品图', icon: '👨‍👩‍👧‍👦' });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ icon: '👨‍👩‍👧‍👦' }));
  });

  it('create 图标超出列宽则拒收，而不是截一半存进去', async () => {
    const { service } = buildService();
    await expect(
      service.create('u1', { name: '产品图', icon: 'x'.repeat(17) }),
    ).rejects.toMatchObject({ status: 400, i18nKey: 'creation.materials.invalid_icon' });
  });

  it('create 空白图标视作无图标', async () => {
    const { service, repo } = buildService();
    await service.create('u1', { name: '产品图', icon: '  ' });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ icon: null }));
  });

  it('update 显式传 null 清除图标；不传则不动 icon 字段', async () => {
    const { service, repo } = buildService();
    repo.findOwned.mockResolvedValue({ id: 'f1', userId: 'u1' });
    await service.update('u1', 'f1', { icon: null });
    expect(repo.update).toHaveBeenCalledWith('f1', { icon: null });

    repo.update.mockClear();
    await service.update('u1', 'f1', { sortOrder: 3 });
    expect(repo.update).toHaveBeenCalledWith('f1', { sortOrder: 3 });
  });

  it('create 并发撞 DB 唯一约束(P2002)转成 ConflictException', async () => {
    const { service, repo } = buildService();
    // pre-check passes (race), DB unique index rejects on insert
    repo.findActiveByName.mockResolvedValue(null);
    repo.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    await expect(service.create('u1', { name: 'Logo' })).rejects.toMatchObject({
      status: 409,
      i18nKey: 'creation.materials.folder_name_exists',
    });
  });

  it('update 并发撞 DB 唯一约束(P2002)转成 ConflictException', async () => {
    const { service, repo } = buildService();
    repo.findOwned.mockResolvedValue({ id: 'f1', userId: 'u1' });
    repo.findActiveByName.mockResolvedValue(null);
    repo.update.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    await expect(service.update('u1', 'f1', { name: 'Logo' })).rejects.toMatchObject({
      status: 409,
      i18nKey: 'creation.materials.folder_name_exists',
    });
  });

  it('update 文件夹不存在抛 NotFound(仅归属)', async () => {
    const { service, repo } = buildService();
    repo.findOwned.mockResolvedValue(null);
    await expect(service.update('u1', 'fX', { name: 'B' })).rejects.toMatchObject({
      status: 404,
      i18nKey: 'creation.materials.folder_not_found',
    });
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
    await expect(service.update('u1', 'f1', { name: 'Taken' })).rejects.toMatchObject({
      status: 409,
      i18nKey: 'creation.materials.folder_name_exists',
    });
  });

  it('remove 走 FavoriteLibraryService.deleteFolder(仅归属，FAVORITE 联动取消收藏)', async () => {
    const { service, repo, favoriteLibrary } = buildService();
    repo.findOwned.mockResolvedValue({ id: 'f1', userId: 'u1' });
    await service.remove('u1', 'f1');
    expect(favoriteLibrary.deleteFolder).toHaveBeenCalledWith('u1', 'f1');
  });
});
