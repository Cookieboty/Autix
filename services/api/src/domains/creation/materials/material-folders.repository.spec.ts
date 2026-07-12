import { MaterialFoldersRepository } from './material-folders.repository';

function delegateMock() {
  return {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
  };
}

function createPrismaMock() {
  const material_folders = delegateMock();
  const material_assets = delegateMock();
  const tx_folders = delegateMock();
  const tx_assets = delegateMock();
  const mock = {
    material_folders,
    material_assets,
    $transaction: jest.fn(async (fn: any) => fn({ material_folders: tx_folders, material_assets: tx_assets })),
    _tx: { material_folders: tx_folders, material_assets: tx_assets },
  };
  return mock;
}

describe('MaterialFoldersRepository', () => {
  it('findManyByUser 只查未删除并按 sortOrder/createdAt 升序', async () => {
    const prisma = createPrismaMock();
    prisma.material_folders.findMany.mockResolvedValue([]);
    const repo = new MaterialFoldersRepository(prisma as never);

    await repo.findManyByUser('u1');

    expect(prisma.material_folders.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('findActiveByName 用大小写不敏感匹配未删除文件夹', async () => {
    const prisma = createPrismaMock();
    prisma.material_folders.findFirst.mockResolvedValue(null);
    const repo = new MaterialFoldersRepository(prisma as never);

    await repo.findActiveByName('u1', 'Logo');

    expect(prisma.material_folders.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        deletedAt: null,
        name: { equals: 'Logo', mode: 'insensitive' },
      },
    });
  });

  // Plan C Task 10：softDeleteWithAssets 已删除——删文件夹连带素材的逻辑改经
  // FavoriteLibraryService.deleteFolder（见 material-folders.service.spec.ts /
  // favorite-library.service.spec.ts 的 deleteFolder 用例），repository 不再自己拼事务。
});
