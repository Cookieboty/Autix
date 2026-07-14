import { PointsRepository } from './points.repository';

function buildTx() {
  const updateMany = vi.fn(async () => ({ count: 1 }));
  return { tx: { point_grants: { updateMany } }, updateMany };
}

describe('PointsRepository expiry guard (FIX-11)', () => {
  const repo = new PointsRepository({} as never);
  const now = new Date('2026-06-25T00:00:00.000Z');

  it('consumeGrantWithinTx only consumes non-expired grants', async () => {
    const { tx, updateMany } = buildTx();
    await repo.consumeGrantWithinTx(tx as never, { grantId: 'g1', amount: 10, now });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'g1',
        availableAmount: { gte: 10 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: {
        availableAmount: { decrement: 10 },
        consumedAmount: { increment: 10 },
      },
    });
  });

  it('freezeGrantForHoldWithinTx only freezes non-expired grants', async () => {
    const { tx, updateMany } = buildTx();
    await repo.freezeGrantForHoldWithinTx(tx as never, { grantId: 'g1', amount: 5, now });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'g1',
        availableAmount: { gte: 5 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: {
        availableAmount: { decrement: 5 },
        frozenAmount: { increment: 5 },
      },
    });
  });
});

describe('PointsRepository.findHoldByIdWithinTx', () => {
  it('reads a hold by id from the given client', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'hold-1' });
    const repo = new PointsRepository({} as never);

    const result = await repo.findHoldByIdWithinTx({ point_holds: { findUnique } } as never, 'hold-1');

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'hold-1' } });
    expect(result).toEqual({ id: 'hold-1' });
  });

  it('findHoldById reads through the default prisma client', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'hold-2' });
    const repo = new PointsRepository({ point_holds: { findUnique } } as never);

    const result = await repo.findHoldById('hold-2');

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'hold-2' } });
    expect(result).toEqual({ id: 'hold-2' });
  });
});
