import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { OrderStatus, OrderType } from '../../platform/prisma/generated';
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
    get: jest.fn((key: string) => configValues[key]),
  };
  const order = pendingOrder();
  const orderService = {
    createMembershipOrder: jest.fn().mockResolvedValue(order),
    createPointsPackageOrder: jest.fn(),
    getOrderById: jest.fn().mockResolvedValue(order),
    assertOrderCanCheckout: jest.fn().mockResolvedValue(undefined),
    attachStripeCheckoutSession: jest.fn().mockImplementation(async (_id: string, input: any) => ({
      ...order,
      paymentProvider: 'stripe',
      externalPaymentId: input.sessionId,
      currency: input.currency,
    })),
    confirmManualPayment: jest.fn(),
    handlePaymentWebhook: jest.fn().mockResolvedValue({ received: true }),
  };
  const systemSettingsService = {
    getString: jest.fn((key: string) => {
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
    getBoolean: jest.fn((key: string) => {
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
    jest.restoreAllMocks();
    (globalThis as any).fetch = originalFetch;
  });

  it('creates a Stripe Checkout session for a membership order', async () => {
    const { service, orderService } = make();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        payment_intent: 'pi_test_123',
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
        stripePaymentIntentId: 'pi_test_123',
      }),
    });

    const [, init] = fetchMock.mock.calls[0];
    const params = new URLSearchParams(init.body);
    expect(init.headers.authorization).toBe('Bearer sk_test_123');
    expect(params.get('mode')).toBe('payment');
    expect(params.get('client_reference_id')).toBe('order-1');
    expect(params.get('line_items[0][price_data][currency]')).toBe('usd');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('843');
    expect(params.get('metadata[orderNo]')).toBe('ORD1');
  });

  it('allows Stripe test keys when test mode is enabled', async () => {
    const { service } = make({ STRIPE_TEST_MODE: 'true' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        payment_intent: 'pi_test_123',
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
    const fetchMock = jest.fn();
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
    const fetchMock = jest.fn();
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
    const fetchMock = jest.fn();
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

  it('rejects invalid Stripe webhook signatures', async () => {
    const { service, orderService } = make();

    await expect(
      service.handleWebhook('t=1,v1=bad', Buffer.from('{"id":"evt_test_1"}')),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(orderService.handlePaymentWebhook).not.toHaveBeenCalled();
  });
});
