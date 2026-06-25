import { BadRequestException } from '@nestjs/common';
import { OrderStatus, OrderType, Prisma } from '../../../platform/prisma/generated';
import {
  assertRefundAmountWithinPaidAmount,
  buildAlreadyRefundedResult,
  buildMembershipRevocationForRefund,
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
      membershipRevoked: false,
      cancelSubscriptionId: undefined,
      pointsReclaimed: 0,
      skippedConsumedPoints: 0,
      skippedFrozenPoints: 0,
    });
    expect(mergeJsonObjects(['not-object'], { pointsReclaimed: 1 })).toEqual({
      pointsReclaimed: 1,
    });
  });
});

describe('assertRefundAmountWithinPaidAmount', () => {
  const order = {
    paidAmount: new Prisma.Decimal('59'),
    amount: new Prisma.Decimal('69'),
  };

  it('allows a refund up to the paid amount', () => {
    expect(() => assertRefundAmountWithinPaidAmount(order, { amount: '59' })).not.toThrow();
    expect(() => assertRefundAmountWithinPaidAmount(order, { amount: 30 })).not.toThrow();
  });

  it('rejects a refund exceeding the paid amount', () => {
    expect(() => assertRefundAmountWithinPaidAmount(order, { amount: '60' })).toThrow(
      BadRequestException,
    );
  });

  it('defaults to a full refund (paidAmount) when no amount is given', () => {
    expect(() => assertRefundAmountWithinPaidAmount(order, {})).not.toThrow();
  });

  it('falls back to order.amount when paidAmount is null', () => {
    const noPaid = { paidAmount: null, amount: new Prisma.Decimal('69') };
    expect(() => assertRefundAmountWithinPaidAmount(noPaid, { amount: '70' })).toThrow(
      BadRequestException,
    );
    expect(() => assertRefundAmountWithinPaidAmount(noPaid, { amount: '69' })).not.toThrow();
  });
});

describe('buildMembershipRevocationForRefund', () => {
  const now = new Date('2026-06-25T00:00:00.000Z');

  function membershipOrder(input: Partial<any> = {}) {
    return {
      orderType: OrderType.MEMBERSHIP,
      productId: 'plan-1',
      ...input,
    };
  }

  function activeMembership(input: Partial<any> = {}) {
    return {
      status: 'ACTIVE',
      planId: 'plan-1',
      stripeSubscriptionId: null,
      ...input,
    };
  }

  it('revokes an active membership linked to the refunded order by plan', () => {
    const update = buildMembershipRevocationForRefund(
      membershipOrder(),
      activeMembership(),
      { now },
    );

    expect(update).toEqual({
      status: 'EXPIRED',
      expiresAt: now,
      autoRenew: false,
      cancelAtPeriodEnd: false,
      cancelledAt: now,
      pendingPlanId: null,
      pendingOrderId: null,
      pendingLevelId: null,
      pendingBillingCycle: null,
      pendingAutoRenew: null,
      pendingChangeEffectiveAt: null,
      pendingChangeRequestedAt: null,
    });
  });

  it('revokes when the order subscription matches the membership subscription even if plan differs', () => {
    const update = buildMembershipRevocationForRefund(
      membershipOrder({ productId: 'plan-old' }),
      activeMembership({ planId: 'plan-new', stripeSubscriptionId: 'sub_123' }),
      { now, orderSubscriptionId: 'sub_123' },
    );

    expect(update).toMatchObject({ status: 'EXPIRED', cancelledAt: now });
  });

  it('returns null for non-membership orders', () => {
    expect(
      buildMembershipRevocationForRefund(
        membershipOrder({ orderType: OrderType.POINTS_PACKAGE }),
        activeMembership(),
        { now },
      ),
    ).toBeNull();
  });

  it('returns null when there is no membership', () => {
    expect(buildMembershipRevocationForRefund(membershipOrder(), null, { now })).toBeNull();
  });

  it('returns null when the membership is not active', () => {
    expect(
      buildMembershipRevocationForRefund(
        membershipOrder(),
        activeMembership({ status: 'EXPIRED' }),
        { now },
      ),
    ).toBeNull();
  });

  it('returns null when the membership is unrelated (different plan and no subscription match)', () => {
    expect(
      buildMembershipRevocationForRefund(
        membershipOrder({ productId: 'plan-old' }),
        activeMembership({ planId: 'plan-new', stripeSubscriptionId: 'sub_999' }),
        { now, orderSubscriptionId: 'sub_111' },
      ),
    ).toBeNull();
  });
});
