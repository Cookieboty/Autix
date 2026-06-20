import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PointsService } from '../../points/points.service';
import { OrderRepository } from '../repositories/order.repository';
import { PaymentEventRepository } from '../repositories/payment-event.repository';
import {
  BillingCycle,
  OrderStatus,
  OrderType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
  type orders,
} from '../../../platform/prisma/generated';
import { addDays, addMonths, minDate, addPlanDuration } from '../../../platform/common/date-utils';

const FREE_TRIAL_GRANT_DAYS = 30;
const DEFAULT_PAYMENT_CURRENCY = 'USD';

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

function currentSubscriptionCycleEnd(startedAt: Date, membershipExpiresAt: Date, now: Date) {
  for (let index = 0; index <= 120; index++) {
    const cycleStart = addMonths(startedAt, index);
    const cycleEnd = minDate(addMonths(startedAt, index + 1), membershipExpiresAt);
    if (cycleStart <= now && cycleEnd > now) return cycleEnd;
  }
  return minDate(addMonths(now, 1), membershipExpiresAt);
}

@Injectable()
export class OrderFulfillmentService {
  constructor(
    private readonly pointsService: PointsService,
    private readonly orderRepo: OrderRepository,
    private readonly paymentEventRepo: PaymentEventRepository,
  ) {}

  async markPaidAndFulfill(id: string) {
    return this.markPaidAndFulfillWithPayment(id);
  }

  async markPaidAndFulfillWithPayment(id: string, payment?: PaymentDetails) {
    return this.orderRepo.runInTransaction(async (tx) => {
      const order = await this.orderRepo.findByIdWithinTxOrThrow(tx, id);
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

    const initialEvent = await this.paymentEventRepo.claimPaymentEvent(input);

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
      return await this.orderRepo.runInTransaction(async (tx) => {
        const event = await this.paymentEventRepo.findByIdWithinTx(tx, initialEvent.event.id);
        if (!event) throw new NotFoundException('支付事件不存在');
        if (event.processedAt) {
          return { event, alreadyProcessed: true, order: null, fulfillment: null };
        }

        if (!this.isPaidPaymentEvent(input)) {
          const ignoredEvent = await this.paymentEventRepo.markIgnoredWithinTx(tx, event.id);
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

        const processedEvent = await this.paymentEventRepo.markProcessedWithinTx(tx, event.id, {
          orderId: result.order.id,
          userId: result.order.userId,
          orderNo: result.order.orderNo,
        });

        return {
          event: processedEvent,
          alreadyProcessed: false,
          order: result.order,
          fulfillment: result.fulfillment,
        };
      });
    } catch (error) {
      await this.paymentEventRepo.markFailed(
        initialEvent.event.id,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async markOrderPaidAndFulfillWithinTx(
    tx: Prisma.TransactionClient,
    order: orders,
    payment?: PaymentDetails,
  ) {
    order = await this.orderRepo.lockWithinTx(tx, order.id);
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
        ? await this.orderRepo.updateWithinTx(tx, order.id, {
            status: OrderStatus.PAID,
            paidAt: order.paidAt ?? new Date(),
            paymentProvider: payment?.provider ?? order.paymentProvider,
            paymentEventId: payment?.eventId ?? order.paymentEventId,
            externalPaymentId: payment?.externalPaymentId ?? order.externalPaymentId,
            paidAmount: this.optionalDecimal(payment?.amount) ?? order.paidAmount ?? order.amount,
            currency: payment?.currency ?? order.currency ?? DEFAULT_PAYMENT_CURRENCY,
            paymentMetadata: this.toJsonInput(payment?.metadata),
          })
        : order;

    const fulfillment = await this.fulfillPaidOrderWithinTx(tx, paidOrder);
    return { order: paidOrder, fulfillment };
  }

  async fulfillMembershipWithinTx(
    tx: Prisma.TransactionClient,
    order: orders,
  ) {
    const plan = await this.orderRepo.findMembershipPlanWithLevelWithinTx(tx, order.productId);
    if (!plan) throw new NotFoundException('套餐不存在');

    const now = new Date();
    const previousMembership = await this.orderRepo.findUserMembershipWithLevelWithinTx(
      tx,
      order.userId,
    );
    const previousPlan =
      previousMembership?.planId
        ? await this.orderRepo.findMembershipPlanWithinTx(tx, previousMembership.planId)
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
      if (plan.level.level < activeMembership.level.level) {
        throw new BadRequestException(
          `当前已是 ${activeMembership.level.name}，不能购买等级更低的 ${plan.level.name} 套餐`,
        );
      }
    }

    if (activeMembership && !isUpgrade) {
      const membership = await this.orderRepo.updateUserMembershipByUserIdWithinTx(
        tx,
        order.userId,
        {
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
      );
      await this.orderRepo.markFulfilledWithinTx(tx, order.id, now);
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
    const membership = await this.orderRepo.upsertUserMembershipByUserIdWithinTx(
      tx,
      order.userId,
      {
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

    const existingGrant = await this.orderRepo.findPointGrantByOrderEventsWithinTx(tx, order.id, [
      PointLedgerEventType.subscription_grant,
      PointLedgerEventType.campaign_bonus,
    ]);

    if (existingGrant || plan.points <= 0) {
      await this.orderRepo.markFulfilledWithinTx(tx, order.id, now);
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
      await this.orderRepo.markFulfilledWithinTx(tx, order.id, now);
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
    await this.orderRepo.markFulfilledWithinTx(tx, order.id, now);

    return {
      type: 'membership',
      membership,
      pointsGranted: pointsToGrant,
      grantId: grant.grant.id,
      alreadyGranted: false,
      alreadyFulfilled: false,
    };
  }

  async fulfillPointsPackageWithinTx(
    tx: Prisma.TransactionClient,
    order: orders,
  ) {
    const existingGrant = await this.orderRepo.findPointGrantByOrderEventsWithinTx(tx, order.id, [
      PointLedgerEventType.points_purchase,
    ]);
    if (existingGrant) {
      await this.orderRepo.markFulfilledWithinTx(tx, order.id);
      return {
        type: 'points_package',
        pointsGranted: 0,
        alreadyGranted: true,
        grantId: existingGrant.id,
        alreadyFulfilled: false,
      };
    }

    const pkg = await this.orderRepo.findPointsPackageWithinTx(tx, order.productId);
    if (!pkg) throw new NotFoundException('积分包不存在');
    if (!pkg.isActive) throw new BadRequestException('积分包已下架');

    const membership = await this.orderRepo.findUserMembershipWithLevelWithinTx(tx, order.userId);
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
    await this.orderRepo.markFulfilledWithinTx(tx, order.id, now);

    return {
      type: 'points_package',
      pointsGranted: pkg.points,
      grantId: grant.grant.id,
      expiresAt: addDays(now, pkg.validityDays),
      alreadyGranted: false,
      alreadyFulfilled: false,
    };
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
      const order = await this.orderRepo.findByIdWithinTx(tx, input.orderId);
      if (order) return order;
    }
    if (input.orderNo) {
      const order = await this.orderRepo.findByOrderNoWithinTx(tx, input.orderNo);
      if (order) return order;
    }
    if (input.externalPaymentId) {
      const order = await this.orderRepo.findByExternalPaymentWithinTx(
        tx,
        input.provider,
        input.externalPaymentId,
      );
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

  private optionalDecimal(value?: Prisma.Decimal | number | string | null) {
    if (value === undefined || value === null || value === '') return undefined;
    return new Prisma.Decimal(value);
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }
}
