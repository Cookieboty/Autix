import { ResourceType } from '../../platform/prisma/generated';
import { AcquisitionsService } from './acquisitions.service';

function createMocks() {
  const tx = {
    user_resource_acquisitions: {
      create: jest.fn().mockResolvedValue({ id: 'acq-1' }),
    },
  };
  const prisma = {
    user_resource_acquisitions: { findUnique: jest.fn().mockResolvedValue(null) },
    agents: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'a1',
        title: 'Agent X',
        pointsCost: 480,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    user_points: { findUnique: jest.fn().mockResolvedValue({ balance: 20 }) },
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  };
  const points = { deductWithinTx: jest.fn().mockResolvedValue(20) };
  return { prisma, points, tx };
}

describe('AcquisitionsService.acquire (atomic deduct + record)', () => {
  it('deducts and creates the acquisition inside one transaction', async () => {
    const { prisma, points, tx } = createMocks();
    const service = new AcquisitionsService(prisma as never, points as never);

    const result = await service.acquire('u1', ResourceType.AGENT, 'a1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(points.deductWithinTx).toHaveBeenCalledWith(
      tx,
      'u1',
      480,
      expect.anything(),
      'a1',
      expect.stringContaining('Agent X'),
      'agent_acquisition',
    );
    expect(tx.user_resource_acquisitions.create).toHaveBeenCalled();
    expect(prisma.agents.update).toHaveBeenCalled(); // useCount bump after commit
    expect(result.newBalance).toBe(20);
  });

  it('propagates failure and skips post-commit side effects when create fails', async () => {
    const { prisma, points, tx } = createMocks();
    tx.user_resource_acquisitions.create.mockRejectedValue(new Error('db fail'));
    const service = new AcquisitionsService(prisma as never, points as never);

    await expect(
      service.acquire('u1', ResourceType.AGENT, 'a1'),
    ).rejects.toThrow('db fail');

    // deduction was attempted inside the same tx (DB rolls it back on failure)
    expect(points.deductWithinTx).toHaveBeenCalled();
    // useCount bump only runs after a committed tx
    expect(prisma.agents.update).not.toHaveBeenCalled();
  });
});
