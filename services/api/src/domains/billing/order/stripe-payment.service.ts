import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { BillingCycle, OrderStatus, OrderType, type orders } from '../../platform/prisma/generated';
import { SystemSettingsService } from '../../platform/system-settings/system-settings.service';
import { OrderService } from './order.service';
import {
  buildCheckoutSessionPaymentWebhookInput,
  buildCheckoutSessionSyncEvent,
  buildPaymentIntentPaymentWebhookInput,
  buildStripeCheckoutAttachMetadata,
  buildStripeCheckoutParams,
  buildStripeSubscriptionSyncInput,
  classifyStripeWebhookObject,
  fromMinorAmount,
  parseStripeSignatureHeader,
  STRIPE_CHECKOUT_EXPIRATION_SECONDS,
  stringValue,
  toMinorAmount,
  type StripeCheckoutSession,
  type StripePaymentIntent,
  type StripeSubscription,
  type StripeWebhookEvent,
} from './stripe-payment.helpers';

type CreateStripeCheckoutInput = {
  orderType: OrderType;
  productId: string;
};

type StripeCheckoutResult = {
  order: orders;
  checkoutUrl: string | null;
  sessionId: string | null;
  freeFulfilled?: boolean;
};

type StripeCheckoutSyncResult = {
  order: orders;
  sessionId: string;
  paymentStatus?: string | null;
  sessionStatus?: string | null;
  synced: boolean;
};

type StripeRefundResult = {
  id: string;
  object?: string;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
};

const DEFAULT_PAYMENT_CURRENCY = 'USD';

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
    const currency = await this.getCurrency();
    const order =
      input.orderType === OrderType.MEMBERSHIP
        ? await this.orderService.createMembershipOrder(
            userId,
            input.productId,
            currency.toUpperCase(),
          )
        : input.orderType === OrderType.POINTS_PACKAGE
          ? await this.orderService.createPointsPackageOrder(
              userId,
              input.productId,
              currency.toUpperCase(),
            )
          : null;

    if (!order) {
      throw new BadRequestException('暂不支持的订单类型');
    }

    return this.createCheckoutForOrder(order, currency);
  }

  async createCheckoutForExistingOrder(
    userId: string,
    orderId: string,
  ): Promise<StripeCheckoutResult> {
    const order = await this.orderService.getOrderById(orderId, userId);
    return this.createCheckoutForOrder(order);
  }

  async syncCheckoutSession(
    userId: string,
    sessionId: string,
  ): Promise<StripeCheckoutSyncResult> {
    const session = await this.retrieveCheckoutSession(sessionId);
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (!orderId) {
      throw new BadRequestException('Stripe Checkout 会话缺少订单信息');
    }

    const order = await this.orderService.getOrderById(orderId, userId);
    if (!orderMatchesStripeCheckoutSession(order, session)) {
      throw new BadRequestException('Stripe Checkout 会话与订单不匹配');
    }

    if (order.status === OrderStatus.PAID) {
      return {
        order,
        sessionId: session.id,
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
        synced: false,
      };
    }

    if (session.payment_status !== 'paid') {
      return {
        order,
        sessionId: session.id,
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
        synced: false,
      };
    }

    const result = await this.orderService.handlePaymentWebhook(
      buildCheckoutSessionPaymentWebhookInput(
        buildCheckoutSessionSyncEvent(session),
        session,
      ),
    );

    return {
      order: result.order ?? await this.orderService.getOrderById(order.id, userId),
      sessionId: session.id,
      paymentStatus: session.payment_status,
      sessionStatus: session.status,
      synced: Boolean(result.order),
    };
  }

  async handleWebhook(signature: string | undefined, rawBody: Buffer | undefined) {
    const event = await this.constructEvent(signature, rawBody);
    const object = event.data?.object;
    const objectType = classifyStripeWebhookObject(object);

    if (objectType === 'checkout.session') {
      return this.handleCheckoutSessionEvent(event, object as StripeCheckoutSession);
    }
    if (objectType === 'payment_intent') {
      return this.handlePaymentIntentEvent(event, object as StripePaymentIntent);
    }
    if (objectType === 'subscription') {
      return this.handleSubscriptionEvent(event, object as StripeSubscription);
    }

    return { received: true, ignored: true, eventType: event.type };
  }

  async createRefund(input: {
    order: Pick<
      orders,
      'id' | 'orderNo' | 'externalPaymentId' | 'paidAmount' | 'amount' | 'currency' | 'paymentMetadata'
    >;
    amount?: string | number | null;
    externalRefundId?: string;
    reason?: string;
    metadata?: Record<string, string | undefined>;
  }): Promise<{
    provider: 'stripe';
    externalRefundId: string;
    amount: string;
    currency: string;
    metadata: StripeRefundResult;
  }> {
    const paymentIntentId = resolveStripePaymentIntentId(input.order);
    if (!paymentIntentId) throw new BadRequestException('Stripe 退款缺少 PaymentIntent ID');

    const currency = (input.order.currency ?? DEFAULT_PAYMENT_CURRENCY).toUpperCase();
    const refundAmount = input.amount ?? input.order.paidAmount ?? input.order.amount;
    // FIX-16: 幂等键固定为订单维度，忽略调用方传入的 externalRefundId，
    // 确保并发/重试的退款调用对同一订单只会产生一笔 Stripe 退款。
    const idempotencyKey = `refund:${input.order.id}`;
    const refundRequestId = input.externalRefundId ?? idempotencyKey;
    const params = new URLSearchParams();
    params.set('payment_intent', paymentIntentId);
    params.set('amount', String(toMinorAmount(refundAmount, currency)));
    params.set('metadata[orderId]', input.order.id);
    params.set('metadata[orderNo]', input.order.orderNo);
    if (input.reason) params.set('metadata[reason]', input.reason);
    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      if (value) params.set(`metadata[${key}]`, value);
    }
    params.set('metadata[requestedRefundId]', refundRequestId);

    const response = await fetch(`${await this.getApiBase()}/v1/refunds`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await this.getSecretKey()}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': idempotencyKey,
      },
      body: params.toString(),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        stringValue((payload as { error?: { message?: unknown } } | null)?.error?.message) ??
        '创建 Stripe 退款失败';
      throw new BadRequestException(message);
    }

    const refund = payload as StripeRefundResult;
    if (!refund.id) throw new BadRequestException('Stripe 未返回退款 ID');
    return {
      provider: 'stripe',
      externalRefundId: refund.id,
      amount: fromMinorAmount(refund.amount, refund.currency) ?? String(refundAmount),
      currency: refund.currency?.toUpperCase() ?? currency,
      metadata: refund,
    };
  }

  async cancelSubscriptionImmediately(subscriptionId: string) {
    return this.requestSubscriptionMutation(subscriptionId, { method: 'DELETE' });
  }

  async cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
    const params = new URLSearchParams();
    params.set('cancel_at_period_end', 'true');
    return this.requestSubscriptionMutation(subscriptionId, { method: 'POST', params });
  }

  private async requestSubscriptionMutation(
    subscriptionId: string,
    options: { method: 'POST' | 'DELETE'; params?: URLSearchParams },
  ): Promise<StripeSubscription> {
    const id = stringValue(subscriptionId);
    if (!id || !id.startsWith('sub_')) {
      throw new BadRequestException('Stripe Subscription ID 无效');
    }

    const response = await fetch(
      `${await this.getApiBase()}/v1/subscriptions/${encodeURIComponent(id)}`,
      {
        method: options.method,
        headers: {
          authorization: `Bearer ${await this.getSecretKey()}`,
          ...(options.params ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        },
        ...(options.params ? { body: options.params.toString() } : {}),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        stringValue((payload as { error?: { message?: unknown } } | null)?.error?.message) ??
        '取消 Stripe 订阅失败';
      throw new BadRequestException(message);
    }
    return payload as StripeSubscription;
  }

  private async createCheckoutForOrder(
    order: orders,
    configuredCurrency?: string,
  ): Promise<StripeCheckoutResult> {
    if (order.status === OrderStatus.PAID) {
      return { order, checkoutUrl: null, sessionId: null };
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('只有待支付订单可以创建支付会话');
    }
    await this.orderService.assertOrderCanCheckout(order);

    const currency = configuredCurrency ?? await this.getCurrency();
    if (order.currency && order.currency.toLowerCase() !== currency) {
      throw new BadRequestException('订单币种与当前支付币种不一致，请重新下单');
    }
    const amount = Number(order.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('订单金额无效');
    }
    if (amount === 0) {
      throw new BadRequestException('0 元订单不应进入支付流程');
    }

    const reusableCheckout = resolveReusableStripeCheckout(order);
    if (reusableCheckout) {
      return {
        order,
        checkoutUrl: reusableCheckout.checkoutUrl,
        sessionId: reusableCheckout.sessionId,
      };
    }

    const plan = await this.orderService.getMembershipPlanForOrder(order);
    const session = await this.createStripeCheckoutSession(order, currency, plan?.billingCycle);
    if (!session.url) {
      throw new BadRequestException('Stripe 未返回 Checkout URL');
    }

    const updatedOrder = await this.orderService.attachStripeCheckoutSession(order.id, {
      sessionId: session.id,
      currency: currency.toUpperCase(),
      metadata: buildStripeCheckoutAttachMetadata(session),
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
    billingCycle?: BillingCycle,
  ): Promise<StripeCheckoutSession> {
    const secretKey = await this.getSecretKey();
    const params = buildStripeCheckoutParams({
      order,
      currency,
      successUrl: await this.getSuccessUrl(),
      cancelUrl: await this.getCancelUrl(),
      billingCycle,
    });

    const response = await fetch(`${await this.getApiBase()}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': `checkout:${order.id}`,
      },
      body: params.toString(),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        stringValue((payload as { error?: { message?: unknown } } | null)?.error?.message) ??
        '创建 Stripe Checkout 会话失败';
      throw new BadRequestException(message);
    }
    return payload as StripeCheckoutSession;
  }

  private async retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
    const id = stringValue(sessionId);
    if (!id || !id.startsWith('cs_')) {
      throw new BadRequestException('Stripe Checkout Session ID 无效');
    }

    const response = await fetch(
      `${await this.getApiBase()}/v1/checkout/sessions/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${await this.getSecretKey()}`,
        },
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        stringValue((payload as { error?: { message?: unknown } } | null)?.error?.message) ??
        '查询 Stripe Checkout 会话失败';
      throw new BadRequestException(message);
    }
    return payload as StripeCheckoutSession;
  }

  private async handleCheckoutSessionEvent(
    event: StripeWebhookEvent,
    session: StripeCheckoutSession,
  ) {
    return this.orderService.handlePaymentWebhook(
      buildCheckoutSessionPaymentWebhookInput(event, session),
    );
  }

  private async handlePaymentIntentEvent(
    event: StripeWebhookEvent,
    paymentIntent: StripePaymentIntent,
  ) {
    return this.orderService.handlePaymentWebhook(
      buildPaymentIntentPaymentWebhookInput(event, paymentIntent),
    );
  }

  private async handleSubscriptionEvent(
    event: StripeWebhookEvent,
    subscription: StripeSubscription,
  ) {
    const input = buildStripeSubscriptionSyncInput(event, subscription);
    const membership = await this.orderService.syncStripeSubscription(input);
    return {
      received: true,
      eventType: event.type,
      subscriptionId: subscription.id,
      synced: Boolean(membership),
    };
  }

  private async constructEvent(signature: string | undefined, rawBody: Buffer | undefined) {
    const webhookSecret = await this.getWebhookSecret();
    if (!signature || !rawBody) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }

    const { timestamp, signatures } = parseStripeSignatureHeader(signature);
    if (!Number.isFinite(timestamp) || signatures.length === 0) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
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
    await this.assertTestModeKey(value);
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
      (await this.getConfiguredString('payments.stripeCurrency', 'STRIPE_CURRENCY')) ||
      DEFAULT_PAYMENT_CURRENCY
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
      `${await this.getWebAppUrl()}/membership/orders/checkout?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    );
  }

  private async getCancelUrl() {
    const configured = await this.getConfiguredString(
      'payments.stripeCancelUrl',
      'STRIPE_CANCEL_URL',
    );
    if (configured) return configured;
    return (
      `${await this.getWebAppUrl()}/membership/orders/checkout?checkout=cancelled`
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

  private async assertTestModeKey(secretKey: string) {
    if (!(await this.isTestModeEnabled())) return;
    if (secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_')) return;
    throw new BadRequestException('Stripe Test 模式开启时必须配置 sk_test_ 或 rk_test_ 测试密钥');
  }

  private async isTestModeEnabled() {
    return this.systemSettingsService
      .getBoolean('payments.stripeTestModeEnabled')
      .catch(() => false);
  }

  private async getConfiguredString(settingKey: string, envKey: string) {
    const settingValue = await this.systemSettingsService.getString(settingKey).catch(() => '');
    return settingValue.trim() || this.config.get<string>(envKey)?.trim() || '';
  }

}

function orderMatchesStripeCheckoutSession(order: orders, session: StripeCheckoutSession) {
  if (order.paymentProvider !== 'stripe') return false;
  if (order.externalPaymentId === session.id) return true;
  const metadata = order.paymentMetadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>).stripeCheckoutSessionId === session.id;
}

function resolveReusableStripeCheckout(order: orders, now = new Date()) {
  if (order.paymentProvider !== 'stripe') return null;
  const sessionId = stringValue(order.externalPaymentId);
  if (!sessionId?.startsWith('cs_')) return null;

  const metadata = objectValue(order.paymentMetadata);
  const checkoutUrl = stringValue(metadata?.checkoutUrl);
  if (!checkoutUrl) return null;

  const expiresAt =
    parseCheckoutExpiresAt(metadata?.stripeCheckoutExpiresAt) ??
    new Date(order.updatedAt.getTime() + STRIPE_CHECKOUT_EXPIRATION_SECONDS * 1000);
  if (expiresAt <= now) return null;

  return { sessionId, checkoutUrl };
}

function resolveStripePaymentIntentId(
  order: Pick<orders, 'externalPaymentId' | 'paymentMetadata'>,
) {
  const metadata = objectValue(order.paymentMetadata);
  const fromMetadata = metadata?.stripePaymentIntentId;
  if (typeof fromMetadata === 'string' && fromMetadata.startsWith('pi_')) {
    return fromMetadata;
  }
  const fromWebhookPayload = objectValue(objectValue(metadata?.data)?.object)?.payment_intent;
  if (typeof fromWebhookPayload === 'string' && fromWebhookPayload.startsWith('pi_')) {
    return fromWebhookPayload;
  }
  if (order.externalPaymentId?.startsWith('pi_')) return order.externalPaymentId;
  return undefined;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseCheckoutExpiresAt(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
