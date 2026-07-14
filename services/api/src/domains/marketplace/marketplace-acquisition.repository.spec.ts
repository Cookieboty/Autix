import { ResourceType } from '../platform/prisma/generated';
import { MarketplaceAcquisitionRepository } from './marketplace-acquisition.repository';

function createPrismaMock() {
  const tx = {
    user_resource_acquisitions: {
      create: vi.fn().mockResolvedValue({ id: 'acq-1' }),
    },
  };

  return {
    tx,
    prisma: {
      user_resource_acquisitions: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      user_points: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((fn: (transaction: typeof tx) => unknown) =>
        fn(tx),
      ),
    },
  };
}

describe('MarketplaceAcquisitionRepository', () => {
  it('creates acquisition after the transaction callback runs', async () => {
    const { prisma, tx } = createPrismaMock();
    const repository = new MarketplaceAcquisitionRepository(prisma as never);
    const beforeCreate = vi.fn().mockResolvedValue(undefined);

    await repository.createAcquisitionInTransaction(
      {
        userId: 'u1',
        resourceType: ResourceType.AGENT,
        resourceId: 'a1',
        pointsPaid: 30,
      },
      beforeCreate,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(beforeCreate).toHaveBeenCalledWith(tx);
    expect(tx.user_resource_acquisitions.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        resourceType: ResourceType.AGENT,
        resourceId: 'a1',
        pointsPaid: 30,
      },
    });
  });

  it('keeps acquisition list filters and ordering in the repository', async () => {
    const { prisma } = createPrismaMock();
    const repository = new MarketplaceAcquisitionRepository(prisma as never);

    await repository.listAcquisitions('u1', ResourceType.SKILL);

    expect(prisma.user_resource_acquisitions.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', resourceType: ResourceType.SKILL },
      orderBy: { acquiredAt: 'desc' },
    });
  });
});
