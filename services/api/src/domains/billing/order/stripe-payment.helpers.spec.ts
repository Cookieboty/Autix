import { BadRequestException } from '@nestjs/common';
import { OrderType, Prisma } from '../../platform/prisma/generated';
import {
  buildCheckoutSessionPaymentWebhookInput,
  buildPaymentIntentPaymentWebhookInput,
  buildStripeCheckoutAttachMetadata,
  buildStripeCheckoutParams,
  classifyStripeWebhookObject,
  fromMinorAmount,
  parseStripeSignatureHeader,
  toMinorAmount,
} from './stripe-payment.helpers';

describe('stripe payment helpers', () => {
  it('builds checkout params with order metadata mirrored to payment intent metadata', () => {
    const params = buildStripeCheckoutParams({
      order: {
        id: 'order-1',
        orderNo: 'ORD1',
        userId: 'user-1',
        orderType: OrderType.MEMBERSHIP,
        amount: new Prisma.Decimal('8.43'),
        productName: 'Creator - 月付',
      },
      currency: 'USD',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    });

    expect(params.get('mode')).toBe('payment');
    expect(params.get('success_url')).toBe('https://app.test/success');
    expect(params.get('cancel_url')).toBe('https://app.test/cancel');
    expect(params.get('client_reference_id')).toBe('order-1');
    expect(params.get('line_items[0][price_data][currency]')).toBe('usd');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('843');
    expect(params.get('metadata[orderNo]')).toBe('ORD1');
    expect(params.get('payment_intent_data[metadata][orderNo]')).toBe('ORD1');
  });

  it('converts Stripe amounts for decimal and zero-decimal currencies', () => {
    expect(toMinorAmount('8.43', 'USD')).toBe(843);
    expect(toMinorAmount('843', 'JPY')).toBe(843);
    expect(fromMinorAmount(843, 'USD')).toBe('8.43');
    expect(fromMinorAmount(843, 'JPY')).toBe('843');
    expect(() => toMinorAmount('0', 'USD')).toThrow(BadRequestException);
  });

  it('classifies supported webhook object types and leaves unknown types ignored', () => {
    expect(classifyStripeWebhookObject({ object: 'checkout.session' })).toBe('checkout.session');
    expect(classifyStripeWebhookObject({ object: 'payment_intent' })).toBe('payment_intent');
    expect(classifyStripeWebhookObject({ object: 'refund' })).toBe('ignored');
  });

  it('builds checkout session and payment intent webhook inputs', () => {
    const event = {
      id: 'evt-1',
      type: 'checkout.session.completed',
      data: { object: {} },
    };

    expect(
      buildCheckoutSessionPaymentWebhookInput(event, {
        id: 'cs-1',
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: 843,
        currency: 'usd',
        client_reference_id: 'order-fallback',
        metadata: { orderId: 'order-1', orderNo: 'ORD1' },
      }),
    ).toEqual({
      provider: 'stripe',
      eventId: 'evt-1',
      eventType: 'checkout.session.completed',
      status: 'paid',
      orderId: 'order-1',
      orderNo: 'ORD1',
      externalPaymentId: 'cs-1',
      amount: '8.43',
      currency: 'USD',
      payload: event,
    });

    expect(
      buildPaymentIntentPaymentWebhookInput(
        { ...event, type: 'payment_intent.succeeded' },
        {
          id: 'pi-1',
          object: 'payment_intent',
          status: 'succeeded',
          amount_received: 843,
          currency: 'usd',
          metadata: { orderId: 'order-1', orderNo: 'ORD1' },
        },
      ),
    ).toEqual(
      expect.objectContaining({
        eventType: 'payment_intent.succeeded',
        externalPaymentId: 'pi-1',
        amount: '8.43',
        currency: 'USD',
      }),
    );
  });

  it('builds attach metadata and parses Stripe signature headers', () => {
    expect(
      buildStripeCheckoutAttachMetadata({
        id: 'cs-1',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/cs-1',
        payment_intent: 'pi-1',
      }),
    ).toEqual({
      stripeCheckoutSessionId: 'cs-1',
      stripePaymentIntentId: 'pi-1',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs-1',
    });

    expect(parseStripeSignatureHeader('t=123,v1=abc,v0=old,v1=def')).toEqual({
      timestamp: 123,
      signatures: ['abc', 'def'],
    });
  });
});
