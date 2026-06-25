import { BadRequestException } from '@nestjs/common';
import { BillingCycle, OrderType, type orders } from '../../platform/prisma/generated';

type StripeMetadata = Record<string, string>;

export type StripeCheckoutSession = {
  id: string;
  object: 'checkout.session';
  mode?: string | null;
  url?: string | null;
  expires_at?: number | null;
  client_reference_id?: string | null;
  payment_intent?: string | null;
  subscription?: string | null;
  customer?: string | null;
  payment_status?: string | null;
  status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: StripeMetadata | null;
};

export type StripeSubscription = {
  id: string;
  object: 'subscription';
  status?: string | null;
  customer?: string | { id?: string | null } | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  canceled_at?: number | null;
  cancel_at?: number | null;
  ended_at?: number | null;
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

export type StripeWebhookObjectType = 'checkout.session' | 'payment_intent' | 'subscription' | 'ignored';
export const STRIPE_CHECKOUT_EXPIRATION_SECONDS = 30 * 60;

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
  if (
    objectType === 'checkout.session' ||
    objectType === 'payment_intent' ||
    objectType === 'subscription'
  ) {
    return objectType;
  }
  return 'ignored';
}

export function buildStripeCheckoutParams(input: {
  order: Pick<orders, 'id' | 'orderNo' | 'userId' | 'orderType' | 'amount' | 'productName'>;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  billingCycle?: BillingCycle;
}) {
  const params = new URLSearchParams();
  const metadata = buildStripeOrderMetadata(input.order);
  const isSubscription = input.order.orderType === OrderType.MEMBERSHIP;

  params.set('mode', isSubscription ? 'subscription' : 'payment');
  params.set('adaptive_pricing[enabled]', 'false');
  params.set('success_url', input.successUrl);
  params.set('cancel_url', input.cancelUrl);
  params.set(
    'expires_at',
    String(Math.floor(Date.now() / 1000) + STRIPE_CHECKOUT_EXPIRATION_SECONDS),
  );
  params.set('client_reference_id', input.order.id);
  params.set('payment_method_types[0]', 'card');
  if (!isSubscription) {
    params.set('payment_method_types[1]', 'alipay');
  }
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
  params.set(
    'line_items[0][price_data][unit_amount]',
    String(toMinorAmount(input.order.amount, input.currency)),
  );
  params.set('line_items[0][price_data][product_data][name]', input.order.productName);
  if (isSubscription) {
    const interval = input.billingCycle === BillingCycle.YEARLY ? 'year' : 'month';
    params.set('line_items[0][price_data][recurring][interval]', interval);
  }

  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, value);
    if (isSubscription) {
      params.set(`subscription_data[metadata][${key}]`, value);
    } else {
      params.set(`payment_intent_data[metadata][${key}]`, value);
    }
  }

  return params;
}

export function buildStripeCheckoutAttachMetadata(session: StripeCheckoutSession) {
  return {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.payment_intent ?? null,
    stripeSubscriptionId: session.subscription ?? null,
    stripeCustomerId: stringValue(session.customer) ?? null,
    stripeCheckoutExpiresAt: checkoutExpiresAtIso(session.expires_at),
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

export function buildStripeSubscriptionSyncInput(
  event: StripeWebhookEvent,
  subscription: StripeSubscription,
) {
  return {
    eventId: event.id,
    eventType: event.type,
    subscriptionId: subscription.id,
    customerId: resolveStripeCustomerId(subscription.customer),
    status: subscription.status ?? undefined,
    currentPeriodStart: unixSecondsToDate(subscription.current_period_start),
    currentPeriodEnd: unixSecondsToDate(subscription.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    cancelledAt:
      unixSecondsToDate(subscription.canceled_at) ??
      unixSecondsToDate(subscription.ended_at) ??
      unixSecondsToDate(subscription.cancel_at),
    metadata: subscription.metadata ?? {},
    payload: event,
  };
}

export function buildCheckoutSessionSyncEvent(session: StripeCheckoutSession): StripeWebhookEvent {
  return {
    id: `checkout_sync:${session.id}`,
    type: 'checkout.session.completed',
    data: { object: session as unknown as Record<string, unknown> },
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

function resolveStripeCustomerId(value: StripeSubscription['customer']) {
  if (typeof value === 'string') return value;
  return stringValue(value?.id);
}

function unixSecondsToDate(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return undefined;
  return new Date(value * 1000);
}

function checkoutExpiresAtIso(value: number | null | undefined) {
  return (
    unixSecondsToDate(value) ??
    new Date(Date.now() + STRIPE_CHECKOUT_EXPIRATION_SECONDS * 1000)
  ).toISOString();
}
