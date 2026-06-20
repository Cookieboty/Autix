import { UnauthorizedException } from '@nestjs/common';
import { handlePaymentWebhookRequest } from './payment-webhook.handler';

function make(secret = 'secret-1') {
  const getMock = jest.fn((key: string) =>
    key === 'PAYMENT_WEBHOOK_SECRET' ? secret : undefined,
  );
  const config = {
    get<T = unknown>(key: string): T | undefined {
      return getMock(key) as T | undefined;
    },
  };
  const orderService = {
    handlePaymentWebhook: jest.fn().mockImplementation(async (input: unknown) => ({
      ok: true,
      input,
    })),
  };
  const stripePaymentService = {
    handleWebhook: jest.fn().mockResolvedValue({ received: true }),
  };
  return { config, orderService, stripePaymentService };
}

describe('PaymentWebhookController', () => {
  it('accepts the configured header secret and maps common provider fields', async () => {
    const { config, orderService, stripePaymentService } = make();

    const result = await handlePaymentWebhookRequest({
      provider: 'mockpay',
      secretHeader: 'secret-1',
      body: {
        id: 'evt-1',
        type: 'payment.succeeded',
        trade_status: 'SUCCESS',
        out_trade_no: 'ORD1',
        trade_no: 'pay-1',
        total_amount: '59.00',
      },
      config,
      orderService,
      stripePaymentService,
    });

    expect(result).toEqual({ ok: true, input: expect.any(Object) });
    expect(orderService.handlePaymentWebhook).toHaveBeenCalledWith({
      provider: 'mockpay',
      eventId: 'evt-1',
      eventType: 'payment.succeeded',
      status: 'SUCCESS',
      orderId: undefined,
      orderNo: 'ORD1',
      externalPaymentId: 'pay-1',
      amount: '59.00',
      currency: 'USD',
      payload: expect.objectContaining({ id: 'evt-1' }),
    });
  });

  it('accepts bearer token auth and preserves Decimal-like amounts', async () => {
    const { config, orderService, stripePaymentService } = make();
    const decimalLike = { toString: () => '69.00' };

    await handlePaymentWebhookRequest({
      provider: 'mockpay',
      authorization: 'Bearer secret-1',
      body: {
        eventId: 'evt-2',
        eventType: 'checkout.paid',
        orderId: 'order-1',
        paymentId: 'pay-2',
        amount: decimalLike,
        currency: 'USD',
      },
      config,
      orderService,
      stripePaymentService,
    });

    expect(orderService.handlePaymentWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-2',
        amount: '69.00',
        currency: 'USD',
      }),
    );
  });

  it('rejects missing or invalid secrets before processing the payment event', async () => {
    const { config, orderService, stripePaymentService } = make();

    await expect(
      handlePaymentWebhookRequest({
        provider: 'mockpay',
        secretHeader: 'wrong',
        body: {
          eventId: 'evt-1',
          eventType: 'payment.succeeded',
        },
        config,
        orderService,
        stripePaymentService,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(orderService.handlePaymentWebhook).not.toHaveBeenCalled();
  });

  it('rejects payloads without an event id or event type', async () => {
    const { config, orderService, stripePaymentService } = make();

    await expect(
      handlePaymentWebhookRequest({
        provider: 'mockpay',
        secretHeader: 'secret-1',
        body: {
          status: 'succeeded',
        },
        config,
        orderService,
        stripePaymentService,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(orderService.handlePaymentWebhook).not.toHaveBeenCalled();
  });

  it('delegates Stripe webhooks to the Stripe payment service', async () => {
    const { config, orderService, stripePaymentService } = make();
    const rawBody = Buffer.from('{"id":"evt_1"}');

    const result = await handlePaymentWebhookRequest({
      provider: 'stripe',
      stripeSignature: 't=1,v1=abc',
      rawBody,
      body: { id: 'evt_1' },
      config,
      orderService,
      stripePaymentService,
    });

    expect(result).toEqual({ received: true });
    expect(stripePaymentService.handleWebhook).toHaveBeenCalledWith('t=1,v1=abc', rawBody);
    expect(orderService.handlePaymentWebhook).not.toHaveBeenCalled();
  });
});
