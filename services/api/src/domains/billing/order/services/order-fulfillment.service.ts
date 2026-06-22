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
  OrderStatus,
  OrderType,
  PointLedgerEventType,
  Prisma,
  type orders,
} from '../../../platform/prisma/generated';
import { addPlanDuration } from '../../../platform/common/date-utils';
import {
  assertPaymentAmountMatchesOrder,
  assertPaymentCurrencyMatchesOrder,
  buildManualPaymentWebhookInput,
  buildMembershipGrantInput,
  buildPaidOrderUpdate,
  buildPointsPackageGrantInput,
  isActivePaidMembership,
  isPaidPaymentEvent,
  shouldUpdatePaidOrderPayment,
  type PaymentDetails,
  type PaymentWebhookInput,
} from './order-fulfillment.helpers';

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
    return this.handlePaymentWebhook(buildManualPaymentWebhookInput(id, input));
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

        if (!isPaidPaymentEvent(input)) {
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
        assertPaymentAmountMatchesOrder(order, input.amount, {
          requireAmount: true,
          allowLessThanExpected: input.provider === 'stripe' && order.orderType === OrderType.MEMBERSHIP,
        });
        assertPaymentCurrencyMatchesOrder(order, input.currency, { requireCurrency: true });

        const result = await this.markOrderPaidAndFulfillWithinTx(tx, order, {
          provider: input.provider,
          eventId: event.id,
          externalPaymentId: input.externalPaymentId,
          amount: input.amount,
          currency: input.currency,
          metadata: input.payload,
        }, { allowCancelledRecovery: true });

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
    options: { allowCancelledRecovery?: boolean } = {},
  ) {
    order = await this.orderRepo.lockWithinTx(tx, order.id);
    if (order.status === OrderStatus.CANCELLED && !options.allowCancelledRecovery) {
      throw new BadRequestException('已取消订单不能履约');
    }
    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('已退款订单不能重复履约');
    }

    assertPaymentAmountMatchesOrder(order, payment?.amount);
    assertPaymentCurrencyMatchesOrder(order, payment?.currency);

    const shouldUpdatePayment = shouldUpdatePaidOrderPayment(order, payment);
    const paidOrder =
      shouldUpdatePayment
        ? await this.orderRepo.updateWithinTx(tx, order.id, buildPaidOrderUpdate(order, payment))
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
    const stripeSubscription = extractStripeSubscriptionInfo(order.paymentMetadata);

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
          ...(stripeSubscription.customerId
            ? { stripeCustomerId: stripeSubscription.customerId }
            : {}),
          ...(stripeSubscription.subscriptionId
            ? { stripeSubscriptionId: stripeSubscription.subscriptionId }
            : {}),
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
          ...(stripeSubscription.customerId
            ? { stripeCustomerId: stripeSubscription.customerId }
            : {}),
          ...(stripeSubscription.subscriptionId
            ? { stripeSubscriptionId: stripeSubscription.subscriptionId }
            : {}),
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
          ...(stripeSubscription.customerId
            ? { stripeCustomerId: stripeSubscription.customerId }
            : {}),
          ...(stripeSubscription.subscriptionId
            ? { stripeSubscriptionId: stripeSubscription.subscriptionId }
            : {}),
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
    const grantInput = buildMembershipGrantInput({
      order,
      membershipId: membership.id,
      plan,
      now,
      nextExpiresAt,
      activeMembership,
      isUpgrade,
      previousPoints,
      pointsToGrant,
    });
    const grant = await this.pointsService.grantPointsWithinTx(tx, order.userId, {
      ...grantInput,
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
    if (!isActivePaidMembership(membership, new Date())) {
      throw new ForbiddenException('购买积分包需要先开通会员，请先订阅会员套餐');
    }

    const now = new Date();
    const grantInput = buildPointsPackageGrantInput({
      orderId: order.id,
      packageId: pkg.id,
      packageCode: pkg.code,
      packageName: pkg.name,
      packagePoints: pkg.points,
      validityDays: pkg.validityDays,
      usageScope: pkg.usageScope,
      now,
    });
    const grant = await this.pointsService.grantPointsWithinTx(tx, order.userId, {
      ...grantInput,
    });
    await this.orderRepo.markFulfilledWithinTx(tx, order.id, now);

    return {
      type: 'points_package',
      pointsGranted: pkg.points,
      grantId: grant.grant.id,
      expiresAt: grantInput.expiresAt,
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
}

function extractStripeSubscriptionInfo(metadata: unknown) {
  const object = objectValue(objectValue(objectValue(metadata)?.data)?.object);
  return {
    customerId: stringValue(object?.customer),
    subscriptionId: stringValue(object?.subscription),
  };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
