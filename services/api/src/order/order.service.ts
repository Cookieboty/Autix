import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import {
  BillingCycle,
  orders,
  OrderStatus,
  OrderType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
  payment_events,
} from '../prisma/generated';
import type { OrderBusinessType } from '../prisma/generated';

const FREE_TRIAL_GRANT_DAYS = 30;
const DEFAULT_PAYMENT_CURRENCY = 'USD';

const CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: '月付',
  QUARTERLY: '季付',
  YEARLY: '年付',
};

const GRANT_TYPE_BALANCE_FIELD: Record<PointGrantType, keyof Prisma.user_pointsUpdateInput> = {
  SUBSCRIPTION: 'subscriptionBalance',
  PURCHASED: 'purchasedBalance',
  GIFT: 'giftBalance',
  COMPENSATION: 'compensationBalance',
};

const REFUNDABLE_ORDER_GRANT_EVENTS = [
  PointLedgerEventType.subscription_grant,
  PointLedgerEventType.points_purchase,
  PointLedgerEventType.campaign_bonus,
];

type PaymentDetails = {
  provider?: string;
  eventId?: string;
  externalPaymentId?: string;
  amount?: Prisma.Decimal | number | string | null;
  currency?: string;
  metadata?: unknown;
};

type PaymentWebhookInput = {
  provider: string;
  eventId: string;
  eventType: string;
  status?: string;
  orderId?: string;
  orderNo?: string;
  externalPaymentId?: string;
  amount?: Prisma.Decimal | number | string | null;
  currency?: string;
  payload?: unknown;
};

type PaymentEventClaim = {
  event: payment_events;
  alreadyProcessed?: boolean;
  alreadyProcessing?: boolean;
};

type RefundOrderInput = {
  provider?: string;
  externalRefundId?: string;
  amount?: Prisma.Decimal | number | string | null;
  currency?: string;
  reclaimPoints?: boolean;
  maxPointsToReclaim?: number;
  reason?: string;
  metadata?: unknown;
};

import { addDays, addMonths, minDate, addPlanDuration } from '../common/date-utils';

function currentSubscriptionCycleEnd(startedAt: Date, membershipExpiresAt: Date, now: Date) {
  for (let index = 0; index <= 120; index++) {
    const cycleStart = addMonths(startedAt, index);
    const cycleEnd = minDate(addMonths(startedAt, index + 1), membershipExpiresAt);
    if (cycleStart <= now && cycleEnd > now) return cycleEnd;
  }
  return minDate(addMonths(now, 1), membershipExpiresAt);
}

@Injectable()
export class OrderService {
  // P1-5: 暴露按"自然月对齐 + 月底回退"的月份推进算法，供管理员授予会员等场景复用，
  // 避免使用 `months * 30 * 24 * 60 * 60 * 1000` 引入的自然月偏差。
  static addMonths(from: Date, months: number): Date {
    return addMonths(from, months);
  }

  private static readonly PROCESSING_STALE_MINUTES = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

  /**
   * 恢复卡在 PROCESSING 超过阈值时间的支付事件，
   * 将其状态重置为 PENDING 以允许重试。可由 cron 定期调用。
   */
  async recoverStaleProcessingEvents(): Promise<number> {
    const threshold = new Date(
      Date.now() - OrderService.PROCESSING_STALE_MINUTES * 60 * 1000,
    );
    const result = await this.prisma.payment_events.updateMany({
      where: {
        status: 'PROCESSING',
        processedAt: null,
        updatedAt: { lt: threshold },
      },
      data: {
        status: 'PENDING',
        errorMessage: `auto-recovered: stuck in PROCESSING for >${OrderService.PROCESSING_STALE_MINUTES}min`,
      },
    });
    return result.count;
  }

  async createOrder(
    userId: string,
    data: {
      orderType: OrderType;
      businessType?: OrderBusinessType;
      productId: string;
      productName: string;
      originalPrice: Prisma.Decimal;
      amount: Prisma.Decimal;
      isFirstTime: boolean;
      currency?: string;
    },
  ) {
    const random4 = String(Math.floor(1000 + Math.random() * 9000));
    const orderNo = `ORD${Date.now()}${random4}`;

    return this.prisma.orders.create({
      data: {
        userId,
        orderNo,
        orderType: data.orderType,
        businessType: data.businessType,
        productId: data.productId,
        productName: data.productName,
        originalPrice: data.originalPrice,
        amount: data.amount,
        isFirstTime: data.isFirstTime,
        currency: data.currency ?? DEFAULT_PAYMENT_CURRENCY,
        status: 'PENDING',
      },
    });
  }

  async createMembershipOrder(userId: string, planId: string, currency = DEFAULT_PAYMENT_CURRENCY) {
    const plan = await this.prisma.membership_plans.findUnique({
      where: { id: planId },
      include: { level: true },
    });
    if (!plan || !plan.isActive || !plan.level.isActive) {
      throw new NotFoundException('套餐不存在或已下架');
    }

    const [paidOrder, currentMembership] = await Promise.all([
      this.prisma.orders.findFirst({
        where: { userId, status: OrderStatus.PAID, orderType: OrderType.MEMBERSHIP },
      }),
      this.prisma.user_memberships.findUnique({
        where: { userId },
        include: { level: true },
      }),
    ]);
    const isFirstTime = !paidOrder;
    const activeCurrentMembership =
      currentMembership?.status === 'ACTIVE' && currentMembership.expiresAt > new Date()
        ? currentMembership
        : null;

    if (
      activeCurrentMembership &&
      plan.level.level < activeCurrentMembership.level.level
    ) {
      throw new BadRequestException(
        `当前已是 ${activeCurrentMembership.level.name}，不能购买等级更低的 ${plan.level.name} 套餐`,
      );
    }

    const businessType: OrderBusinessType = activeCurrentMembership
      ? plan.level.level > activeCurrentMembership.level.level
        ? 'upgrade_order'
        : 'renewal_order'
      : 'subscription_order';
    const baseAmount = isFirstTime && plan.firstTimePrice != null ? plan.firstTimePrice : plan.price;
    let amount = baseAmount;
    if (businessType === 'upgrade_order' && activeCurrentMembership?.planId) {
      const currentPlan = await this.prisma.membership_plans.findUnique({
        where: { id: activeCurrentMembership.planId },
      });
      if (currentPlan?.billingCycle === plan.billingCycle) {
        const diff = Number(baseAmount) - Number(currentPlan.price);
        amount = diff > 0 ? new Prisma.Decimal(diff) : baseAmount;
      }
    }

    return this.createOrder(userId, {
      orderType: OrderType.MEMBERSHIP,
      businessType,
      productId: planId,
      productName: `${plan.level.name} - ${CYCLE_LABELS[plan.billingCycle]}`,
      originalPrice: plan.originalPrice,
      amount,
      isFirstTime,
      currency,
    });
  }

  async createPointsPackageOrder(
    userId: string,
    packageId: string,
    currency = DEFAULT_PAYMENT_CURRENCY,
  ) {
    const membership = await this.prisma.user_memberships.findUnique({
      where: { userId },
      include: { level: true },
    });
    if (!this.isActivePaidMembership(membership, new Date())) {
      throw new ForbiddenException('购买积分包需要先开通会员，请先订阅会员套餐');
    }

    const pkg = await this.prisma.points_packages.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException('积分包不存在或已下架');
    }

    return this.createOrder(userId, {
      orderType: OrderType.POINTS_PACKAGE,
      businessType: 'points_order',
      productId: pkg.id,
      productName: pkg.name,
      originalPrice: pkg.price,
      amount: pkg.price,
      isFirstTime: false,
      currency,
    });
  }

  async assertOrderCanCheckout(order: orders) {
    const now = new Date();
    if (order.orderType === OrderType.MEMBERSHIP) {
      const plan = await this.prisma.membership_plans.findUnique({
        where: { id: order.productId },
        include: { level: true },
      });
      if (!plan || !plan.isActive || !plan.level.isActive) {
        throw new NotFoundException('套餐不存在或已下架');
      }

      const currentMembership = await this.prisma.user_memberships.findUnique({
        where: { userId: order.userId },
        include: { level: true },
      });
      const activeCurrentMembership =
        currentMembership?.status === 'ACTIVE' && currentMembership.expiresAt > now
          ? currentMembership
          : null;
      this.assertMembershipPlanNotDowngrade(plan, activeCurrentMembership);
      return;
    }

    if (order.orderType === OrderType.POINTS_PACKAGE) {
      const [membership, pkg] = await Promise.all([
        this.prisma.user_memberships.findUnique({
          where: { userId: order.userId },
          include: { level: true },
        }),
        this.prisma.points_packages.findUnique({ where: { id: order.productId } }),
      ]);
      if (!this.isActivePaidMembership(membership, now)) {
        throw new ForbiddenException('购买积分包需要先开通会员，请先订阅会员套餐');
      }
      if (!pkg || !pkg.isActive) {
        throw new NotFoundException('积分包不存在或已下架');
      }
      return;
    }
  }

  async attachStripeCheckoutSession(
    orderId: string,
    input: {
      sessionId: string;
      currency: string;
      metadata?: unknown;
    },
  ) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('只有待支付订单可以创建支付会话');
    }

    return this.prisma.orders.update({
      where: { id: orderId },
      data: {
        paymentProvider: 'stripe',
        externalPaymentId: input.sessionId,
        currency: input.currency,
        paymentMetadata: this.toJsonInput(input.metadata),
      },
    });
  }

  async getUserOrders(
    userId: string,
    query: { page?: number; pageSize?: number; status?: string; orderType?: OrderType },
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: any = { userId };
    if (query.status) where.status = query.status;
    if (query.orderType) where.orderType = query.orderType;

    const [items, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.orders.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async getOrderById(id: string, userId: string) {
    const order = await this.prisma.orders.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.userId !== userId) throw new ForbiddenException('无权访问此订单');
    return order;
  }

  async cancelOrder(id: string, userId: string) {
    const order = await this.getOrderById(id, userId);
    if (order.status !== 'PENDING') {
      throw new BadRequestException('只能取消待付款的订单');
    }

    return this.prisma.orders.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async markPaidAndFulfill(id: string) {
    return this.markPaidAndFulfillWithPayment(id);
  }

  async markPaidAndFulfillWithPayment(id: string, payment?: PaymentDetails) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('订单不存在');
      return this.markOrderPaidAndFulfillWithinTx(tx, order, payment);
    });
  }

  async confirmManualPayment(
    id: string,
    input: PaymentDetails & { operatorId?: string; remark?: string } = {},
  ) {
    const eventId = input.eventId ?? `manual-paid:${id}`;
    const provider = input.provider ?? 'admin_manual';
    return this.handlePaymentWebhook({
      provider,
      eventId,
      eventType: 'manual.payment.succeeded',
      status: 'succeeded',
      orderId: id,
      externalPaymentId: input.externalPaymentId ?? eventId,
      amount: input.amount,
      currency: input.currency ?? DEFAULT_PAYMENT_CURRENCY,
      payload: {
        operatorId: input.operatorId,
        remark: input.remark,
        metadata: input.metadata,
      },
    });
  }

  async handlePaymentWebhook(input: PaymentWebhookInput) {
    if (!input.provider || !input.eventId) {
      throw new BadRequestException('支付事件缺少 provider 或 eventId');
    }

    const initialEvent = await this.claimPaymentEvent(input);

    if (initialEvent.alreadyProcessed) {
      return {
        event: initialEvent.event,
        alreadyProcessed: true,
        order: null,
        fulfillment: null,
      };
    }
    if (initialEvent.alreadyProcessing) {
      throw new ConflictException('支付事件正在处理中');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.payment_events.findUnique({
          where: { id: initialEvent.event.id },
        });
        if (!event) throw new NotFoundException('支付事件不存在');
        if (event.processedAt) {
          return { event, alreadyProcessed: true, order: null, fulfillment: null };
        }

        if (!this.isPaidPaymentEvent(input)) {
          const ignoredEvent = await tx.payment_events.update({
            where: { id: event.id },
            data: { status: 'IGNORED', processedAt: new Date() },
          });
          return {
            event: ignoredEvent,
            alreadyProcessed: false,
            ignored: true,
            order: null,
            fulfillment: null,
          };
        }

        const order = await this.findOrderForPaymentEventWithinTx(tx, input);
        this.assertPaymentAmountMatchesOrder(order, input.amount, { requireAmount: true });
        this.assertPaymentCurrencyMatchesOrder(order, input.currency, { requireCurrency: true });

        const result = await this.markOrderPaidAndFulfillWithinTx(tx, order, {
          provider: input.provider,
          eventId: event.id,
          externalPaymentId: input.externalPaymentId,
          amount: input.amount,
          currency: input.currency,
          metadata: input.payload,
        });

        const processedEvent = await tx.payment_events.update({
          where: { id: event.id },
          data: {
            orderId: result.order.id,
            userId: result.order.userId,
            orderNo: result.order.orderNo,
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });

        return {
          event: processedEvent,
          alreadyProcessed: false,
          order: result.order,
          fulfillment: result.fulfillment,
        };
      });
    } catch (error) {
      await this.prisma.payment_events
        .update({
          where: { id: initialEvent.event.id },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  private async claimPaymentEvent(input: PaymentWebhookInput): Promise<PaymentEventClaim> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.payment_events.findUnique({
          where: { provider_eventId: { provider: input.provider, eventId: input.eventId } },
        });
        if (existing?.processedAt) {
          return { event: existing, alreadyProcessed: true };
        }

        if (existing) {
          const staleThreshold = new Date(
            Date.now() - OrderService.PROCESSING_STALE_MINUTES * 60 * 1000,
          );
          const claimed = await tx.payment_events.updateMany({
            where: {
              id: existing.id,
              processedAt: null,
              OR: [
                { status: { not: 'PROCESSING' } },
                { updatedAt: { lt: staleThreshold } },
              ],
            },
            data: {
              eventType: input.eventType,
              orderNo: input.orderNo,
              externalPaymentId: input.externalPaymentId,
              amount: this.optionalDecimal(input.amount),
              currency: input.currency,
              status: 'PROCESSING',
              payload: this.toJsonInput(input.payload),
              errorMessage: null,
            },
          });
          if (claimed.count === 0) {
            return { event: existing, alreadyProcessing: true };
          }
          const event = await tx.payment_events.findUnique({ where: { id: existing.id } });
          if (!event) throw new NotFoundException('支付事件不存在');
          return { event, alreadyProcessed: false };
        }

        const event = await tx.payment_events.create({
          data: {
            provider: input.provider,
            eventId: input.eventId,
            eventType: input.eventType,
            orderNo: input.orderNo,
            externalPaymentId: input.externalPaymentId,
            amount: this.optionalDecimal(input.amount),
            currency: input.currency,
            status: 'PROCESSING',
            payload: this.toJsonInput(input.payload),
          },
        });
        return { event, alreadyProcessed: false };
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        return this.claimPaymentEvent(input);
      }
      throw error;
    }
  }

  async refundOrder(id: string, input: RefundOrderInput = {}) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('订单不存在');
      if (order.status === OrderStatus.REFUNDED) {
        return {
          order,
          alreadyRefunded: true,
          pointsReclaimed: 0,
          skippedConsumedPoints: 0,
          skippedFrozenPoints: 0,
        };
      }
      if (order.status !== OrderStatus.PAID) {
        throw new BadRequestException('只有已支付订单可以退款');
      }

      const pointRecovery = await this.reclaimAvailableOrderPointsWithinTx(
        tx,
        order,
        input.reason ?? 'order refund',
        {
          reclaimPoints: input.reclaimPoints,
          maxPointsToReclaim: input.maxPointsToReclaim,
        },
      );

      await tx.user_memberships.updateMany({
        where: { userId: order.userId, pendingOrderId: order.id },
        data: {
          pendingPlanId: null,
          pendingOrderId: null,
          pendingLevelId: null,
          pendingBillingCycle: null,
          pendingAutoRenew: null,
          pendingChangeEffectiveAt: null,
          pendingChangeRequestedAt: null,
        },
      });

      const refundProvider = input.provider ?? 'admin_manual';
      const externalRefundId = input.externalRefundId ?? `manual-refund:${order.id}`;
      await tx.payment_events.upsert({
        where: {
          provider_eventId: {
            provider: refundProvider,
            eventId: `refund:${externalRefundId}`,
          },
        },
        create: {
          provider: refundProvider,
          eventId: `refund:${externalRefundId}`,
          eventType: 'refund.succeeded',
          orderId: order.id,
          userId: order.userId,
          orderNo: order.orderNo,
          externalPaymentId: order.externalPaymentId,
          amount: this.optionalDecimal(input.amount) ?? order.paidAmount ?? order.amount,
          currency: order.currency ?? input.currency ?? DEFAULT_PAYMENT_CURRENCY,
          status: 'PROCESSED',
          payload: this.toJsonInput(input.metadata),
          processedAt: new Date(),
        },
        update: {
          orderId: order.id,
          userId: order.userId,
          status: 'PROCESSED',
          payload: this.toJsonInput(input.metadata),
          processedAt: new Date(),
        },
      });

      const refundMetadata = this.mergeJsonObjects(input.metadata, {
        pointsReclaimed: pointRecovery.pointsReclaimed,
        skippedConsumedPoints: pointRecovery.skippedConsumedPoints,
        skippedFrozenPoints: pointRecovery.skippedFrozenPoints,
      });

      const refundedOrder = await tx.orders.update({
        where: { id },
        data: {
          status: OrderStatus.REFUNDED,
          refundProvider,
          externalRefundId,
          refundAmount: this.optionalDecimal(input.amount) ?? order.paidAmount ?? order.amount,
          refundReason: input.reason ?? 'order refund',
          refundMetadata,
          refundedAt: new Date(),
        },
      });

      return {
        order: refundedOrder,
        alreadyRefunded: false,
        ...pointRecovery,
      };
    });
  }

  private async markOrderPaidAndFulfillWithinTx(
    tx: Prisma.TransactionClient,
    order: orders,
    payment?: PaymentDetails,
  ) {
    order = await this.lockOrderWithinTx(tx, order.id);
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('已取消订单不能履约');
    }
    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('已退款订单不能重复履约');
    }

    this.assertPaymentAmountMatchesOrder(order, payment?.amount);
    this.assertPaymentCurrencyMatchesOrder(order, payment?.currency);

    const shouldUpdatePayment =
      order.status !== OrderStatus.PAID ||
      Boolean(
        payment &&
          (payment.provider ||
            payment.eventId ||
            payment.externalPaymentId ||
            payment.amount ||
            payment.currency ||
            payment.metadata),
      );
    const paidOrder =
      shouldUpdatePayment
        ? await tx.orders.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.PAID,
              paidAt: order.paidAt ?? new Date(),
              paymentProvider: payment?.provider ?? order.paymentProvider,
              paymentEventId: payment?.eventId ?? order.paymentEventId,
              externalPaymentId: payment?.externalPaymentId ?? order.externalPaymentId,
              paidAmount: this.optionalDecimal(payment?.amount) ?? order.paidAmount ?? order.amount,
              currency: payment?.currency ?? order.currency ?? DEFAULT_PAYMENT_CURRENCY,
              paymentMetadata: this.toJsonInput(payment?.metadata),
            },
          })
        : order;

    const fulfillment = await this.fulfillPaidOrderWithinTx(tx, paidOrder);
    return { order: paidOrder, fulfillment };
  }

  private async lockOrderWithinTx(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  private async fulfillPaidOrderWithinTx(
    tx: Prisma.TransactionClient,
    order: orders | null,
  ) {
    if (!order) throw new NotFoundException('订单不存在');
    if (order.fulfilledAt) {
      return {
        type: order.orderType === OrderType.POINTS_PACKAGE ? 'points_package' : 'membership',
        alreadyFulfilled: true,
        pointsGranted: 0,
      };
    }
    if (order.orderType === OrderType.MEMBERSHIP) {
      return this.fulfillMembershipWithinTx(tx, order);
    }
    if (order.orderType === OrderType.POINTS_PACKAGE) {
      return this.fulfillPointsPackageWithinTx(tx, order);
    }
    throw new BadRequestException('暂不支持的订单类型');
  }

  private isPaidPaymentEvent(input: PaymentWebhookInput) {
    const normalizedStatus = input.status?.toLowerCase();
    const normalizedType = input.eventType.toLowerCase();
    if (
      normalizedType.includes('refund') ||
      normalizedType.includes('cancel') ||
      normalizedType.includes('fail') ||
      normalizedType.includes('void') ||
      normalizedStatus === 'refunded' ||
      normalizedStatus === 'cancelled' ||
      normalizedStatus === 'canceled' ||
      normalizedStatus === 'failed'
    ) {
      return false;
    }
    return (
      normalizedStatus === 'paid' ||
      normalizedStatus === 'succeeded' ||
      normalizedStatus === 'success' ||
      normalizedType.includes('paid') ||
      normalizedType.includes('succeeded') ||
      normalizedType.includes('success')
    );
  }

  private async findOrderForPaymentEventWithinTx(
    tx: Prisma.TransactionClient,
    input: PaymentWebhookInput,
  ) {
    if (input.orderId) {
      const order = await tx.orders.findUnique({ where: { id: input.orderId } });
      if (order) return order;
    }
    if (input.orderNo) {
      const order = await tx.orders.findUnique({ where: { orderNo: input.orderNo } });
      if (order) return order;
    }
    if (input.externalPaymentId) {
      const order = await tx.orders.findFirst({
        where: {
          paymentProvider: input.provider,
          externalPaymentId: input.externalPaymentId,
        },
      });
      if (order) return order;
    }
    throw new NotFoundException('支付事件未匹配到订单');
  }

  private assertPaymentAmountMatchesOrder(
    order: orders,
    amount?: Prisma.Decimal | number | string | null,
    options: { requireAmount?: boolean } = {},
  ) {
    const expected = Number(order.amount);
    if (amount === undefined || amount === null || amount === '') {
      if (options.requireAmount && expected > 0) {
        throw new BadRequestException('支付金额缺失');
      }
      return;
    }
    const actual = Number(amount);
    if (!Number.isFinite(actual) || actual <= 0) {
      if (expected === 0 && actual === 0) return;
      throw new BadRequestException('支付金额无效');
    }
    if (Math.abs(actual - expected) > 0.000001) {
      throw new BadRequestException('支付金额与订单金额不一致');
    }
  }

  private assertPaymentCurrencyMatchesOrder(
    order: orders,
    currency?: string | null,
    options: { requireCurrency?: boolean } = {},
  ) {
    const expected = (order.currency ?? DEFAULT_PAYMENT_CURRENCY).toUpperCase();
    if (!currency) {
      if (options.requireCurrency) {
        throw new BadRequestException('支付币种缺失');
      }
      return;
    }
    const actual = currency.toUpperCase();
    if (actual !== expected) {
      throw new BadRequestException('支付币种与订单币种不一致');
    }
  }

  private async reclaimAvailableOrderPointsWithinTx(
    tx: Prisma.TransactionClient,
    order: orders,
    reason: string,
    policy: { reclaimPoints?: boolean; maxPointsToReclaim?: number } = {},
  ) {
    if (policy.reclaimPoints === false) {
      return {
        pointsReclaimed: 0,
        skippedConsumedPoints: 0,
        skippedFrozenPoints: 0,
        skippedExpiredPoints: 0,
      };
    }

    const grants = await tx.point_grants.findMany({
      where: {
        sourceId: order.id,
        sourceEvent: { in: REFUNDABLE_ORDER_GRANT_EVENTS },
      },
      orderBy: { createdAt: 'asc' },
    });
    let remaining =
      policy.maxPointsToReclaim !== undefined
        ? Math.max(0, Math.floor(policy.maxPointsToReclaim))
        : Number.MAX_SAFE_INTEGER;
    let pointsReclaimed = 0;
    let skippedConsumedPoints = 0;
    let skippedFrozenPoints = 0;
    let skippedExpiredPoints = 0;

    for (const grant of grants) {
      skippedConsumedPoints += grant.consumedAmount;
      skippedFrozenPoints += grant.frozenAmount;
      skippedExpiredPoints += grant.expiredAmount;
      if (remaining <= 0 || grant.availableAmount <= 0) continue;

      const reclaimAmount = Math.min(grant.availableAmount, remaining);
      remaining -= reclaimAmount;
      pointsReclaimed += reclaimAmount;

      await tx.point_grants.update({
        where: { id: grant.id },
        data: {
          availableAmount: { decrement: reclaimAmount },
          refundedAmount: { increment: reclaimAmount },
        },
      });

      const points = await tx.user_points.update({
        where: { userId: grant.userId },
        data: {
          balance: { decrement: reclaimAmount },
          availableBalance: { decrement: reclaimAmount },
          totalBalance: { decrement: reclaimAmount },
          [GRANT_TYPE_BALANCE_FIELD[grant.grantType]]: { decrement: reclaimAmount },
        },
      });

      await tx.points_records.create({
        data: {
          userId: grant.userId,
          type: 'CONSUME',
          amount: reclaimAmount,
          source:
            order.orderType === OrderType.POINTS_PACKAGE
              ? PointsSource.PACKAGE
              : PointsSource.MEMBERSHIP,
          sourceId: order.id,
          balance: points.balance,
          remark: `refund_order:${reason}`,
        },
      });
    }

    return {
      pointsReclaimed,
      skippedConsumedPoints,
      skippedFrozenPoints,
      skippedExpiredPoints,
    };
  }

  private optionalDecimal(value?: Prisma.Decimal | number | string | null) {
    if (value === undefined || value === null || value === '') return undefined;
    return new Prisma.Decimal(value);
  }

  private mergeJsonObjects(
    value: unknown,
    extra: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return this.toJsonInput({ ...(value as Record<string, unknown>), ...extra })!;
    }
    return this.toJsonInput(extra)!;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }

  private async fulfillMembershipWithinTx(
    tx: Prisma.TransactionClient,
    order: orders,
  ) {
    const plan = await tx.membership_plans.findUnique({
      where: { id: order.productId },
      include: { level: true },
    });
    if (!plan) throw new NotFoundException('套餐不存在');

    const now = new Date();
    const previousMembership = await tx.user_memberships.findUnique({
      where: { userId: order.userId },
      include: { level: true },
    });
    const previousPlan =
      previousMembership?.planId
        ? await tx.membership_plans.findUnique({ where: { id: previousMembership.planId } })
        : null;
    const activeMembership =
      previousMembership?.status === 'ACTIVE' && previousMembership.expiresAt > now
        ? previousMembership
        : null;
    const isUpgrade =
      Boolean(activeMembership) && plan.level.level > (activeMembership?.level.level ?? -1);
    const isDowngrade =
      Boolean(activeMembership) && plan.level.level < (activeMembership?.level.level ?? -1);

    if (isDowngrade && activeMembership) {
      this.assertMembershipPlanNotDowngrade(plan, activeMembership);
    }

    if (activeMembership && !isUpgrade) {
      const membership = await tx.user_memberships.update({
        where: { userId: order.userId },
        data: {
          levelId: plan.levelId,
          planId: plan.id,
          autoRenew: plan.autoRenew,
          expiresAt: addPlanDuration(activeMembership.expiresAt, plan.months),
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          pendingPlanId: null,
          pendingOrderId: null,
          pendingLevelId: null,
          pendingBillingCycle: null,
          pendingAutoRenew: null,
          pendingChangeEffectiveAt: null,
          pendingChangeRequestedAt: null,
        },
      });
      await tx.orders.update({
        where: { id: order.id },
        data: { fulfilledAt: now },
      });
      return {
        type: 'membership',
        membership,
        pointsGranted: 0,
        renewalExtended: true,
        alreadyGranted: false,
        alreadyFulfilled: false,
      };
    }

    const nextExpiresAt = isUpgrade && activeMembership
      ? activeMembership.expiresAt
      : addPlanDuration(now, plan.months);
    const nextStartedAt = isUpgrade && activeMembership ? activeMembership.startedAt : now;
    const membership = await tx.user_memberships.upsert({
      where: { userId: order.userId },
      create: {
        userId: order.userId,
        levelId: plan.levelId,
        planId: plan.id,
        autoRenew: plan.autoRenew,
        startedAt: nextStartedAt,
        expiresAt: nextExpiresAt,
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
      update: {
        levelId: plan.levelId,
        planId: plan.id,
        autoRenew: plan.autoRenew,
        startedAt: nextStartedAt,
        expiresAt: nextExpiresAt,
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        pendingPlanId: null,
        pendingOrderId: null,
        pendingLevelId: null,
        pendingBillingCycle: null,
        pendingAutoRenew: null,
        pendingChangeEffectiveAt: null,
        pendingChangeRequestedAt: null,
      },
    });

    const existingGrant = await tx.point_grants.findFirst({
      where: {
        sourceId: order.id,
        sourceEvent: {
          in: [
            PointLedgerEventType.subscription_grant,
            PointLedgerEventType.campaign_bonus,
          ],
        },
      },
    });

    if (existingGrant || plan.points <= 0) {
      await tx.orders.update({
        where: { id: order.id },
        data: { fulfilledAt: now },
      });
      return {
        type: 'membership',
        membership,
        pointsGranted: 0,
        alreadyGranted: Boolean(existingGrant),
        alreadyFulfilled: false,
      };
    }

    const isFreePlan = plan.level.level === 0 || Number(plan.price) === 0;
    const previousPoints =
      isUpgrade && previousMembership?.status === 'ACTIVE'
        ? previousPlan?.points ?? previousMembership.level.pointsPerMonth
        : 0;
    const pointsToGrant =
      isUpgrade
        ? Math.max(0, plan.points - previousPoints)
        : plan.points;
    if (pointsToGrant <= 0) {
      await tx.orders.update({
        where: { id: order.id },
        data: { fulfilledAt: now },
      });
      return {
        type: 'membership',
        membership,
        pointsGranted: 0,
        alreadyGranted: false,
        alreadyFulfilled: false,
      };
    }
    const grant = await this.pointsService.grantPointsWithinTx(tx, order.userId, {
      amount: pointsToGrant,
      grantType: isFreePlan ? PointGrantType.GIFT : PointGrantType.SUBSCRIPTION,
      sourceEvent: isFreePlan
        ? PointLedgerEventType.campaign_bonus
        : PointLedgerEventType.subscription_grant,
      source: PointsSource.MEMBERSHIP,
      sourceId: order.id,
      expiresAt: isFreePlan
        ? addDays(now, FREE_TRIAL_GRANT_DAYS)
        : isUpgrade && activeMembership
          ? currentSubscriptionCycleEnd(activeMembership.startedAt, activeMembership.expiresAt, now)
          : minDate(addMonths(now, 1), nextExpiresAt),
      usageScope: isFreePlan
        ? { excludedTaskTypes: ['seedance_720p', 'seedance_1080p', 'seedance_fast_720p'] }
        : undefined,
      metadata: {
        orderId: order.id,
        membershipId: membership.id,
        planId: plan.id,
        billingCycle: plan.billingCycle,
        monthlyGrant: true,
        pointsOnlyForCurrentCycle: plan.billingCycle === BillingCycle.YEARLY,
        businessType: order.businessType,
        upgradeGrant: isUpgrade,
        previousPoints,
      },
      remark: isFreePlan
        ? `Free 一次性体验积分: ${plan.level.name}`
        : `会员订阅积分: ${plan.level.name}`,
    });
    await tx.orders.update({
      where: { id: order.id },
      data: { fulfilledAt: now },
    });

    return {
      type: 'membership',
      membership,
      pointsGranted: pointsToGrant,
      grantId: grant.grant.id,
      alreadyGranted: false,
      alreadyFulfilled: false,
    };
  }

  private async fulfillPointsPackageWithinTx(
    tx: Prisma.TransactionClient,
    order: orders,
  ) {
    const existingGrant = await tx.point_grants.findFirst({
      where: { sourceEvent: PointLedgerEventType.points_purchase, sourceId: order.id },
    });
    if (existingGrant) {
      await tx.orders.update({
        where: { id: order.id },
        data: { fulfilledAt: new Date() },
      });
      return {
        type: 'points_package',
        pointsGranted: 0,
        alreadyGranted: true,
        grantId: existingGrant.id,
        alreadyFulfilled: false,
      };
    }

    const pkg = await tx.points_packages.findUnique({ where: { id: order.productId } });
    if (!pkg) throw new NotFoundException('积分包不存在');
    if (!pkg.isActive) throw new BadRequestException('积分包已下架');

    const membership = await tx.user_memberships.findUnique({
      where: { userId: order.userId },
      include: { level: true },
    });
    if (!this.isActivePaidMembership(membership, new Date())) {
      throw new ForbiddenException('购买积分包需要先开通会员，请先订阅会员套餐');
    }

    const now = new Date();
    const grant = await this.pointsService.grantPointsWithinTx(tx, order.userId, {
      amount: pkg.points,
      grantType: PointGrantType.PURCHASED,
      sourceEvent: PointLedgerEventType.points_purchase,
      source: PointsSource.PACKAGE,
      sourceId: order.id,
      expiresAt: addDays(now, pkg.validityDays),
      usageScope: (pkg.usageScope ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: {
        orderId: order.id,
        packageId: pkg.id,
        packageCode: pkg.code,
        validityDays: pkg.validityDays,
      },
      remark: `积分包购买: ${pkg.name}`,
    });
    await tx.orders.update({
      where: { id: order.id },
      data: { fulfilledAt: now },
    });

    return {
      type: 'points_package',
      pointsGranted: pkg.points,
      grantId: grant.grant.id,
      expiresAt: addDays(now, pkg.validityDays),
      alreadyGranted: false,
      alreadyFulfilled: false,
    };
  }

  private assertMembershipPlanNotDowngrade(
    plan: { level: { level: number; name: string } },
    activeMembership: { level: { level: number; name: string } } | null,
  ) {
    if (activeMembership && plan.level.level < activeMembership.level.level) {
      throw new BadRequestException(
        `当前已是 ${activeMembership.level.name}，不能购买等级更低的 ${plan.level.name} 套餐`,
      );
    }
  }

  private isActivePaidMembership(
    membership:
      | { status: string; expiresAt: Date; level?: { level: number } | null }
      | null
      | undefined,
    now: Date,
  ) {
    return (
      !!membership &&
      membership.status === 'ACTIVE' &&
      membership.expiresAt > now &&
      Number(membership.level?.level ?? 0) > 0
    );
  }
}
