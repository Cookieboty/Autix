import { CallBillingService, InsufficientPointsError } from './call-billing.service';

function createTx() {
  return {
    user_points: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    points_records: { create: jest.fn().mockResolvedValue({}) },
  };
}

function createPrisma(tx: ReturnType<typeof createTx>) {
  return { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) };
}

describe('CallBillingService.hold (atomic)', () => {
  it('holds via guarded conditional update and writes PENDING record', async () => {
    const tx = createTx();
    tx.user_points.updateMany.mockResolvedValue({ count: 1 });
    tx.user_points.findUniqueOrThrow.mockResolvedValue({ balance: 30 });
    const service = new CallBillingService(createPrisma(tx) as never);

    const { holdId, balance } = await service.hold('u1', 70, { runId: 'run-1' });

    expect(tx.user_points.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', balance: { gte: 70 } },
      data: { balance: { decrement: 70 } },
    });
    expect(balance).toBe(30);
    expect(holdId).toBeTruthy();
    expect(tx.points_records.create).toHaveBeenCalled();
  });

  it('throws InsufficientPointsError (no record) when no row affected', async () => {
    const tx = createTx();
    tx.user_points.updateMany.mockResolvedValue({ count: 0 });
    tx.user_points.findUnique.mockResolvedValue({ balance: 10 });
    const service = new CallBillingService(createPrisma(tx) as never);

    await expect(service.hold('u1', 70, {})).rejects.toBeInstanceOf(
      InsufficientPointsError,
    );
    expect(tx.points_records.create).not.toHaveBeenCalled();
  });
});
