import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { OrderStatus, OrderType } from '../prisma/generated';
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
    originalPrice: '59.00',
    amount: '59.00',
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
    STRIPE_CURRENCY: 'CNY',
    WEB_APP_URL: 'http://localhost:3100',
    STRIPE_WEBHOOK_TOLERANCE_SECONDS: '300',
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
    attachStripeCheckoutSession: jest.fn().mockImplementation(async (_id: string, input: any) => ({
      ...order,
      paymentProvider: 'stripe',
      externalPaymentId: input.sessionId,
      currency: input.currency,
    })),
    confirmManualPayment: jest.fn(),
    handlePaymentWebhook: jest.fn().mockResolvedValue({ received: true }),
  };
  const service = new StripePaymentService(config as never, orderService as never);
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
    expect(orderService.createMembershipOrder).toHaveBeenCalledWith('user-1', 'plan-1');
    expect(orderService.attachStripeCheckoutSession).toHaveBeenCalledWith('order-1', {
      sessionId: 'cs_test_123',
      currency: 'CNY',
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
    expect(params.get('line_items[0][price_data][currency]')).toBe('cny');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('5900');
    expect(params.get('metadata[orderNo]')).toBe('ORD1');
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
          amount_total: 5900,
          currency: 'cny',
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
      amount: '59.00',
      currency: 'CNY',
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
