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
  return {
    material_folders,
    material_assets,
    $transaction: jest.fn(async (fn: any) => fn({ material_folders, material_assets })),
  };
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

  it('softDeleteWithAssets 事务内先软删素材再软删文件夹', async () => {
    const prisma = createPrismaMock();
    const repo = new MaterialFoldersRepository(prisma as never);

    await repo.softDeleteWithAssets('u1', 'f1');

    expect(prisma.material_assets.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', folderId: 'f1', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.material_folders.update).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
