import { OrderStatus, Prisma } from '../../../platform/prisma/generated';
import {
  buildAlreadyRefundedResult,
  buildRefundOrderUpdate,
  buildRefundPaymentEventInput,
  mergeJsonObjects,
} from './order-refund.helpers';

function paidOrder(input: Partial<any> = {}) {
  return {
    id: 'order-1',
    userId: 'user-1',
    orderNo: 'ORD1',
    status: OrderStatus.PAID,
    externalPaymentId: 'cs-1',
    paidAmount: new Prisma.Decimal('59'),
    amount: new Prisma.Decimal('69'),
    currency: 'USD',
    ...input,
  };
}

describe('order refund helpers', () => {
  it('builds default manual refund event input from paid order fields', () => {
    expect(
      buildRefundPaymentEventInput(paidOrder(), {
        reason: 'customer service refund',
        metadata: { ticketId: 'T-1' },
      }),
    ).toEqual({
      provider: 'admin_manual',
      externalRefundId: 'manual-refund:order-1',
      orderId: 'order-1',
      userId: 'user-1',
      orderNo: 'ORD1',
      externalPaymentId: 'cs-1',
      amount: new Prisma.Decimal('59'),
      currency: 'USD',
      metadata: { ticketId: 'T-1' },
    });
  });

  it('builds refund order updates with point recovery metadata merged into caller metadata', () => {
    const update = buildRefundOrderUpdate(
      paidOrder({ currency: null, paidAmount: null }),
      {
        pointsReclaimed: 3000,
        skippedConsumedPoints: 2000,
        skippedFrozenPoints: 500,
      },
      {
        amount: '10',
        currency: 'JPY',
        reason: 'partial refund',
        metadata: { ticketId: 'T-1', pointsReclaimed: 1 },
      },
    );

    expect(update).toEqual(
      expect.objectContaining({
        status: OrderStatus.REFUNDED,
        refundProvider: 'admin_manual',
        externalRefundId: 'manual-refund:order-1',
        refundAmount: new Prisma.Decimal('10'),
        refundReason: 'partial refund',
        refundMetadata: {
          ticketId: 'T-1',
          pointsReclaimed: 3000,
          skippedConsumedPoints: 2000,
          skippedFrozenPoints: 500,
        },
        refundedAt: expect.any(Date),
      }),
    );
  });

  it('keeps already-refunded presenter idempotent and merges only object metadata', () => {
    const order = paidOrder({ status: OrderStatus.REFUNDED });

    expect(buildAlreadyRefundedResult(order)).toEqual({
      order,
      alreadyRefunded: true,
      pointsReclaimed: 0,
      skippedConsumedPoints: 0,
      skippedFrozenPoints: 0,
    });
    expect(mergeJsonObjects(['not-object'], { pointsReclaimed: 1 })).toEqual({
      pointsReclaimed: 1,
    });
  });
});
