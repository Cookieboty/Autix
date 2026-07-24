import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nHttpException } from '../../../platform/i18n/i18n-http.exception';
import { OrderRepository } from '../repositories/order.repository';
import {
  BillingCycle,
  OrderType,
  Prisma,
  type orders,
} from '../../../platform/prisma/generated';
import type { OrderBusinessType } from '../../../platform/prisma/generated';

export const DEFAULT_PAYMENT_CURRENCY = 'USD';
export const ORDER_PENDING_TIMEOUT_MINUTES = 30;
export const ORDER_PENDING_TIMEOUT_MS = ORDER_PENDING_TIMEOUT_MINUTES * 60 * 1000;

const CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Annual',
};

function assertSubscriptionPlan(
  plan: { billingCycle: BillingCycle; autoRenew: boolean },
) {
  if (!plan.autoRenew) {
    throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.plan_must_be_subscription');
  }
  if (plan.billingCycle === BillingCycle.QUARTERLY) {
    throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'membership.plan_billing_cycle_invalid');
  }
}

@Injectable()
export class OrderCreationService {
  constructor(private readonly orderRepo: OrderRepository) {}

  pendingOrderExpiresBefore(now = new Date()) {
    return new Date(now.getTime() - ORDER_PENDING_TIMEOUT_MS);
  }

  async cancelExpiredPendingOrders(now = new Date()) {
    return this.orderRepo.cancelExpiredPendingOrders(this.pendingOrderExpiresBefore(now));
  }

  isPendingOrderExpired(order: Pick<orders, 'status' | 'updatedAt'>, now = new Date()) {
    return (
      order.status === 'PENDING' &&
      order.updatedAt.getTime() <= this.pendingOrderExpiresBefore(now).getTime()
    );
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
    return this.orderRepo.create(userId, data);
  }

  async createMembershipOrder(userId: string, planId: string, currency = DEFAULT_PAYMENT_CURRENCY) {
    const plan = await this.orderRepo.findMembershipPlanWithLevel(planId);
    if (!plan || !plan.isActive || !plan.level.isActive) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'order.plan_not_found');
    }
    assertSubscriptionPlan(plan);

    const [paidOrder, currentMembership] = await Promise.all([
      this.orderRepo.findFirstPaidMembershipOrder(userId),
      this.orderRepo.findUserMembershipWithLevel(userId),
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
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'order.already_on_plan', {
        plan: activeCurrentMembership.level.name,
      });
    }

    const reusableOrder = await this.orderRepo.findReusablePendingOrder({
      userId,
      orderType: OrderType.MEMBERSHIP,
      productId: planId,
      currency,
      expiresAfter: this.pendingOrderExpiresBefore(),
    });
    if (reusableOrder) return reusableOrder;

    const businessType: OrderBusinessType = activeCurrentMembership
      ? plan.level.level > activeCurrentMembership.level.level
        ? 'upgrade_order'
        : 'renewal_order'
      : 'subscription_order';
    const baseAmount = plan.price;
    let amount = baseAmount;
    if (businessType === 'upgrade_order' && activeCurrentMembership?.planId) {
      const currentPlan = await this.orderRepo.findMembershipPlan(activeCurrentMembership.planId);
      if (currentPlan?.billingCycle === plan.billingCycle) {
        const diff = Number(baseAmount) - Number(currentPlan.price);
        amount = diff > 0 ? new Prisma.Decimal(diff) : baseAmount;
      }
    }

    return this.orderRepo.create(userId, {
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
    const membership = await this.orderRepo.findUserMembershipWithLevel(userId);
    if (!this.isActivePaidMembership(membership, new Date())) {
      throw new I18nHttpException(HttpStatus.FORBIDDEN, 'order.points_pack_requires_membership');
    }

    const pkg = await this.orderRepo.findPointsPackage(packageId);
    if (!pkg || !pkg.isActive) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'order.points_pack_not_found');
    }

    const reusableOrder = await this.orderRepo.findReusablePendingOrder({
      userId,
      orderType: OrderType.POINTS_PACKAGE,
      productId: packageId,
      currency,
      expiresAfter: this.pendingOrderExpiresBefore(),
    });
    if (reusableOrder) return reusableOrder;

    return this.orderRepo.create(userId, {
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
      const plan = await this.orderRepo.findMembershipPlanWithLevel(order.productId);
      if (!plan || !plan.isActive || !plan.level.isActive) {
        throw new I18nHttpException(HttpStatus.NOT_FOUND, 'order.plan_not_found');
      }
      assertSubscriptionPlan(plan);

      const currentMembership = await this.orderRepo.findUserMembershipWithLevel(order.userId);
      const activeCurrentMembership =
        currentMembership?.status === 'ACTIVE' && currentMembership.expiresAt > now
          ? currentMembership
          : null;
      this.assertMembershipPlanNotDowngrade(plan, activeCurrentMembership);
      return;
    }

    if (order.orderType === OrderType.POINTS_PACKAGE) {
      const [membership, pkg] = await Promise.all([
        this.orderRepo.findUserMembershipWithLevel(order.userId),
        this.orderRepo.findPointsPackage(order.productId),
      ]);
      if (!this.isActivePaidMembership(membership, now)) {
        throw new I18nHttpException(HttpStatus.FORBIDDEN, 'order.points_pack_requires_membership');
      }
      if (!pkg || !pkg.isActive) {
        throw new I18nHttpException(HttpStatus.NOT_FOUND, 'order.points_pack_not_found');
      }
      return;
    }
  }

  assertMembershipPlanNotDowngrade(
    plan: { level: { level: number; name: string } },
    activeMembership: { level: { level: number; name: string } } | null,
  ) {
    if (activeMembership && plan.level.level < activeMembership.level.level) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'order.already_on_plan', {
        plan: activeMembership.level.name,
      });
    }
  }

  isActivePaidMembership(
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
