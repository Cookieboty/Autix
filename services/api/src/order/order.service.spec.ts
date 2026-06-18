import { BadRequestException } from '@nestjs/common';
import {
  BillingCycle,
  OrderStatus,
  OrderType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
} from '../prisma/generated';
import { OrderService } from './order.service';

function createTx() {
  return {
    orders: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    payment_events: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    point_grants: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    membership_plans: {
      findUnique: jest.fn(),
    },
    user_memberships: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    points_packages: {
      findUnique: jest.fn(),
    },
    user_points: {
      update: jest.fn(),
    },
    points_records: {
      create: jest.fn(),
    },
  };
}

function createService(tx: ReturnType<typeof createTx>) {
  const prisma = {
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    payment_events: {
      update: jest.fn(async () => undefined),
    },
  };
  const points = {
    grantPointsWithinTx: jest.fn(async (_tx: unknown, _userId: string, input: any) => ({
      grant: { id: 'grant-1', ...input },
      balance: input.amount,
    })),
  };
  return {
    service: new OrderService(prisma as never, points as never),
    prisma,
    points,
  };
}

function pendingOrder(input?: Partial<any>) {
  return {
    id: 'order-1',
    userId: 'user-1',
    orderNo: 'ORD1',
    orderType: OrderType.MEMBERSHIP,
    businessType: 'subscription_order',
    productId: 'plan-1',
    productName: 'Creator - 年付',
    originalPrice: 828,
    amount: 704,
    isFirstTime: false,
    status: OrderStatus.PENDING,
    paidAt: null,
    fulfilledAt: null,
    paymentProvider: null,
    externalPaymentId: null,
    paymentEventId: null,
    paidAmount: null,
    currency: null,
    paymentMetadata: null,
    refundProvider: null,
    externalRefundId: null,
    refundAmount: null,
    refundReason: null,
    refundMetadata: null,
    refundedAt: null,
    createdAt: new Date('2026-06-14T00:00:00.000Z'),
    updatedAt: new Date('2026-06-14T00:00:00.000Z'),
    ...input,
  };
}

describe('OrderService.markPaidAndFulfill', () => {
  it('fulfills yearly membership by activating the full term but granting only the current monthly points', async () => {
    const tx = createTx();
    const { service, points } = createService(tx);
    const order = pendingOrder();
    tx.orders.findUnique.mockResolvedValue(order);
    tx.orders.update.mockResolvedValue({ ...order, status: OrderStatus.PAID });
    tx.point_grants.findFirst.mockResolvedValue(null);
    tx.membership_plans.findUnique.mockResolvedValue({
      id: 'plan-1',
      levelId: 'level-creator',
      billingCycle: BillingCycle.YEARLY,
      months: 12,
      autoRenew: false,
      points: 6500,
      price: 704,
      level: { level: 2, name: 'Creator' },
    });
    tx.user_memberships.findUnique.mockResolvedValue(null);
    tx.user_memberships.upsert.mockResolvedValue({ id: 'membership-1' });

    await service.markPaidAndFulfill('order-1');

    expect(tx.orders.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({ status: OrderStatus.PAID, paidAt: expect.any(Date) }),
    });
    expect(tx.user_memberships.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'ACTIVE', planId: 'plan-1' }),
        update: expect.objectContaining({ status: 'ACTIVE', planId: 'plan-1' }),
      }),
    );
    expect(points.grantPointsWithinTx).toHaveBeenCalledWith(
      tx,
      'user-1',
      expect.objectContaining({
        amount: 6500,
        grantType: PointGrantType.SUBSCRIPTION,
        sourceEvent: PointLedgerEventType.subscription_grant,
        source: PointsSource.MEMBERSHIP,
        sourceId: 'order-1',
        metadata: expect.objectContaining({
          billingCycle: BillingCycle.YEARLY,
          monthlyGrant: true,
          pointsOnlyForCurrentCycle: true,
        }),
      }),
    );
  });

  it('fulfills a points package by granting purchased points with package validity', async () => {
    const tx = createTx();
    const { service, points } = createService(tx);
    const order = pendingOrder({
      orderType: OrderType.POINTS_PACKAGE,
      productId: 'pkg-1',
      productName: '标准包',
    });
    tx.orders.findUnique.mockResolvedValue(order);
    tx.orders.update.mockResolvedValue({ ...order, status: OrderStatus.PAID });
    tx.point_grants.findFirst.mockResolvedValue(null);
    tx.points_packages.findUnique.mockResolvedValue({
      id: 'pkg-1',
      code: 'standard_topup',
      name: '标准包',
      points: 5500,
      validityDays: 180,
      usageScope: { allowedTaskTypes: [] },
      isActive: true,
    });

    await service.markPaidAndFulfill('order-1');

    expect(points.grantPointsWithinTx).toHaveBeenCalledWith(
      tx,
      'user-1',
      expect.objectContaining({
        amount: 5500,
        grantType: PointGrantType.PURCHASED,
        sourceEvent: PointLedgerEventType.points_purchase,
        source: PointsSource.PACKAGE,
        sourceId: 'order-1',
        metadata: expect.objectContaining({
          packageCode: 'standard_topup',
          validityDays: 180,
        }),
      }),
    );
  });

  it('fulfills upgrade membership by granting only the current-cycle point difference', async () => {
    const tx = createTx();
    const { service, points } = createService(tx);
    const order = pendingOrder({
      businessType: 'upgrade_order',
      productId: 'plan-pro',
      productName: 'Pro - 月付升级',
    });
    tx.orders.findUnique.mockResolvedValue(order);
    tx.orders.update.mockResolvedValue({ ...order, status: OrderStatus.PAID });
    tx.point_grants.findFirst.mockResolvedValue(null);
    tx.membership_plans.findUnique
      .mockResolvedValueOnce({
        id: 'plan-pro',
        levelId: 'level-pro',
        billingCycle: BillingCycle.MONTHLY,
        months: 1,
        autoRenew: false,
        points: 20000,
        price: 199,
        level: { level: 3, name: 'Pro' },
      })
      .mockResolvedValueOnce({
        id: 'plan-creator',
        points: 6500,
      });
    tx.user_memberships.findUnique.mockResolvedValue({
      id: 'membership-1',
      status: 'ACTIVE',
      planId: 'plan-creator',
      startedAt: new Date('2026-06-01T00:00:00.000Z'),
      expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      level: { pointsPerMonth: 6500 },
    });
    tx.user_memberships.upsert.mockResolvedValue({ id: 'membership-1' });

    await service.markPaidAndFulfill('order-1');

    expect(points.grantPointsWithinTx).toHaveBeenCalledWith(
      tx,
      'user-1',
      expect.objectContaining({
        amount: 13500,
        metadata: expect.objectContaining({
          businessType: 'upgrade_order',
          upgradeGrant: true,
          previousPoints: 6500,
        }),
      }),
    );
  });

  it('schedules a downgrade for the next cycle without granting points immediately', async () => {
    const tx = createTx();
    const { service, points } = createService(tx);
    const order = pendingOrder({
      businessType: 'renewal_order',
      productId: 'plan-starter',
      productName: 'Starter - 月付降级',
    });
    const expiresAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    tx.orders.findUnique.mockResolvedValue(order);
    tx.orders.update.mockResolvedValue({ ...order, status: OrderStatus.PAID });
    tx.membership_plans.findUnique
      .mockResolvedValueOnce({
        id: 'plan-starter',
        levelId: 'level-starter',
        billingCycle: BillingCycle.MONTHLY,
        months: 1,
        autoRenew: false,
        points: 2500,
        price: 29,
        level: { level: 1, name: 'Starter' },
      })
      .mockResolvedValueOnce({
        id: 'plan-pro',
        points: 20000,
      });
    tx.user_memberships.findUnique.mockResolvedValue({
      id: 'membership-1',
      status: 'ACTIVE',
      planId: 'plan-pro',
      startedAt: new Date(),
      expiresAt,
      level: { level: 3, pointsPerMonth: 20000 },
    });
    tx.user_memberships.update.mockResolvedValue({ id: 'membership-1' });

    const result = await service.markPaidAndFulfill('order-1');

    expect(tx.user_memberships.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: expect.objectContaining({
        pendingPlanId: 'plan-starter',
        pendingOrderId: 'order-1',
        pendingLevelId: 'level-starter',
        pendingBillingCycle: BillingCycle.MONTHLY,
        pendingAutoRenew: false,
        pendingChangeEffectiveAt: expiresAt,
      }),
    });
    expect(points.grantPointsWithinTx).not.toHaveBeenCalled();
    expect(result.fulfillment).toEqual(
      expect.objectContaining({
        scheduledDowngrade: true,
        pointsGranted: 0,
      }),
    );
  });

  it('does not grant points again when a paid order is fulfilled twice', async () => {
    const tx = createTx();
    const { service, points } = createService(tx);
    tx.orders.findUnique.mockResolvedValue(pendingOrder({ status: OrderStatus.PAID }));
    tx.point_grants.findFirst.mockResolvedValue({ id: 'grant-existing' });
    tx.membership_plans.findUnique.mockResolvedValue({
      id: 'plan-1',
      levelId: 'level-creator',
      billingCycle: BillingCycle.MONTHLY,
      months: 1,
      autoRenew: false,
      points: 6500,
      price: 69,
      level: { level: 2, name: 'Creator' },
    });
    tx.user_memberships.findUnique.mockResolvedValue(null);
    tx.user_memberships.upsert.mockResolvedValue({ id: 'membership-1' });

    const result = await service.markPaidAndFulfill('order-1');

    expect(tx.orders.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { fulfilledAt: expect.any(Date) },
    });
    expect(points.grantPointsWithinTx).not.toHaveBeenCalled();
    expect(result.fulfillment).toEqual(
      expect.objectContaining({
        alreadyGranted: true,
        pointsGranted: 0,
      }),
    );
  });

  it('does not mutate membership when the paid order is already fulfilled', async () => {
    const tx = createTx();
    const { service, points } = createService(tx);
    tx.orders.findUnique.mockResolvedValue(
      pendingOrder({
        status: OrderStatus.PAID,
        fulfilledAt: new Date('2026-06-14T01:00:00.000Z'),
      }),
    );

    const result = await service.markPaidAndFulfill('order-1');

    expect(tx.orders.update).not.toHaveBeenCalled();
    expect(tx.user_memberships.upsert).not.toHaveBeenCalled();
    expect(points.grantPointsWithinTx).not.toHaveBeenCalled();
    expect(result.fulfillment).toEqual({
      type: 'membership',
      alreadyFulfilled: true,
      pointsGranted: 0,
    });
  });

  it('rejects cancelled orders', async () => {
    const tx = createTx();
    const { service } = createService(tx);
    tx.orders.findUnique.mockResolvedValue(pendingOrder({ status: OrderStatus.CANCELLED }));

    await expect(service.markPaidAndFulfill('order-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('processes a paid webhook once and fulfills the order idempotently', async () => {
    const tx = createTx();
    const { service, points } = createService(tx);
    const order = pendingOrder({
      orderType: OrderType.POINTS_PACKAGE,
      productId: 'pkg-1',
      productName: '标准包',
      amount: 59,
      originalPrice: 59,
    });
    tx.payment_events.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'evt-row-1',
        provider: 'mockpay',
        eventId: 'evt-1',
        eventType: 'payment.succeeded',
        processedAt: null,
      });
    tx.payment_events.create.mockResolvedValue({ id: 'evt-row-1' });
    tx.payment_events.update.mockResolvedValue({ id: 'evt-row-1', status: 'PROCESSED' });
    tx.orders.findUnique.mockResolvedValue(order);
    tx.orders.update.mockResolvedValue({
      ...order,
      status: OrderStatus.PAID,
      paymentProvider: 'mockpay',
      externalPaymentId: 'pay-1',
      paidAmount: 59,
      currency: 'USD',
    });
    tx.point_grants.findFirst.mockResolvedValue(null);
    tx.points_packages.findUnique.mockResolvedValue({
      id: 'pkg-1',
      code: 'standard_topup',
      name: '标准包',
      points: 5500,
      validityDays: 180,
      usageScope: null,
      isActive: true,
    });

    const result = await service.handlePaymentWebhook({
      provider: 'mockpay',
      eventId: 'evt-1',
      eventType: 'payment.succeeded',
      status: 'succeeded',
      orderNo: 'ORD1',
      externalPaymentId: 'pay-1',
      amount: 59,
      currency: 'USD',
      payload: { orderNo: 'ORD1' },
    });

    expect(result.alreadyProcessed).toBe(false);
    expect(tx.payment_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'mockpay',
          eventId: 'evt-1',
          status: 'PROCESSING',
        }),
      }),
    );
    expect(tx.orders.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: OrderStatus.PAID,
        paymentProvider: 'mockpay',
        externalPaymentId: 'pay-1',
        paidAt: expect.any(Date),
      }),
    });
    expect(points.grantPointsWithinTx).toHaveBeenCalledTimes(1);

    tx.payment_events.findUnique.mockReset();
    tx.payment_events.findUnique.mockResolvedValue({
      id: 'evt-row-1',
      provider: 'mockpay',
      eventId: 'evt-1',
      processedAt: new Date(),
    });
    points.grantPointsWithinTx.mockClear();

    const repeated = await service.handlePaymentWebhook({
      provider: 'mockpay',
      eventId: 'evt-1',
      eventType: 'payment.succeeded',
      status: 'succeeded',
      orderNo: 'ORD1',
      amount: 59,
    });

    expect(repeated.alreadyProcessed).toBe(true);
    expect(points.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('rejects a payment webhook when the paid amount does not match the order', async () => {
    const tx = createTx();
    const { service, prisma } = createService(tx);
    tx.payment_events.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'evt-row-1',
        provider: 'mockpay',
        eventId: 'evt-1',
        eventType: 'payment.succeeded',
        processedAt: null,
      });
    tx.payment_events.create.mockResolvedValue({ id: 'evt-row-1' });
    tx.orders.findUnique.mockResolvedValue(pendingOrder({ amount: 69, originalPrice: 69 }));

    await expect(
      service.handlePaymentWebhook({
        provider: 'mockpay',
        eventId: 'evt-1',
        eventType: 'payment.succeeded',
        status: 'succeeded',
        orderNo: 'ORD1',
        amount: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.payment_events.update).toHaveBeenCalledWith({
      where: { id: 'evt-row-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: expect.any(String),
      }),
    });
  });

  it('rejects a paid webhook when the amount is missing for a positive order', async () => {
    const tx = createTx();
    const { service, prisma } = createService(tx);
    tx.payment_events.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'evt-row-1',
        provider: 'mockpay',
        eventId: 'evt-missing-amount',
        eventType: 'payment.succeeded',
        processedAt: null,
      });
    tx.payment_events.create.mockResolvedValue({ id: 'evt-row-1' });
    tx.orders.findUnique.mockResolvedValue(pendingOrder({ amount: 69, originalPrice: 69 }));

    await expect(
      service.handlePaymentWebhook({
        provider: 'mockpay',
        eventId: 'evt-missing-amount',
        eventType: 'payment.succeeded',
        status: 'succeeded',
        orderNo: 'ORD1',
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.payment_events.update).toHaveBeenCalledWith({
      where: { id: 'evt-row-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: expect.any(String),
      }),
    });
  });

  it('rejects a paid webhook when the currency does not match the order', async () => {
    const tx = createTx();
    const { service, prisma } = createService(tx);
    tx.payment_events.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'evt-row-1',
        provider: 'mockpay',
        eventId: 'evt-wrong-currency',
        eventType: 'payment.succeeded',
        processedAt: null,
      });
    tx.payment_events.create.mockResolvedValue({ id: 'evt-row-1' });
    tx.orders.findUnique.mockResolvedValue(
      pendingOrder({ amount: 69, originalPrice: 69, currency: 'USD' }),
    );

    await expect(
      service.handlePaymentWebhook({
        provider: 'mockpay',
        eventId: 'evt-wrong-currency',
        eventType: 'payment.succeeded',
        status: 'succeeded',
        orderNo: 'ORD1',
        amount: 69,
        currency: 'JPY',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.payment_events.update).toHaveBeenCalledWith({
      where: { id: 'evt-row-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: expect.any(String),
      }),
    });
  });

  it('ignores refund success webhooks instead of fulfilling the order', async () => {
    const tx = createTx();
    const { service, points } = createService(tx);
    tx.payment_events.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'evt-row-refund',
        provider: 'mockpay',
        eventId: 'evt-refund-1',
        eventType: 'refund.succeeded',
        processedAt: null,
      });
    tx.payment_events.create.mockResolvedValue({ id: 'evt-row-refund' });
    tx.payment_events.update.mockResolvedValue({
      id: 'evt-row-refund',
      status: 'IGNORED',
      processedAt: new Date(),
    });

    const result = await service.handlePaymentWebhook({
      provider: 'mockpay',
      eventId: 'evt-refund-1',
      eventType: 'refund.succeeded',
      status: 'succeeded',
      orderNo: 'ORD1',
      externalPaymentId: 'refund-1',
      amount: 59,
      currency: 'USD',
    });

    expect(result).toEqual(
      expect.objectContaining({
        ignored: true,
        order: null,
        fulfillment: null,
      }),
    );
    expect(tx.orders.findUnique).not.toHaveBeenCalled();
    expect(points.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('refunds an order by reclaiming only available points from its grants', async () => {
    const tx = createTx();
    const { service } = createService(tx);
    const order = pendingOrder({
      status: OrderStatus.PAID,
      orderType: OrderType.POINTS_PACKAGE,
      productId: 'pkg-1',
      amount: 59,
      paidAmount: 59,
      currency: 'USD',
    });
    tx.orders.findUnique.mockResolvedValue(order);
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'grant-1',
        userId: 'user-1',
        grantType: PointGrantType.PURCHASED,
        sourceEvent: PointLedgerEventType.points_purchase,
        sourceId: 'order-1',
        totalAmount: 5500,
        availableAmount: 3000,
        frozenAmount: 500,
        consumedAmount: 2000,
        expiredAmount: 0,
      },
    ]);
    tx.user_points.update.mockResolvedValue({ balance: 2000 });
    tx.user_memberships.updateMany.mockResolvedValue({ count: 0 });
    tx.payment_events.upsert.mockResolvedValue({ id: 'refund-event-1' });
    tx.orders.update.mockResolvedValue({
      ...order,
      status: OrderStatus.REFUNDED,
      refundedAt: new Date(),
    });

    const result = await service.refundOrder('order-1', {
      reason: 'customer service refund',
    });

    expect(result).toEqual(
      expect.objectContaining({
        alreadyRefunded: false,
        pointsReclaimed: 3000,
        skippedConsumedPoints: 2000,
        skippedFrozenPoints: 500,
      }),
    );
    expect(tx.point_grants.update).toHaveBeenCalledWith({
      where: { id: 'grant-1' },
      data: {
        availableAmount: { decrement: 3000 },
        refundedAmount: { increment: 3000 },
      },
    });
    expect(tx.user_points.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: expect.objectContaining({
        balance: { decrement: 3000 },
        availableBalance: { decrement: 3000 },
        totalBalance: { decrement: 3000 },
        purchasedBalance: { decrement: 3000 },
      }),
    });
    expect(tx.points_records.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'CONSUME',
        amount: 3000,
        source: PointsSource.PACKAGE,
        sourceId: 'order-1',
        remark: 'refund_order:customer service refund',
      }),
    });
    expect(tx.orders.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: OrderStatus.REFUNDED,
        refundReason: 'customer service refund',
        refundedAt: expect.any(Date),
      }),
    });
  });

  it('P2-D2: refund accounts for available / consumed / frozen / expired three-state skips', async () => {
    const tx = createTx();
    const { service } = createService(tx);
    const order = pendingOrder({
      status: OrderStatus.PAID,
      orderType: OrderType.POINTS_PACKAGE,
      productId: 'pkg-1',
      amount: 59,
      paidAmount: 59,
      currency: 'USD',
    });
    tx.orders.findUnique.mockResolvedValue(order);
    // 同一订单多次发放 + 既有 available 又有过期 / 冻结 / 已消费部分
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'grant-active',
        userId: 'user-1',
        grantType: PointGrantType.PURCHASED,
        sourceEvent: PointLedgerEventType.points_purchase,
        sourceId: 'order-1',
        totalAmount: 5000,
        availableAmount: 2500,
        frozenAmount: 1000,
        consumedAmount: 1500,
        expiredAmount: 0,
      },
      {
        id: 'grant-expired',
        userId: 'user-1',
        grantType: PointGrantType.PURCHASED,
        sourceEvent: PointLedgerEventType.points_purchase,
        sourceId: 'order-1',
        totalAmount: 3000,
        availableAmount: 0,
        frozenAmount: 0,
        consumedAmount: 0,
        expiredAmount: 3000,
      },
    ]);
    tx.user_points.update.mockResolvedValue({ balance: 1000 });
    tx.user_memberships.updateMany.mockResolvedValue({ count: 0 });
    tx.payment_events.upsert.mockResolvedValue({ id: 'refund-event-2' });
    tx.orders.update.mockResolvedValue({
      ...order,
      status: OrderStatus.REFUNDED,
      refundedAt: new Date(),
    });

    const result = await service.refundOrder('order-1', { reason: 'partial reclaim' });

    expect(result).toEqual(
      expect.objectContaining({
        alreadyRefunded: false,
        pointsReclaimed: 2500,
        skippedConsumedPoints: 1500,
        skippedFrozenPoints: 1000,
        skippedExpiredPoints: 3000,
      }),
    );
    // 只对 grant-active 触发回收，过期 grant 跳过
    expect(tx.point_grants.update).toHaveBeenCalledTimes(1);
    expect(tx.point_grants.update).toHaveBeenCalledWith({
      where: { id: 'grant-active' },
      data: {
        availableAmount: { decrement: 2500 },
        refundedAmount: { increment: 2500 },
      },
    });
  });

  it('P2-D2: refund on already-REFUNDED order is idempotent (no double reclaim)', async () => {
    const tx = createTx();
    const { service } = createService(tx);
    const order = pendingOrder({
      status: OrderStatus.REFUNDED,
      orderType: OrderType.POINTS_PACKAGE,
      productId: 'pkg-1',
    });
    tx.orders.findUnique.mockResolvedValue(order);

    const result = await service.refundOrder('order-1', { reason: 'retry' });

    expect(result).toEqual(
      expect.objectContaining({
        alreadyRefunded: true,
        pointsReclaimed: 0,
      }),
    );
    expect(tx.point_grants.findMany).not.toHaveBeenCalled();
    expect(tx.point_grants.update).not.toHaveBeenCalled();
    expect(tx.orders.update).not.toHaveBeenCalled();
  });
});
