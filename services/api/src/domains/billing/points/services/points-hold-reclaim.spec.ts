import { PointsHoldService } from './points-hold.service';

function buildService(stale: any[]) {
  const findStaleHolds = jest.fn(async () => stale);
  const pointsRepo: any = { findStaleHolds };
  const ledgerService: any = {};
  const service = new PointsHoldService(pointsRepo, ledgerService);
  return { service, findStaleHolds };
}

describe('PointsHoldService.createHold dedup (FIX-9b)', () => {
  it('returns the existing pending hold for the same task instead of creating a duplicate', async () => {
    const tx = {};
    const createHoldWithinTx = jest.fn();
    const pointsRepo: any = {
      runInTransaction: async (cb: any) => cb(tx),
      findPendingHoldByTaskWithinTx: jest.fn(async () => ({ id: 'hold-existing' })),
      findBalanceWithinTx: jest.fn(async () => ({ balance: 500 })),
      createHoldWithinTx,
      findAvailableGrantsWithinTx: jest.fn(async () => []),
    };
    const ledgerService: any = { assertPositiveAmount: jest.fn() };
    const service = new PointsHoldService(pointsRepo, ledgerService);

    const result = await service.createHold('user-1', {
      amount: 10,
      taskType: 'image_generation',
      taskId: 'task-1',
    } as any);

    expect(createHoldWithinTx).not.toHaveBeenCalled();
    expect(result.hold.id).toBe('hold-existing');
    expect(result.balance).toBe(500);
  });
});

describe('PointsHoldService.reclaimOrphanedHolds (FIX-10)', () => {
  it('refunds every stale orphaned hold and reports counts', async () => {
    const { service, findStaleHolds } = buildService([{ id: 'h1' }, { id: 'h2' }]);
    const refundHold = jest.spyOn(service, 'refundHold').mockResolvedValue({} as never);

    const result = await service.reclaimOrphanedHolds({ olderThanMs: 3_600_000, now: new Date('2026-06-25T01:00:00Z') });

    expect(findStaleHolds).toHaveBeenCalledWith(new Date('2026-06-25T00:00:00Z'));
    expect(refundHold).toHaveBeenCalledTimes(2);
    expect(refundHold).toHaveBeenCalledWith('h1', expect.any(String));
    expect(result).toEqual({ scanned: 2, reclaimed: 2 });
  });

  it('continues past a failing refund and counts only successes', async () => {
    const { service } = buildService([{ id: 'h1' }, { id: 'h2' }]);
    const refundHold = jest.spyOn(service, 'refundHold');
    refundHold.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({} as never);

    const result = await service.reclaimOrphanedHolds({ now: new Date() });

    expect(result).toEqual({ scanned: 2, reclaimed: 1 });
  });
});
