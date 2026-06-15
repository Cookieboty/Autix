import { UnauthorizedException } from '@nestjs/common';
import { PaymentWebhookController } from './payment-webhook.controller';

function make(secret = 'secret-1') {
  const config = {
    get: jest.fn((key: string) => (key === 'PAYMENT_WEBHOOK_SECRET' ? secret : undefined)),
  };
  const orderService = {
    handlePaymentWebhook: jest.fn().mockImplementation(async (input: unknown) => ({
      ok: true,
      input,
    })),
  };
  const ctrl = new PaymentWebhookController(config as never, orderService as never);
  return { ctrl, orderService };
}

describe('PaymentWebhookController', () => {
  it('accepts the configured header secret and maps common provider fields', async () => {
    const { ctrl, orderService } = make();

    const result = await ctrl.handleWebhook(
      'mockpay',
      'secret-1',
      undefined,
      {
        id: 'evt-1',
        type: 'payment.succeeded',
        trade_status: 'SUCCESS',
        out_trade_no: 'ORD1',
        trade_no: 'pay-1',
        total_amount: '59.00',
      },
    );

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
      currency: 'CNY',
      payload: expect.objectContaining({ id: 'evt-1' }),
    });
  });

  it('accepts bearer token auth and preserves Decimal-like amounts', async () => {
    const { ctrl, orderService } = make();
    const decimalLike = { toString: () => '69.00' };

    await ctrl.handleWebhook(
      'mockpay',
      undefined,
      'Bearer secret-1',
      {
        eventId: 'evt-2',
        eventType: 'checkout.paid',
        orderId: 'order-1',
        paymentId: 'pay-2',
        amount: decimalLike,
        currency: 'USD',
      },
    );

    expect(orderService.handlePaymentWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-2',
        amount: '69.00',
        currency: 'USD',
      }),
    );
  });

  it('rejects missing or invalid secrets before processing the payment event', async () => {
    const { ctrl, orderService } = make();

    await expect(
      ctrl.handleWebhook('mockpay', 'wrong', undefined, {
        eventId: 'evt-1',
        eventType: 'payment.succeeded',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(orderService.handlePaymentWebhook).not.toHaveBeenCalled();
  });

  it('rejects payloads without an event id or event type', async () => {
    const { ctrl, orderService } = make();

    await expect(
      ctrl.handleWebhook('mockpay', 'secret-1', undefined, {
        status: 'succeeded',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(orderService.handlePaymentWebhook).not.toHaveBeenCalled();
  });
});
