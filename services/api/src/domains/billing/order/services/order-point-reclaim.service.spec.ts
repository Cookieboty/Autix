import { OrderType } from '../../../platform/prisma/generated';
import { OrderPointReclaimService } from './order-point-reclaim.service';

function buildHarness(grant: any, userPoints: any) {
  const updateUserPointsWithinTx = vi.fn(async () => ({ balance: userPoints.balance }));
  const updatePointGrantWithinTx = vi.fn(async () => ({}));
  const orderRepo: any = {
    findPointGrantsByOrderEventsWithinTx: async () => [grant],
    findUserPointsWithinTx: async () => userPoints,
    updatePointGrantWithinTx,
    updateUserPointsWithinTx,
    createPointsRecordWithinTx: vi.fn(async () => ({})),
  };
  const service = new OrderPointReclaimService(orderRepo);
  return { service, updateUserPointsWithinTx, updatePointGrantWithinTx };
}

const order = { id: 'order-1', orderType: OrderType.MEMBERSHIP } as any;
const tx = {} as any;

describe('OrderPointReclaimService FIX-19 (no negative balance)', () => {
  it('clamps the reclaim to the live balance so user_points never goes negative', async () => {
    const grant = {
      id: 'grant-1',
      userId: 'user-1',
      grantType: 'GIFT',
      availableAmount: 100,
      consumedAmount: 0,
      frozenAmount: 0,
      expiredAmount: 0,
    };
    // Aggregate has drifted below the grant's available amount.
    const userPoints = { balance: 30, availableBalance: 30, totalBalance: 30, giftBalance: 30 };
    const { service, updateUserPointsWithinTx, updatePointGrantWithinTx } = buildHarness(
      grant,
      userPoints,
    );

    const result = await service.reclaimAvailableOrderPointsWithinTx(tx, order, 'refund');

    expect(result.pointsReclaimed).toBe(30);
    expect(updateUserPointsWithinTx).toHaveBeenCalledWith(
      tx,
      'user-1',
      expect.objectContaining({
        balance: { decrement: 30 },
        availableBalance: { decrement: 30 },
        totalBalance: { decrement: 30 },
        giftBalance: { decrement: 30 },
      }),
    );
    expect(updatePointGrantWithinTx).toHaveBeenCalledWith(
      tx,
      'grant-1',
      expect.objectContaining({ availableAmount: { decrement: 30 } }),
    );
  });

  it('reclaims the full available amount when the balance is consistent', async () => {
    const grant = {
      id: 'grant-1',
      userId: 'user-1',
      grantType: 'GIFT',
      availableAmount: 40,
      consumedAmount: 0,
      frozenAmount: 0,
      expiredAmount: 0,
    };
    const userPoints = { balance: 40, availableBalance: 40, totalBalance: 40, giftBalance: 40 };
    const { service } = buildHarness(grant, userPoints);

    const result = await service.reclaimAvailableOrderPointsWithinTx(tx, order, 'refund');
    expect(result.pointsReclaimed).toBe(40);
  });
});
