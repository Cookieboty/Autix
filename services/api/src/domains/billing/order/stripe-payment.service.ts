import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { OrderStatus, OrderType, type orders } from '../../platform/prisma/generated';
import { SystemSettingsService } from '../../platform/system-settings/system-settings.service';
import { OrderService } from './order.service';
import {
  buildCheckoutSessionPaymentWebhookInput,
  buildPaymentIntentPaymentWebhookInput,
  buildStripeCheckoutAttachMetadata,
  buildStripeCheckoutParams,
  classifyStripeWebhookObject,
  parseStripeSignatureHeader,
  stringValue,
  type StripeCheckoutSession,
  type StripePaymentIntent,
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

    return { received: true, ignored: true, eventType: event.type };
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

    const session = await this.createStripeCheckoutSession(order, currency);
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
  ): Promise<StripeCheckoutSession> {
    const secretKey = await this.getSecretKey();
    const params = buildStripeCheckoutParams({
      order,
      currency,
      successUrl: await this.getSuccessUrl(),
      cancelUrl: await this.getCancelUrl(),
    });

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
        stringValue((payload as { error?: { message?: unknown } } | null)?.error?.message) ??
        '创建 Stripe Checkout 会话失败';
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
