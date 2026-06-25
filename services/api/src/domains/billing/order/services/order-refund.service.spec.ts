import { OrderStatus, OrderType, Prisma } from '../../../platform/prisma/generated';
import { OrderRefundService } from './order-refund.service';

function buildOrder(input: Partial<any> = {}) {
  return {
    id: 'order-1',
    userId: 'user-1',
    orderNo: 'ORD1',
    status: OrderStatus.PAID,
    orderType: OrderType.MEMBERSHIP,
    productId: 'plan-1',
    externalPaymentId: 'cs-1',
    paidAmount: new Prisma.Decimal('59'),
    amount: new Prisma.Decimal('59'),
    currency: 'USD',
    paymentMetadata: null,
    ...input,
  };
}

function buildHarness(order: any, membership: any) {
  const tx = {};
  const updateUserMembershipByUserIdWithinTx = jest.fn(async () => membership);
  const lockWithinTx = jest.fn(async () => order);
  const orderRepo: any = {
    runInTransaction: async (cb: any) => cb(tx),
    findByIdWithinTxOrThrow: async () => order,
    lockWithinTx,
    clearPendingMembershipChangeForOrderWithinTx: jest.fn(async () => ({ count: 0 })),
    findUserMembershipWithLevelWithinTx: async () => membership,
    updateUserMembershipByUserIdWithinTx,
    updateWithinTx: async (_tx: any, _id: string, _data: any) => ({ ...order, status: OrderStatus.REFUNDED }),
  };
  const paymentEventRepo: any = { upsertRefundEventWithinTx: jest.fn(async () => ({})) };
  const pointReclaimService: any = {
    reclaimAvailableOrderPointsWithinTx: async () => ({
      pointsReclaimed: 0,
      skippedConsumedPoints: 0,
      skippedFrozenPoints: 0,
    }),
  };
  const service = new OrderRefundService(orderRepo, paymentEventRepo, pointReclaimService);
  return { service, updateUserMembershipByUserIdWithinTx, lockWithinTx };
}

describe('OrderRefundService membership revocation', () => {
  it('FIX-16: locks the order row before refunding (serializes concurrent refunds)', async () => {
    const order = buildOrder();
    const { service, lockWithinTx } = buildHarness(order, null);

    await service.refundOrder('order-1');

    expect(lockWithinTx).toHaveBeenCalledWith({}, 'order-1');
  });

  it('revokes the active membership linked to a refunded membership order', async () => {
    const order = buildOrder();
    const membership = { status: 'ACTIVE', planId: 'plan-1', stripeSubscriptionId: 'sub_123' };
    const { service, updateUserMembershipByUserIdWithinTx } = buildHarness(order, membership);

    const result = await service.refundOrder('order-1');

    expect(updateUserMembershipByUserIdWithinTx).toHaveBeenCalledWith(
      {},
      'user-1',
      expect.objectContaining({ status: 'EXPIRED', autoRenew: false }),
    );
    expect(result.membershipRevoked).toBe(true);
    expect(result.cancelSubscriptionId).toBe('sub_123');
  });

  it('does not revoke for a points package refund', async () => {
    const order = buildOrder({ orderType: OrderType.POINTS_PACKAGE });
    const membership = { status: 'ACTIVE', planId: 'plan-1', stripeSubscriptionId: null };
    const { service, updateUserMembershipByUserIdWithinTx } = buildHarness(order, membership);

    const result = await service.refundOrder('order-1');

    expect(updateUserMembershipByUserIdWithinTx).not.toHaveBeenCalled();
    expect(result.membershipRevoked).toBe(false);
    expect(result.cancelSubscriptionId).toBeUndefined();
  });
});
