import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { OrderStatus, OrderType, type orders } from '../prisma/generated';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { OrderService } from './order.service';

type CreateStripeCheckoutInput = {
  orderType: OrderType;
  productId: string;
};

type StripeCheckoutSession = {
  id: string;
  object: 'checkout.session';
  url?: string | null;
  client_reference_id?: string | null;
  payment_intent?: string | null;
  payment_status?: string | null;
  status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
};

type StripePaymentIntent = {
  id: string;
  object: 'payment_intent';
  status?: string | null;
  amount_received?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
};

type StripeWebhookEvent = {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

type StripeCheckoutResult = {
  order: orders;
  checkoutUrl: string | null;
  sessionId: string | null;
  freeFulfilled?: boolean;
};

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

@Injectable()
export class StripePaymentService {
  constructor(
    private readonly config: ConfigService,
    private readonly orderService: OrderService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async createCheckout(
    userId: string,
    input: CreateStripeCheckoutInput,
  ): Promise<StripeCheckoutResult> {
    if (!input?.productId) {
      throw new BadRequestException('缺少商品 ID');
    }
    const order =
      input.orderType === OrderType.MEMBERSHIP
        ? await this.orderService.createMembershipOrder(userId, input.productId)
        : input.orderType === OrderType.POINTS_PACKAGE
          ? await this.orderService.createPointsPackageOrder(userId, input.productId)
          : null;

    if (!order) {
      throw new BadRequestException('暂不支持的订单类型');
    }

    return this.createCheckoutForOrder(order);
  }

  async createCheckoutForExistingOrder(
    userId: string,
    orderId: string,
  ): Promise<StripeCheckoutResult> {
    const order = await this.orderService.getOrderById(orderId, userId);
    return this.createCheckoutForOrder(order);
  }

  async handleWebhook(signature: string | undefined, rawBody: Buffer | undefined) {
    const event = await this.constructEvent(signature, rawBody);
    const object = event.data?.object;
    const objectType = this.stringValue(object?.object);

    if (objectType === 'checkout.session') {
      return this.handleCheckoutSessionEvent(event, object as StripeCheckoutSession);
    }
    if (objectType === 'payment_intent') {
      return this.handlePaymentIntentEvent(event, object as StripePaymentIntent);
    }

    return { received: true, ignored: true, eventType: event.type };
  }

  private async createCheckoutForOrder(order: orders): Promise<StripeCheckoutResult> {
    if (order.status === OrderStatus.PAID) {
      return { order, checkoutUrl: null, sessionId: null };
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('只有待支付订单可以创建支付会话');
    }

    const currency = await this.getCurrency();
    const amount = Number(order.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('订单金额无效');
    }
    if (amount === 0) {
      const result = await this.orderService.confirmManualPayment(order.id, {
        provider: 'free_checkout',
        eventId: `free-checkout:${order.id}`,
        currency: currency.toUpperCase(),
        metadata: {
          source: 'stripe_checkout',
          reason: 'zero_amount_order',
        },
      });
      return {
        order: (result.order ?? order) as orders,
        checkoutUrl: null,
        sessionId: null,
        freeFulfilled: true,
      };
    }

    const session = await this.createStripeCheckoutSession(order, currency);
    if (!session.url) {
      throw new BadRequestException('Stripe 未返回 Checkout URL');
    }

    const updatedOrder = await this.orderService.attachStripeCheckoutSession(order.id, {
      sessionId: session.id,
      currency: currency.toUpperCase(),
      metadata: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.payment_intent ?? null,
        checkoutUrl: session.url,
      },
    });

    return {
      order: updatedOrder,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  private async createStripeCheckoutSession(
    order: orders,
    currency: string,
  ): Promise<StripeCheckoutSession> {
    const secretKey = await this.getSecretKey();
    const params = new URLSearchParams();
    const metadata = {
      orderId: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      orderType: order.orderType,
    };

    params.set('mode', 'payment');
    params.set('success_url', await this.getSuccessUrl());
    params.set('cancel_url', await this.getCancelUrl());
    params.set('client_reference_id', order.id);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', currency.toLowerCase());
    params.set(
      'line_items[0][price_data][unit_amount]',
      String(this.toMinorAmount(order.amount, currency)),
    );
    params.set('line_items[0][price_data][product_data][name]', order.productName);

    for (const [key, value] of Object.entries(metadata)) {
      params.set(`metadata[${key}]`, value);
      params.set(`payment_intent_data[metadata][${key}]`, value);
    }

    const response = await fetch(`${await this.getApiBase()}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        this.stringValue((payload as { error?: { message?: unknown } } | null)?.error?.message) ??
        '创建 Stripe Checkout 会话失败';
      throw new BadRequestException(message);
    }
    return payload as StripeCheckoutSession;
  }

  private async handleCheckoutSessionEvent(
    event: StripeWebhookEvent,
    session: StripeCheckoutSession,
  ) {
    const metadata = session.metadata ?? {};
    return this.orderService.handlePaymentWebhook({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      status: session.payment_status ?? session.status ?? undefined,
      orderId: metadata.orderId ?? session.client_reference_id ?? undefined,
      orderNo: metadata.orderNo,
      externalPaymentId: session.id,
      amount: this.fromMinorAmount(session.amount_total, session.currency),
      currency: session.currency?.toUpperCase(),
      payload: event,
    });
  }

  private async handlePaymentIntentEvent(
    event: StripeWebhookEvent,
    paymentIntent: StripePaymentIntent,
  ) {
    const metadata = paymentIntent.metadata ?? {};
    return this.orderService.handlePaymentWebhook({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      status: paymentIntent.status ?? undefined,
      orderId: metadata.orderId,
      orderNo: metadata.orderNo,
      externalPaymentId: paymentIntent.id,
      amount: this.fromMinorAmount(paymentIntent.amount_received, paymentIntent.currency),
      currency: paymentIntent.currency?.toUpperCase(),
      payload: event,
    });
  }

  private async constructEvent(signature: string | undefined, rawBody: Buffer | undefined) {
    const webhookSecret = await this.getWebhookSecret();
    if (!signature || !rawBody) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }

    const { timestamp, signatures } = this.parseSignatureHeader(signature);
    const toleranceSeconds = await this.getWebhookToleranceSeconds();
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      toleranceSeconds > 0 &&
      Math.abs(nowSeconds - timestamp) > toleranceSeconds
    ) {
      throw new UnauthorizedException('Stripe webhook timestamp is outside tolerance');
    }

    const payload = rawBody.toString('utf8');
    const expected = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    if (!signatures.some((candidate) => this.safeCompareHex(candidate, expected))) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }

    try {
      return JSON.parse(payload) as StripeWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid Stripe webhook payload');
    }
  }

  private parseSignatureHeader(signature: string) {
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
    if (!Number.isFinite(timestamp) || signatures.length === 0) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
    return { timestamp, signatures };
  }

  private safeCompareHex(a: string, b: string) {
    try {
      const left = Buffer.from(a, 'hex');
      const right = Buffer.from(b, 'hex');
      if (left.length !== right.length) return false;
      return timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }

  private async getSecretKey() {
    const value = await this.getConfiguredString('payments.stripeSecretKey', 'STRIPE_SECRET_KEY');
    if (!value) {
      throw new BadRequestException('STRIPE_SECRET_KEY 未配置');
    }
    return value;
  }

  private async getWebhookSecret() {
    const value = await this.getConfiguredString(
      'payments.stripeWebhookSecret',
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!value) {
      throw new UnauthorizedException('STRIPE_WEBHOOK_SECRET 未配置');
    }
    return value;
  }

  private async getCurrency() {
    return (
      (await this.getConfiguredString('payments.stripeCurrency', 'STRIPE_CURRENCY')) || 'CNY'
    ).toLowerCase();
  }

  private async getApiBase() {
    return (
      (await this.getConfiguredString('payments.stripeApiBase', 'STRIPE_API_BASE')).replace(
        /\/+$/,
        '',
      ) ||
      'https://api.stripe.com'
    );
  }

  private async getSuccessUrl() {
    const configured = await this.getConfiguredString(
      'payments.stripeSuccessUrl',
      'STRIPE_SUCCESS_URL',
    );
    if (configured) return configured;
    return (
      `${await this.getWebAppUrl()}/membership/orders?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    );
  }

  private async getCancelUrl() {
    const configured = await this.getConfiguredString(
      'payments.stripeCancelUrl',
      'STRIPE_CANCEL_URL',
    );
    if (configured) return configured;
    return (
      `${await this.getWebAppUrl()}/membership/orders?checkout=cancelled`
    );
  }

  private async getWebAppUrl() {
    return (
      (await this.getConfiguredString('payments.webAppUrl', 'WEB_APP_URL')).replace(/\/+$/, '') ||
      'http://localhost:3100'
    );
  }

  private async getWebhookToleranceSeconds() {
    const rawValue = await this.getConfiguredString(
      'payments.stripeWebhookToleranceSeconds',
      'STRIPE_WEBHOOK_TOLERANCE_SECONDS',
    );
    const value = Number(rawValue || 300);
    return Number.isFinite(value) ? value : 300;
  }

  private async getConfiguredString(settingKey: string, envKey: string) {
    const settingValue = await this.systemSettingsService.getString(settingKey).catch(() => '');
    return settingValue.trim() || this.config.get<string>(envKey)?.trim() || '';
  }

  private toMinorAmount(value: unknown, currency: string) {
    const amount = Number(value);
    const multiplier = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
    const minorAmount = Math.round(amount * multiplier);
    if (!Number.isFinite(minorAmount) || minorAmount <= 0) {
      throw new BadRequestException('Stripe 支付金额无效');
    }
    return minorAmount;
  }

  private fromMinorAmount(value: number | null | undefined, currency: string | null | undefined) {
    if (value == null || !currency) return undefined;
    const divisor = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
    const amount = value / divisor;
    return divisor === 1 ? String(amount) : amount.toFixed(2);
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
