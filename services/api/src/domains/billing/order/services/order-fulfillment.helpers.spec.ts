import { BadRequestException } from '@nestjs/common';
import {
  BillingCycle,
  OrderStatus,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../../../platform/prisma/generated';
import {
  assertPaymentAmountMatchesOrder,
  assertPaymentCurrencyMatchesOrder,
  buildManualPaymentWebhookInput,
  buildMembershipGrantInput,
  buildPaidOrderUpdate,
  buildPointsPackageGrantInput,
  currentSubscriptionCycleEnd,
  isActivePaidMembership,
  isPaidPaymentEvent,
  optionalDecimal,
  shouldUpdatePaidOrderPayment,
} from './order-fulfillment.helpers';

describe('order fulfillment helpers', () => {
  it('classifies paid payment events without treating refund success as paid', () => {
    expect(isPaidPaymentEvent({ eventType: 'payment_intent.succeeded' })).toBe(true);
    expect(isPaidPaymentEvent({ eventType: 'invoice.paid', status: 'paid' })).toBe(true);
    expect(isPaidPaymentEvent({ eventType: 'refund.succeeded', status: 'succeeded' })).toBe(false);
    expect(isPaidPaymentEvent({ eventType: 'payment.failed', status: 'failed' })).toBe(false);
  });

  it('keeps paid order updates idempotent unless payment details are provided', () => {
    expect(shouldUpdatePaidOrderPayment({ status: OrderStatus.PAID })).toBe(false);
    expect(
      shouldUpdatePaidOrderPayment(
        { status: OrderStatus.PAID },
        { provider: 'mockpay' },
      ),
    ).toBe(true);
    expect(shouldUpdatePaidOrderPayment({ status: OrderStatus.PENDING })).toBe(true);
  });

  it('builds manual payment webhook input with stable default presenter fields', () => {
    expect(
      buildManualPaymentWebhookInput('order-1', {
        operatorId: 'admin-1',
        remark: 'verified',
        metadata: { channel: 'bank' },
      }),
    ).toEqual({
      provider: 'admin_manual',
      eventId: 'manual-paid:order-1',
      eventType: 'manual.payment.succeeded',
      status: 'succeeded',
      orderId: 'order-1',
      externalPaymentId: 'manual-paid:order-1',
      amount: undefined,
      currency: 'USD',
      payload: {
        operatorId: 'admin-1',
        remark: 'verified',
        metadata: { channel: 'bank' },
      },
    });
  });

  it('builds paid order update data while preserving existing payment fields', () => {
    const paidAt = new Date('2026-06-01T00:00:00.000Z');

    expect(
      buildPaidOrderUpdate(
        {
          paymentProvider: 'stripe',
          paymentEventId: 'evt-existing',
          externalPaymentId: 'cs-existing',
          paidAmount: new Prisma.Decimal('69'),
          amount: new Prisma.Decimal('69'),
          currency: 'USD',
          paidAt,
        },
        { metadata: { retry: true } },
      ),
    ).toEqual(
      expect.objectContaining({
        status: OrderStatus.PAID,
        paidAt,
        paymentProvider: 'stripe',
        paymentEventId: 'evt-existing',
        externalPaymentId: 'cs-existing',
        paidAmount: new Prisma.Decimal('69'),
        currency: 'USD',
        paymentMetadata: { retry: true },
      }),
    );
  });

  it('validates required payment amount while allowing zero amount for zero-priced orders', () => {
    expect(() =>
      assertPaymentAmountMatchesOrder({ amount: 69 }, undefined, { requireAmount: true }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertPaymentAmountMatchesOrder({ amount: 0 }, 0, { requireAmount: true }),
    ).not.toThrow();
    expect(() => assertPaymentAmountMatchesOrder({ amount: 69 }, '69')).not.toThrow();
    expect(() => assertPaymentAmountMatchesOrder({ amount: 69 }, 1)).toThrow(
      BadRequestException,
    );
  });

  it('validates payment currency against the order default currency', () => {
    expect(() =>
      assertPaymentCurrencyMatchesOrder({ currency: null }, undefined, { requireCurrency: true }),
    ).toThrow(BadRequestException);
    expect(() => assertPaymentCurrencyMatchesOrder({ currency: null }, 'usd')).not.toThrow();
    expect(() => assertPaymentCurrencyMatchesOrder({ currency: 'USD' }, 'JPY')).toThrow(
      BadRequestException,
    );
  });

  it('computes the active subscription cycle end for upgrade grants', () => {
    expect(
      currentSubscriptionCycleEnd(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-04-01T00:00:00.000Z'),
        new Date('2026-02-15T00:00:00.000Z'),
      ),
    ).toEqual(new Date('2026-03-01T00:00:00.000Z'));
  });

  it('builds membership grant payloads for yearly paid plans and free plans', () => {
    const paidGrant = buildMembershipGrantInput({
      order: { id: 'order-1', businessType: 'subscription_order' },
      membershipId: 'membership-1',
      plan: {
        id: 'plan-yearly',
        billingCycle: BillingCycle.YEARLY,
        price: new Prisma.Decimal('704'),
        level: { level: 2, name: 'Creator' },
      },
      now: new Date('2026-06-01T00:00:00.000Z'),
      nextExpiresAt: new Date('2027-06-01T00:00:00.000Z'),
      activeMembership: null,
      isUpgrade: false,
      previousPoints: 0,
      pointsToGrant: 6500,
    });

    expect(paidGrant).toEqual(
      expect.objectContaining({
        amount: 6500,
        grantType: PointGrantType.SUBSCRIPTION,
        sourceEvent: PointLedgerEventType.subscription_grant,
        source: PointsSource.MEMBERSHIP,
        expiresAt: new Date('2026-07-01T00:00:00.000Z'),
        usageScope: undefined,
        metadata: expect.objectContaining({
          monthlyGrant: true,
          pointsOnlyForCurrentCycle: true,
          businessType: 'subscription_order',
        }),
      }),
    );

    const freeGrant = buildMembershipGrantInput({
      order: { id: 'order-free', businessType: 'subscription_order' },
      membershipId: 'membership-free',
      plan: {
        id: 'plan-free',
        billingCycle: BillingCycle.MONTHLY,
        price: new Prisma.Decimal('0'),
        level: { level: 1, name: 'Starter Trial' },
      },
      now: new Date('2026-06-01T00:00:00.000Z'),
      nextExpiresAt: new Date('2026-07-01T00:00:00.000Z'),
      activeMembership: null,
      isUpgrade: false,
      previousPoints: 0,
      pointsToGrant: 2500,
    });

    expect(freeGrant).toEqual(
      expect.objectContaining({
        grantType: PointGrantType.GIFT,
        sourceEvent: PointLedgerEventType.campaign_bonus,
        expiresAt: new Date('2026-07-01T00:00:00.000Z'),
        usageScope: {
          excludedTaskTypes: ['video_generation'],
        },
      }),
    );
  });

  it('builds points package grant payloads with package validity metadata', () => {
    expect(
      buildPointsPackageGrantInput({
        orderId: 'order-1',
        packageId: 'pkg-1',
        packageCode: 'standard_topup',
        packageName: '标准包',
        packagePoints: 5500,
        validityDays: 180,
        usageScope: { allowedTaskTypes: [] },
        now: new Date('2026-06-01T00:00:00.000Z'),
      }),
    ).toEqual(
      expect.objectContaining({
        amount: 5500,
        grantType: PointGrantType.PURCHASED,
        sourceEvent: PointLedgerEventType.points_purchase,
        source: PointsSource.PACKAGE,
        expiresAt: new Date('2026-11-28T00:00:00.000Z'),
        usageScope: { allowedTaskTypes: [] },
        metadata: {
          orderId: 'order-1',
          packageId: 'pkg-1',
          packageCode: 'standard_topup',
          validityDays: 180,
        },
        remark: '积分包购买: 标准包',
      }),
    );
  });

  it('checks paid membership activity and optional decimal conversion boundaries', () => {
    expect(
      isActivePaidMembership(
        {
          status: 'ACTIVE',
          expiresAt: new Date('2026-07-01T00:00:00.000Z'),
          level: { level: 2 },
        },
        new Date('2026-06-01T00:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      isActivePaidMembership(
        {
          status: 'ACTIVE',
          expiresAt: new Date('2026-07-01T00:00:00.000Z'),
          level: { level: 0 },
        },
        new Date('2026-06-01T00:00:00.000Z'),
      ),
    ).toBe(false);
    expect(optionalDecimal('')).toBeUndefined();
    expect(optionalDecimal('69')?.toString()).toBe('69');
  });
});
