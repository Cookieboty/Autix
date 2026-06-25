import { AdminService } from './admin.service';

function makeAdminService(overrides: {
  refundResult?: any;
  order?: any;
} = {}) {
  const order = overrides.order ?? {
    id: 'order-1',
    status: 'PAID',
    paymentProvider: 'manual',
  };
  const refundResult = overrides.refundResult ?? {
    order: { ...order, status: 'REFUNDED' },
    membershipRevoked: false,
  };
  const orderService: any = {
    getOrderForAdmin: jest.fn().mockResolvedValue(order),
    refundOrder: jest.fn().mockResolvedValue(refundResult),
  };
  const cancelSubscriptionImmediately = jest.fn().mockResolvedValue({ id: 'sub_123' });
  const stripePaymentService: any = { createRefund: jest.fn(), cancelSubscriptionImmediately };
  const auditStore: any = { record: jest.fn() };
  const service = new AdminService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    orderService as never,
    stripePaymentService as never,
    auditStore as never,
    {} as never,
  );
  return { service, cancelSubscriptionImmediately, orderService };
}

const user = { sub: 'admin-1', id: 'admin-1' } as any;

describe('AdminService.refundOrder subscription cancellation', () => {
  it('cancels the Stripe subscription when refund revokes a subscription membership', async () => {
    const { service, cancelSubscriptionImmediately } = makeAdminService({
      refundResult: {
        order: { id: 'order-1', status: 'REFUNDED' },
        membershipRevoked: true,
        cancelSubscriptionId: 'sub_123',
      },
    });

    await service.refundOrder(user, 'order-1', {} as any);

    expect(cancelSubscriptionImmediately).toHaveBeenCalledWith('sub_123');
  });

  it('does not cancel when no membership was revoked', async () => {
    const { service, cancelSubscriptionImmediately } = makeAdminService({
      refundResult: { order: { id: 'order-1' }, membershipRevoked: false },
    });

    await service.refundOrder(user, 'order-1', {} as any);

    expect(cancelSubscriptionImmediately).not.toHaveBeenCalled();
  });

  it('still returns the refund result if subscription cancel fails', async () => {
    const { service, cancelSubscriptionImmediately } = makeAdminService({
      refundResult: {
        order: { id: 'order-1', status: 'REFUNDED' },
        membershipRevoked: true,
        cancelSubscriptionId: 'sub_123',
      },
    });
    cancelSubscriptionImmediately.mockRejectedValueOnce(new Error('stripe down'));

    const result = await service.refundOrder(user, 'order-1', {} as any);

    expect(result.membershipRevoked).toBe(true);
  });
});
