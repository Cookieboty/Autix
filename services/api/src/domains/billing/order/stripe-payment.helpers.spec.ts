import { BadRequestException } from '@nestjs/common';
import { BillingCycle, OrderType, Prisma } from '../../platform/prisma/generated';
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
  it('builds subscription checkout params for membership orders', () => {
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
      billingCycle: BillingCycle.YEARLY,
    });

    expect(params.get('mode')).toBe('subscription');
    expect(params.get('adaptive_pricing[enabled]')).toBe('false');
    expect(params.get('success_url')).toBe('https://app.test/success');
    expect(params.get('cancel_url')).toBe('https://app.test/cancel');
    expect(params.get('client_reference_id')).toBe('order-1');
    expect(params.get('payment_method_types[0]')).toBe('card');
    expect(params.get('payment_method_types[1]')).toBeNull();
    expect(Number(params.get('expires_at'))).toBeGreaterThanOrEqual(
      Math.floor(Date.now() / 1000) + 30 * 60 - 1,
    );
    expect(params.get('line_items[0][price_data][currency]')).toBe('usd');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('843');
    expect(params.get('line_items[0][price_data][recurring][interval]')).toBe('year');
    expect(params.get('metadata[orderNo]')).toBe('ORD1');
    expect(params.get('subscription_data[metadata][orderNo]')).toBe('ORD1');
    expect(params.get('payment_intent_data[metadata][orderNo]')).toBeNull();
  });

  it('builds payment checkout params for points package orders', () => {
    const params = buildStripeCheckoutParams({
      order: {
        id: 'order-2',
        orderNo: 'ORD2',
        userId: 'user-1',
        orderType: OrderType.POINTS_PACKAGE,
        amount: new Prisma.Decimal('59.00'),
        productName: '标准包',
      },
      currency: 'USD',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    });

    expect(params.get('mode')).toBe('payment');
    expect(params.get('payment_method_types[0]')).toBe('card');
    expect(params.get('payment_method_types[1]')).toBe('alipay');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('5900');
    expect(params.get('line_items[0][price_data][recurring][interval]')).toBeNull();
    expect(params.get('metadata[orderType]')).toBe('POINTS_PACKAGE');
    expect(params.get('payment_intent_data[metadata][orderNo]')).toBe('ORD2');
    expect(params.get('subscription_data[metadata][orderNo]')).toBeNull();
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
    expect(classifyStripeWebhookObject({ object: 'subscription' })).toBe('subscription');
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
    const metadata = buildStripeCheckoutAttachMetadata({
        id: 'cs-1',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/cs-1',
        payment_intent: 'pi-1',
        subscription: 'sub-1',
        customer: 'cus-1',
      });

    expect(metadata).toEqual(expect.objectContaining({
      stripeCheckoutSessionId: 'cs-1',
      stripePaymentIntentId: 'pi-1',
      stripeSubscriptionId: 'sub-1',
      stripeCustomerId: 'cus-1',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs-1',
    }));
    expect(metadata.stripeCheckoutExpiresAt).toEqual(expect.any(String));

    expect(parseStripeSignatureHeader('t=123,v1=abc,v0=old,v1=def')).toEqual({
      timestamp: 123,
      signatures: ['abc', 'def'],
    });
  });
});
