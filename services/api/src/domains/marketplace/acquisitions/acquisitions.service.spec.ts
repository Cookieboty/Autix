import { ResourceType } from '../../platform/prisma/generated';
import { AcquisitionsService } from './acquisitions.service';

function createMocks() {
  const tx = {
    marker: 'tx',
  };
  const acquisitions = {
    findAcquisition: vi.fn().mockResolvedValue(null),
    createAcquisitionInTransaction: vi.fn(
      async (
        data: unknown,
        beforeCreate?: (transaction: unknown) => Promise<void>,
      ) => {
        await beforeCreate?.(tx);
        return { id: 'acq-1', ...(data as object) };
      },
    ),
    findBalance: vi.fn().mockResolvedValue({ balance: 20 }),
    listAcquisitions: vi.fn(),
  };
  const resources = {
    findOne: vi.fn().mockResolvedValue({
      id: 'a1',
      title: 'Agent X',
      pointsCost: 480,
    }),
    incrementUseCount: vi.fn().mockResolvedValue({}),
    attachResources: vi.fn(),
  };
  const points = { deductWithinTx: vi.fn().mockResolvedValue(20) };
  return { acquisitions, points, resources, tx };
}

describe('AcquisitionsService.acquire (atomic deduct + record)', () => {
  it('deducts and creates the acquisition inside one transaction', async () => {
    const { acquisitions, points, resources, tx } = createMocks();
    const service = new AcquisitionsService(
      acquisitions as never,
      points as never,
      resources as never,
    );

    const result = await service.acquire('u1', ResourceType.AGENT, 'a1');

    expect(acquisitions.createAcquisitionInTransaction).toHaveBeenCalledWith(
      {
        userId: 'u1',
        resourceType: ResourceType.AGENT,
        resourceId: 'a1',
        pointsPaid: 480,
      },
      expect.any(Function),
    );
    expect(points.deductWithinTx).toHaveBeenCalledWith(
      tx,
      'u1',
      480,
      expect.anything(),
      'a1',
      expect.stringContaining('Agent X'),
      'agent_acquisition',
    );
    expect(resources.incrementUseCount).toHaveBeenCalledWith(
      ResourceType.AGENT,
      'a1',
    );
    expect(result.newBalance).toBe(20);
  });

  it('propagates failure and skips post-commit side effects when create fails', async () => {
    const { acquisitions, points, resources, tx } = createMocks();
    acquisitions.createAcquisitionInTransaction.mockImplementation(
      async (
        _data: unknown,
        beforeCreate?: (transaction: unknown) => Promise<void>,
      ) => {
        await beforeCreate?.(tx);
        throw new Error('db fail');
      },
    );
    const service = new AcquisitionsService(
      acquisitions as never,
      points as never,
      resources as never,
    );

    await expect(
      service.acquire('u1', ResourceType.AGENT, 'a1'),
    ).rejects.toThrow('db fail');

    // deduction was attempted inside the same tx (DB rolls it back on failure)
    expect(points.deductWithinTx).toHaveBeenCalled();
    // useCount bump only runs after a committed tx
    expect(resources.incrementUseCount).not.toHaveBeenCalled();
  });
});
