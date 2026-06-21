import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderRepository } from '../repositories/order.repository';
import {
  BillingCycle,
  OrderType,
  Prisma,
  type orders,
} from '../../../platform/prisma/generated';
import type { OrderBusinessType } from '../../../platform/prisma/generated';

const DEFAULT_PAYMENT_CURRENCY = 'USD';

const CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: '月付',
  QUARTERLY: '季付',
  YEARLY: '年付',
};

@Injectable()
export class OrderCreationService {
  constructor(private readonly orderRepo: OrderRepository) {}

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
      throw new NotFoundException('套餐不存在或已下架');
    }

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
      throw new BadRequestException(
        `当前已是 ${activeCurrentMembership.level.name}，不能购买等级更低的 ${plan.level.name} 套餐`,
      );
    }

    const reusableOrder = await this.orderRepo.findReusablePendingOrder({
      userId,
      orderType: OrderType.MEMBERSHIP,
      productId: planId,
      currency,
    });
    if (reusableOrder) return reusableOrder;

    const businessType: OrderBusinessType = activeCurrentMembership
      ? plan.level.level > activeCurrentMembership.level.level
        ? 'upgrade_order'
        : 'renewal_order'
      : 'subscription_order';
    const baseAmount = isFirstTime && plan.firstTimePrice != null ? plan.firstTimePrice : plan.price;
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
      throw new ForbiddenException('购买积分包需要先开通会员，请先订阅会员套餐');
    }

    const pkg = await this.orderRepo.findPointsPackage(packageId);
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException('积分包不存在或已下架');
    }

    const reusableOrder = await this.orderRepo.findReusablePendingOrder({
      userId,
      orderType: OrderType.POINTS_PACKAGE,
      productId: packageId,
      currency,
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
        throw new NotFoundException('套餐不存在或已下架');
      }

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
        throw new ForbiddenException('购买积分包需要先开通会员，请先订阅会员套餐');
      }
      if (!pkg || !pkg.isActive) {
        throw new NotFoundException('积分包不存在或已下架');
      }
      return;
    }
  }

  assertMembershipPlanNotDowngrade(
    plan: { level: { level: number; name: string } },
    activeMembership: { level: { level: number; name: string } } | null,
  ) {
    if (activeMembership && plan.level.level < activeMembership.level.level) {
      throw new BadRequestException(
        `当前已是 ${activeMembership.level.name}，不能购买等级更低的 ${plan.level.name} 套餐`,
      );
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
