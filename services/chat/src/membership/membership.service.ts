import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderType, OrderStatus, BillingCycle } from '@prisma/client';

const CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: '月付',
  QUARTERLY: '季付',
  YEARLY: '年付',
};

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicLevels() {
    return this.prisma.membership_levels.findMany({
      where: { isActive: true },
      include: {
        plans: {
          where: { isActive: true },
          orderBy: { sort: 'asc' },
        },
      },
      orderBy: { sort: 'asc' },
    });
  }

  async getLevelsForUser(userId: string) {
    const [levels, paidOrder] = await Promise.all([
      this.getPublicLevels(),
      this.prisma.orders.findFirst({
        where: { userId, status: OrderStatus.PAID, orderType: OrderType.MEMBERSHIP },
      }),
    ]);
    return { levels, isFirstTime: !paidOrder };
  }

  async getUserMembership(userId: string) {
    const [membership, points] = await Promise.all([
      this.prisma.user_memberships.findUnique({
        where: { userId },
        include: { level: true },
      }),
      this.prisma.user_points.findUnique({ where: { userId } }),
    ]);
    return { membership, pointsBalance: points?.balance ?? 0 };
  }

  async purchaseMembership(userId: string, planId: string) {
    const plan = await this.prisma.membership_plans.findUnique({
      where: { id: planId },
      include: { level: true },
    });
    if (!plan) throw new NotFoundException('套餐不存在');

    const paidOrder = await this.prisma.orders.findFirst({
      where: { userId, status: OrderStatus.PAID, orderType: OrderType.MEMBERSHIP },
    });
    const isFirstTime = !paidOrder;
    const amount = isFirstTime && plan.firstTimePrice != null ? plan.firstTimePrice : plan.price;

    return this.prisma.orders.create({
      data: {
        userId,
        orderNo: `ORD${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
        orderType: OrderType.MEMBERSHIP,
        productId: planId,
        productName: `${plan.level.name} - ${CYCLE_LABELS[plan.billingCycle]}`,
        originalPrice: plan.originalPrice,
        amount,
        isFirstTime,
      },
    });
  }

  async fulfillMembershipOrder(orderId: string, userId: string) {
    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, userId, status: OrderStatus.PAID, orderType: OrderType.MEMBERSHIP },
    });
    if (!order) throw new BadRequestException('订单不存在或状态不正确');

    const plan = await this.prisma.membership_plans.findUnique({
      where: { id: order.productId },
      include: { level: true },
    });
    if (!plan) throw new NotFoundException('套餐不存在');

    const now = new Date();
    const membership = await this.prisma.user_memberships.upsert({
      where: { userId },
      create: {
        userId,
        levelId: plan.levelId,
        planId: plan.id,
        autoRenew: plan.autoRenew,
        startedAt: now,
        expiresAt: new Date(Date.now() + plan.months * 30 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
      update: {
        levelId: plan.levelId,
        planId: plan.id,
        autoRenew: plan.autoRenew,
        startedAt: now,
        expiresAt: new Date(Date.now() + plan.months * 30 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });

    return { membership, pointsToGrant: plan.points };
  }
}
