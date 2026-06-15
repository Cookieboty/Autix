import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderType, OrderStatus, BillingCycle, Prisma } from '../prisma/generated';
import type { OrderBusinessType } from '../prisma/generated';

const CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: '月付',
  QUARTERLY: '季付',
  YEARLY: '年付',
};

const VIDEO_RESOLUTION_RANK: Record<string, number> = {
  '480p': 1,
  '720p': 2,
  '1080p': 3,
};

export interface VideoEntitlement {
  enabled: boolean;
  maxResolution: '480p' | '720p' | '1080p';
  maxDurationSeconds: number;
  concurrency: number;
  levelName: string;
  level: number;
  source: 'membership' | 'free_default';
}

const FREE_VIDEO_ENTITLEMENT: VideoEntitlement = {
  enabled: false,
  maxResolution: '480p',
  maxDurationSeconds: 0,
  concurrency: 1,
  levelName: 'Free',
  level: 0,
  source: 'free_default',
};

function normalizeResolutionForEntitlement(
  raw: unknown,
): '480p' | '720p' | '1080p' {
  const value = String(raw ?? '480p').toLowerCase();
  if (value.includes('1080')) return '1080p';
  if (value.includes('720')) return '720p';
  return '480p';
}

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) { }

  async resolveVideoEntitlements(userId: string): Promise<VideoEntitlement> {
    const membership = await this.prisma.user_memberships.findUnique({
      where: { userId },
      include: { level: true },
    });
    const now = new Date();
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.expiresAt <= now ||
      !membership.level
    ) {
      return FREE_VIDEO_ENTITLEMENT;
    }
    const features = (membership.level.features ?? {}) as Record<string, unknown>;
    const seedance = (features.seedance ?? {}) as Record<string, unknown>;
    const enabled = Boolean(seedance.enabled);
    return {
      enabled,
      maxResolution: normalizeResolutionForEntitlement(seedance.maxResolution),
      maxDurationSeconds:
        typeof seedance.maxDurationSeconds === 'number'
          ? seedance.maxDurationSeconds
          : 0,
      concurrency:
        typeof seedance.concurrency === 'number' ? seedance.concurrency : 1,
      levelName: membership.level.name,
      level: membership.level.level,
      source: 'membership',
    };
  }

  assertVideoEntitlement(
    entitlement: VideoEntitlement,
    requested: { resolution: '480p' | '720p' | '1080p'; durationSeconds: number },
  ): void {
    if (!entitlement.enabled) {
      throw new BadRequestException(
        `当前会员等级（${entitlement.levelName}）未开通视频生成功能，请升级套餐`,
      );
    }
    const requestRank = VIDEO_RESOLUTION_RANK[requested.resolution] ?? 0;
    const allowedRank = VIDEO_RESOLUTION_RANK[entitlement.maxResolution] ?? 0;
    if (requestRank > allowedRank) {
      throw new BadRequestException(
        `当前会员等级（${entitlement.levelName}）最高支持 ${entitlement.maxResolution} 分辨率，请降级分辨率或升级套餐`,
      );
    }
    if (requested.durationSeconds > entitlement.maxDurationSeconds) {
      throw new BadRequestException(
        `当前会员等级（${entitlement.levelName}）单次最长 ${entitlement.maxDurationSeconds} 秒，请缩短时长或升级套餐`,
      );
    }
  }

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

  async cancelAtPeriodEnd(userId: string) {
    const membership = await this.prisma.user_memberships.findUnique({
      where: { userId },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new BadRequestException('当前没有可取消的有效会员');
    }

    return this.prisma.user_memberships.update({
      where: { userId },
      data: {
        autoRenew: false,
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
      include: { level: true },
    });
  }

  async purchaseMembership(userId: string, planId: string) {
    const plan = await this.prisma.membership_plans.findUnique({
      where: { id: planId },
      include: { level: true },
    });
    if (!plan) throw new NotFoundException('套餐不存在');

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

    return this.prisma.orders.create({
      data: {
        userId,
        orderNo: `ORD${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
        orderType: OrderType.MEMBERSHIP,
        businessType,
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
