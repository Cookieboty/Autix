import { UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

const DEFAULT_PAYMENT_CURRENCY = 'USD';

type ConfigLike = {
  get<T = unknown>(key: string): T | undefined;
};

type OrderWebhookServiceLike = {
  handlePaymentWebhook(input: {
    provider: string;
    eventId: string;
    eventType: string;
    status?: string;
    orderId?: string;
    orderNo?: string;
    externalPaymentId?: string;
    amount?: string | number;
    currency: string;
    payload: Record<string, unknown>;
  }): Promise<unknown>;
};

type StripeWebhookServiceLike = {
  handleWebhook(
    stripeSignature: string | undefined,
    rawBody: Buffer | undefined,
  ): Promise<unknown>;
};

export async function handlePaymentWebhookRequest(args: {
  provider: string;
  secretHeader?: string;
  authorization?: string;
  stripeSignature?: string;
  rawBody?: Buffer;
  body: Record<string, unknown>;
  config: ConfigLike;
  orderService: OrderWebhookServiceLike;
  stripePaymentService: StripeWebhookServiceLike;
}) {
  if (args.provider.toLowerCase() === 'stripe') {
    return args.stripePaymentService.handleWebhook(args.stripeSignature, args.rawBody);
  }

  // FIX-5: 非 Stripe 服务商默认 fail-closed——必须在白名单内才处理，
  // 且使用按服务商隔离的密钥（存在 per-provider 密钥时不再接受共享密钥），
  // 缩小"泄露共享密钥即可为任意服务商伪造已支付事件"的攻击面。
  assertProviderAllowed(args.config, args.provider);
  assertWebhookSecret(
    resolveProviderSecret(args.config, args.provider),
    args.secretHeader,
    args.authorization,
  );
  const eventId = stringValue(args.body.eventId ?? args.body.id ?? args.body.event_id);
  const eventType = stringValue(args.body.eventType ?? args.body.type ?? args.body.event_type);
  if (!eventId || !eventType) {
    throw new UnauthorizedException('Invalid payment webhook payload');
  }

  return args.orderService.handlePaymentWebhook({
    provider: args.provider,
    eventId,
    eventType,
    status: stringValue(args.body.status ?? args.body.trade_status),
    orderId: stringValue(args.body.orderId ?? args.body.order_id),
    orderNo: stringValue(args.body.orderNo ?? args.body.order_no ?? args.body.out_trade_no),
    externalPaymentId: stringValue(
      args.body.externalPaymentId ??
        args.body.paymentId ??
        args.body.trade_no ??
        args.body.transaction_id,
    ),
    amount: numberLikeValue(args.body.amount ?? args.body.paidAmount ?? args.body.total_amount),
    currency: stringValue(args.body.currency) ?? DEFAULT_PAYMENT_CURRENCY,
    payload: args.body,
  });
}

function assertProviderAllowed(config: ConfigLike, provider: string) {
  const raw = config.get<string>('PAYMENT_WEBHOOK_ALLOWED_PROVIDERS') ?? '';
  const allowed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(provider.toLowerCase())) {
    throw new UnauthorizedException('Payment provider not enabled');
  }
}

function resolveProviderSecret(config: ConfigLike, provider: string): string | undefined {
  const providerKey = `PAYMENT_WEBHOOK_SECRET_${provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const providerSecret = config.get<string>(providerKey);
  if (providerSecret) return providerSecret;
  return config.get<string>('PAYMENT_WEBHOOK_SECRET');
}

function assertWebhookSecret(
  expected: string | undefined,
  secretHeader?: string,
  authorization?: string,
) {
  if (!expected) {
    throw new UnauthorizedException('Payment webhook secret is not configured');
  }

  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (
    (secretHeader && safeCompare(secretHeader, expected)) ||
    (bearer && safeCompare(bearer, expected))
  ) {
    return;
  }
  throw new UnauthorizedException();
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberLikeValue(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toString?: unknown }).toString === 'function'
  ) {
    const serialized = (value as { toString: () => string }).toString();
    return serialized && serialized !== '[object Object]' ? serialized : undefined;
  }
  return undefined;
}
