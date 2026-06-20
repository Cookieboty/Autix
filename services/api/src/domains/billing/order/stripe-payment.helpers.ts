import { BadRequestException } from '@nestjs/common';
import type { orders } from '../../platform/prisma/generated';

type StripeMetadata = Record<string, string>;

export type StripeCheckoutSession = {
  id: string;
  object: 'checkout.session';
  url?: string | null;
  client_reference_id?: string | null;
  payment_intent?: string | null;
  payment_status?: string | null;
  status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: StripeMetadata | null;
};

export type StripePaymentIntent = {
  id: string;
  object: 'payment_intent';
  status?: string | null;
  amount_received?: number | null;
  currency?: string | null;
  metadata?: StripeMetadata | null;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

export type StripeWebhookObjectType = 'checkout.session' | 'payment_intent' | 'ignored';

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

export function classifyStripeWebhookObject(value: unknown): StripeWebhookObjectType {
  const objectType = stringValue((value as { object?: unknown } | null | undefined)?.object);
  if (objectType === 'checkout.session' || objectType === 'payment_intent') {
    return objectType;
  }
  return 'ignored';
}

export function buildStripeCheckoutParams(input: {
  order: Pick<orders, 'id' | 'orderNo' | 'userId' | 'orderType' | 'amount' | 'productName'>;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const params = new URLSearchParams();
  const metadata = buildStripeOrderMetadata(input.order);

  params.set('mode', 'payment');
  params.set('success_url', input.successUrl);
  params.set('cancel_url', input.cancelUrl);
  params.set('client_reference_id', input.order.id);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
  params.set(
    'line_items[0][price_data][unit_amount]',
    String(toMinorAmount(input.order.amount, input.currency)),
  );
  params.set('line_items[0][price_data][product_data][name]', input.order.productName);

  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, value);
    params.set(`payment_intent_data[metadata][${key}]`, value);
  }

  return params;
}

export function buildStripeCheckoutAttachMetadata(session: StripeCheckoutSession) {
  return {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.payment_intent ?? null,
    checkoutUrl: session.url,
  };
}

export function buildCheckoutSessionPaymentWebhookInput(
  event: StripeWebhookEvent,
  session: StripeCheckoutSession,
) {
  const metadata = session.metadata ?? {};
  return {
    provider: 'stripe',
    eventId: event.id,
    eventType: event.type,
    status: session.payment_status ?? session.status ?? undefined,
    orderId: metadata.orderId ?? session.client_reference_id ?? undefined,
    orderNo: metadata.orderNo,
    externalPaymentId: session.id,
    amount: fromMinorAmount(session.amount_total, session.currency),
    currency: session.currency?.toUpperCase(),
    payload: event,
  };
}

export function buildPaymentIntentPaymentWebhookInput(
  event: StripeWebhookEvent,
  paymentIntent: StripePaymentIntent,
) {
  const metadata = paymentIntent.metadata ?? {};
  return {
    provider: 'stripe',
    eventId: event.id,
    eventType: event.type,
    status: paymentIntent.status ?? undefined,
    orderId: metadata.orderId,
    orderNo: metadata.orderNo,
    externalPaymentId: paymentIntent.id,
    amount: fromMinorAmount(paymentIntent.amount_received, paymentIntent.currency),
    currency: paymentIntent.currency?.toUpperCase(),
    payload: event,
  };
}

export function parseStripeSignatureHeader(signature: string) {
  const parts = signature.split(',').map((part) => {
    const separator = part.indexOf('=');
    return separator > 0
      ? [part.slice(0, separator), part.slice(separator + 1)] as const
      : [part, ''] as const;
  });
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts
    .filter(([key, value]) => key === 'v1' && Boolean(value))
    .map(([, value]) => value);
  return { timestamp, signatures };
}

export function toMinorAmount(value: unknown, currency: string) {
  const amount = Number(value);
  const multiplier = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
  const minorAmount = Math.round(amount * multiplier);
  if (!Number.isFinite(minorAmount) || minorAmount <= 0) {
    throw new BadRequestException('Stripe 支付金额无效');
  }
  return minorAmount;
}

export function fromMinorAmount(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  if (value == null || !currency) return undefined;
  const divisor = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
  const amount = value / divisor;
  return divisor === 1 ? String(amount) : amount.toFixed(2);
}

export function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function buildStripeOrderMetadata(
  order: Pick<orders, 'id' | 'orderNo' | 'userId' | 'orderType'>,
): StripeMetadata {
  return {
    orderId: order.id,
    orderNo: order.orderNo,
    userId: order.userId,
    orderType: String(order.orderType),
  };
}
