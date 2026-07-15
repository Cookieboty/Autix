import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { BillingCycle, OrderStatus, OrderType } from '../../platform/prisma/generated';
import { StripePaymentService } from './stripe-payment.service';

const originalFetch = globalThis.fetch;

function pendingOrder(input: Partial<any> = {}) {
  return {
    id: 'order-1',
    userId: 'user-1',
    orderNo: 'ORD1',
    orderType: OrderType.MEMBERSHIP,
    businessType: 'subscription_order',
    productId: 'plan-1',
    productName: 'Creator - 月付',
    originalPrice: '8.43',
    amount: '8.43',
    isFirstTime: false,
    status: OrderStatus.PENDING,
    paymentProvider: null,
    externalPaymentId: null,
    paymentEventId: null,
    paidAmount: null,
    currency: null,
    paymentMetadata: null,
    paidAt: null,
    fulfilledAt: null,
    refundProvider: null,
    externalRefundId: null,
    refundAmount: null,
    refundReason: null,
    refundMetadata: null,
    refundedAt: null,
    createdAt: new Date('2026-06-16T00:00:00.000Z'),
    updatedAt: new Date('2026-06-16T00:00:00.000Z'),
    ...input,
  };
}

function make(overrides: Record<string, string | undefined> = {}) {
  const configValues: Record<string, string | undefined> = {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
    STRIPE_CURRENCY: 'USD',
    WEB_APP_URL: 'http://localhost:3100',
    STRIPE_WEBHOOK_TOLERANCE_SECONDS: '300',
    STRIPE_TEST_MODE: 'false',
    ...overrides,
  };
  const config = {
    get: vi.fn((key: string) => configValues[key]),
  };
  const order = pendingOrder();
  const orderService = {
    createMembershipOrder: vi.fn().mockResolvedValue(order),
    createPointsPackageOrder: vi.fn(),
    getOrderById: vi.fn().mockResolvedValue(order),
    assertOrderCanCheckout: vi.fn().mockResolvedValue(undefined),
    getMembershipPlanForOrder: vi.fn().mockResolvedValue({ billingCycle: BillingCycle.MONTHLY }),
    attachStripeCheckoutSession: vi.fn().mockImplementation(async (_id: string, input: any) => ({
      ...order,
      paymentProvider: 'stripe',
      externalPaymentId: input.sessionId,
      currency: input.currency,
    })),
    confirmManualPayment: vi.fn(),
    handlePaymentWebhook: vi.fn().mockResolvedValue({ received: true }),
    syncStripeSubscription: vi.fn().mockResolvedValue({ id: 'membership-1' }),
  };
  const systemSettingsService = {
    getString: vi.fn((key: string) => {
      const keyMap: Record<string, string> = {
        'payments.stripeSecretKey': 'STRIPE_SECRET_KEY',
        'payments.stripeWebhookSecret': 'STRIPE_WEBHOOK_SECRET',
        'payments.stripeCurrency': 'STRIPE_CURRENCY',
        'payments.stripeApiBase': 'STRIPE_API_BASE',
        'payments.stripeSuccessUrl': 'STRIPE_SUCCESS_URL',
        'payments.stripeCancelUrl': 'STRIPE_CANCEL_URL',
        'payments.webAppUrl': 'WEB_APP_URL',
        'payments.stripeWebhookToleranceSeconds': 'STRIPE_WEBHOOK_TOLERANCE_SECONDS',
      };
      return Promise.resolve(configValues[keyMap[key]] ?? '');
    }),
    getBoolean: vi.fn((key: string) => {
      if (key === 'payments.stripeTestModeEnabled') {
        return Promise.resolve(configValues.STRIPE_TEST_MODE === 'true');
      }
      return Promise.resolve(false);
    }),
  };
  const service = new StripePaymentService(
    config as never,
    orderService as never,
    systemSettingsService as never,
  );
  return { service, orderService };
}

describe('StripePaymentService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).fetch = originalFetch;
  });

  it('creates a Stripe Checkout session for a membership order', async () => {
    const { service, orderService } = make();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        payment_intent: null,
        subscription: 'sub_test_123',
        customer: 'cus_test_123',
      }),
    });
    (globalThis as any).fetch = fetchMock;

    const result = await service.createCheckout('user-1', {
      orderType: OrderType.MEMBERSHIP,
      productId: 'plan-1',
    });

    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_123');
    expect(orderService.createMembershipOrder).toHaveBeenCalledWith('user-1', 'plan-1', 'USD');
    expect(orderService.attachStripeCheckoutSession).toHaveBeenCalledWith('order-1', {
      sessionId: 'cs_test_123',
      currency: 'USD',
      metadata: expect.objectContaining({
        stripeCheckoutSessionId: 'cs_test_123',
        stripeSubscriptionId: 'sub_test_123',
        stripeCustomerId: 'cus_test_123',
      }),
    });

    const [, init] = fetchMock.mock.calls[0];
    const params = new URLSearchParams(init.body);
    expect(init.headers.authorization).toBe('Bearer sk_test_123');
    expect(init.headers['idempotency-key']).toBe('checkout:order-1');
    expect(params.get('mode')).toBe('subscription');
    expect(params.get('adaptive_pricing[enabled]')).toBe('false');
    expect(params.get('client_reference_id')).toBe('order-1');
    expect(params.get('payment_method_types[0]')).toBe('card');
    expect(params.get('payment_method_types[1]')).toBeNull();
    expect(params.get('line_items[0][price_data][currency]')).toBe('usd');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('843');
    expect(params.get('line_items[0][price_data][recurring][interval]')).toBe('month');
    expect(params.get('metadata[orderNo]')).toBe('ORD1');
    expect(params.get('subscription_data[metadata][orderNo]')).toBe('ORD1');
  });

  it('reuses an attached unexpired Stripe Checkout session for a pending order', async () => {
    const { service, orderService } = make();
    const reusableOrder = pendingOrder({
      paymentProvider: 'stripe',
      externalPaymentId: 'cs_test_existing',
      currency: 'USD',
      paymentMetadata: {
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_existing',
        stripeCheckoutExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    });
    orderService.createMembershipOrder.mockResolvedValueOnce(reusableOrder);
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;

    const result = await service.createCheckout('user-1', {
      orderType: OrderType.MEMBERSHIP,
      productId: 'plan-1',
    });

    expect(result).toEqual({
      order: reusableOrder,
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_existing',
      sessionId: 'cs_test_existing',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(orderService.attachStripeCheckoutSession).not.toHaveBeenCalled();
  });

  it('allows Stripe test keys when test mode is enabled', async () => {
    const { service } = make({ STRIPE_TEST_MODE: 'true' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        subscription: 'sub_test_123',
        customer: 'cus_test_123',
      }),
    });
    (globalThis as any).fetch = fetchMock;

    await service.createCheckout('user-1', {
      orderType: OrderType.MEMBERSHIP,
      productId: 'plan-1',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init.headers.authorization).toBe('Bearer sk_test_123');
  });

  it('rejects live keys when Stripe test mode is enabled', async () => {
    const { service } = make({
      STRIPE_SECRET_KEY: 'sk_live_123',
      STRIPE_TEST_MODE: 'true',
    });
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;

    await expect(
      service.createCheckout('user-1', {
        orderType: OrderType.MEMBERSHIP,
        productId: 'plan-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects checkout for an existing order whose currency differs from Stripe config', async () => {
    const { service, orderService } = make();
    orderService.getOrderById.mockResolvedValueOnce(pendingOrder({ currency: 'CNY' }));
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;

    await expect(
      service.createCheckoutForExistingOrder('user-1', 'order-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects zero-amount orders instead of fulfilling them through checkout', async () => {
    const { service, orderService } = make();
    orderService.createMembershipOrder.mockResolvedValueOnce(
      pendingOrder({ amount: '0.00', currency: 'USD' }),
    );
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;

    await expect(
      service.createCheckout('user-1', {
        orderType: OrderType.MEMBERSHIP,
        productId: 'plan-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(orderService.confirmManualPayment).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('syncs a paid Checkout session after Stripe redirects back', async () => {
    const { service, orderService } = make();
    const order = pendingOrder({
      paymentProvider: 'stripe',
      externalPaymentId: 'cs_test_123',
      currency: 'USD',
    });
    const paidOrder = pendingOrder({ ...order, status: OrderStatus.PAID });
    orderService.getOrderById.mockResolvedValue(order);
    orderService.handlePaymentWebhook.mockResolvedValue({
      order: paidOrder,
      event: { id: 'event-1' },
      fulfillment: null,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        object: 'checkout.session',
        client_reference_id: 'order-1',
        payment_status: 'paid',
        status: 'complete',
        amount_total: 843,
        currency: 'usd',
        metadata: { orderId: 'order-1', orderNo: 'ORD1' },
      }),
    });
    (globalThis as any).fetch = fetchMock;

    const result = await service.syncCheckoutSession('user-1', 'cs_test_123');

    expect(result.order.status).toBe(OrderStatus.PAID);
    expect(result.synced).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.stripe.com/v1/checkout/sessions/cs_test_123',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer sk_test_123' }),
      }),
    );
    expect(orderService.handlePaymentWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'stripe',
        eventId: 'checkout_sync:cs_test_123',
        eventType: 'checkout.session.completed',
        status: 'paid',
        orderId: 'order-1',
        orderNo: 'ORD1',
        externalPaymentId: 'cs_test_123',
        amount: '8.43',
        currency: 'USD',
      }),
    );
  });

  it('does not fulfill when a redirected Checkout session is not paid yet', async () => {
    const { service, orderService } = make();
    orderService.getOrderById.mockResolvedValue(
      pendingOrder({
        paymentProvider: 'stripe',
        externalPaymentId: 'cs_test_123',
        currency: 'USD',
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        object: 'checkout.session',
        client_reference_id: 'order-1',
        payment_status: 'unpaid',
        status: 'open',
        amount_total: 843,
        currency: 'usd',
        metadata: { orderId: 'order-1', orderNo: 'ORD1' },
      }),
    });
    (globalThis as any).fetch = fetchMock;

    const result = await service.syncCheckoutSession('user-1', 'cs_test_123');

    expect(result.order.status).toBe(OrderStatus.PENDING);
    expect(result.synced).toBe(false);
    expect(orderService.handlePaymentWebhook).not.toHaveBeenCalled();
  });

  it('verifies Stripe webhook signatures and maps completed sessions', async () => {
    const { service, orderService } = make();
    const payload = JSON.stringify({
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          object: 'checkout.session',
          id: 'cs_test_123',
          payment_status: 'paid',
          amount_total: 843,
          currency: 'usd',
          client_reference_id: 'order-1',
          metadata: {
            orderId: 'order-1',
            orderNo: 'ORD1',
          },
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', 'whsec_test_123')
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    await service.handleWebhook(`t=${timestamp},v1=${signature}`, Buffer.from(payload));

    expect(orderService.handlePaymentWebhook).toHaveBeenCalledWith({
      provider: 'stripe',
      eventId: 'evt_test_1',
      eventType: 'checkout.session.completed',
      status: 'paid',
      orderId: 'order-1',
      orderNo: 'ORD1',
      externalPaymentId: 'cs_test_123',
      amount: '8.43',
      currency: 'USD',
      payload: expect.objectContaining({ id: 'evt_test_1' }),
    });
  });

  it('syncs Stripe subscription updates from webhooks', async () => {
    const { service, orderService } = make();
    const payload = JSON.stringify({
      id: 'evt_sub_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          object: 'subscription',
          id: 'sub_test_123',
          status: 'active',
          customer: 'cus_test_123',
          current_period_start: 1782045600,
          current_period_end: 1784724000,
          cancel_at_period_end: true,
          metadata: { orderId: 'order-1' },
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', 'whsec_test_123')
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    const result = await service.handleWebhook(`t=${timestamp},v1=${signature}`, Buffer.from(payload));

    expect(result).toEqual(
      expect.objectContaining({
        eventType: 'customer.subscription.updated',
        subscriptionId: 'sub_test_123',
        synced: true,
      }),
    );
    expect(orderService.syncStripeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sub_1',
        eventType: 'customer.subscription.updated',
        subscriptionId: 'sub_test_123',
        customerId: 'cus_test_123',
        status: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
      }),
    );
  });

  it('rejects invalid Stripe webhook signatures', async () => {
    const { service, orderService } = make();

    await expect(
      service.handleWebhook('t=1,v1=bad', Buffer.from('{"id":"evt_test_1"}')),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(orderService.handlePaymentWebhook).not.toHaveBeenCalled();
  });

  it('creates a Stripe refund from the stored payment intent', async () => {
    const { service } = make();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 're_test_123',
        object: 'refund',
        status: 'succeeded',
        amount: 843,
        currency: 'usd',
      }),
    });
    (globalThis as any).fetch = fetchMock;

    const result = await service.createRefund({
      order: pendingOrder({
        externalPaymentId: 'cs_test_123',
        paidAmount: '8.43',
        currency: 'USD',
        paymentMetadata: { stripePaymentIntentId: 'pi_test_123' },
      }) as never,
      externalRefundId: 'refund-request-1',
      reason: 'duplicate',
    });

    expect(result).toEqual({
      provider: 'stripe',
      externalRefundId: 're_test_123',
      amount: '8.43',
      currency: 'USD',
      metadata: expect.objectContaining({ id: 're_test_123' }),
    });

    const [url, init] = fetchMock.mock.calls[0];
    const params = new URLSearchParams(init.body);
    expect(url).toBe('https://api.stripe.com/v1/refunds');
    // FIX-16: idempotency key is always order-derived, ignoring caller-supplied externalRefundId,
    // so concurrent/duplicate refund calls cannot issue two distinct Stripe refunds.
    expect(init.headers['idempotency-key']).toBe('refund:order-1');
    expect(params.get('payment_intent')).toBe('pi_test_123');
    expect(params.get('amount')).toBe('843');
    expect(params.get('metadata[orderId]')).toBe('order-1');
    expect(params.get('metadata[requestedRefundId]')).toBe('refund-request-1');
  });

  it('cancels a Stripe subscription immediately', async () => {
    const { service } = make();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'sub_test_123', object: 'subscription', status: 'canceled' }),
    });
    (globalThis as any).fetch = fetchMock;

    const result = await service.cancelSubscriptionImmediately('sub_test_123');

    expect(result).toEqual(expect.objectContaining({ id: 'sub_test_123', status: 'canceled' }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/subscriptions/sub_test_123');
    expect(init.method).toBe('DELETE');
    expect(init.headers.authorization).toBe('Bearer sk_test_123');
  });

  it('rejects invalid subscription ids on immediate cancel without calling Stripe', async () => {
    const { service } = make();
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;

    await expect(service.cancelSubscriptionImmediately('not-a-sub')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
