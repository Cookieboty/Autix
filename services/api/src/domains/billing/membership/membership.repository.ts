import { Injectable } from '@nestjs/common';
import { Prisma, OrderStatus, OrderType, PointLedgerEventType, PointGrantType } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserMembershipWithLevel(userId: string) {
    return this.prisma.user_memberships.findUnique({
      where: { userId },
      include: { level: true },
    });
  }

  listPublicLevels() {
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

  findPaidMembershipOrder(userId: string) {
    return this.prisma.orders.findFirst({
      where: { userId, status: OrderStatus.PAID, orderType: OrderType.MEMBERSHIP },
    });
  }

  findUserMembershipAndPoints(userId: string) {
    return Promise.all([
      this.findUserMembershipWithLevel(userId),
      this.prisma.user_points.findUnique({ where: { userId } }),
    ]);
  }

  findUserMembership(userId: string) {
    return this.prisma.user_memberships.findUnique({
      where: { userId },
    });
  }

  cancelUserMembershipAtPeriodEnd(userId: string, cancelledAt: Date) {
    return this.prisma.user_memberships.update({
      where: { userId },
      data: {
        autoRenew: false,
        cancelAtPeriodEnd: true,
        cancelledAt,
      },
      include: { level: true },
    });
  }

  createLevel(data: Prisma.membership_levelsUncheckedCreateInput) {
    return this.prisma.membership_levels.create({ data });
  }

  updateLevel(id: string, data: Prisma.membership_levelsUncheckedUpdateInput) {
    return this.prisma.membership_levels.update({
      where: { id },
      data,
    });
  }

  createPlan(data: Prisma.membership_plansUncheckedCreateInput) {
    return this.prisma.membership_plans.create({ data });
  }

  updatePlan(id: string, data: Prisma.membership_plansUncheckedUpdateInput) {
    return this.prisma.membership_plans.update({
      where: { id },
      data,
    });
  }

  findPendingMembershipChanges(now: Date) {
    return this.prisma.user_memberships.findMany({
      where: {
        status: 'ACTIVE',
        pendingPlanId: { not: null },
        pendingChangeEffectiveAt: { lte: now },
      },
      include: { level: true },
    });
  }

  async expireMemberships(now: Date) {
    const [cancelled, expired] = await Promise.all([
      this.prisma.user_memberships.updateMany({
        where: {
          status: 'ACTIVE',
          cancelAtPeriodEnd: true,
          expiresAt: { lte: now },
        },
        data: { status: 'CANCELLED', autoRenew: false },
      }),
      this.prisma.user_memberships.updateMany({
        where: {
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
          expiresAt: { lte: now },
        },
        data: { status: 'EXPIRED', autoRenew: false },
      }),
    ]);
    return { cancelled, expired };
  }

  findActiveMembershipsForSubscriptionPoints(now: Date) {
    return this.prisma.user_memberships.findMany({
      where: {
        status: 'ACTIVE',
        startedAt: { lt: now },
        expiresAt: { gt: now },
      },
      include: { level: true },
    });
  }

  findPlan(id: string) {
    return this.prisma.membership_plans.findUnique({
      where: { id },
    });
  }

  runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  findSubscriptionGrantBySourceInTx(tx: Prisma.TransactionClient, sourceId: string) {
    return tx.point_grants.findFirst({
      where: {
        sourceEvent: PointLedgerEventType.subscription_grant,
        sourceId,
      },
    });
  }

  findMembershipInTx(tx: Prisma.TransactionClient, id: string) {
    return tx.user_memberships.findUnique({
      where: { id },
    });
  }

  findPlanWithLevelInTx(tx: Prisma.TransactionClient, id: string) {
    return tx.membership_plans.findUnique({
      where: { id },
      include: { level: true },
    });
  }

  clearMissingPendingPlanInTx(tx: Prisma.TransactionClient, id: string) {
    return tx.user_memberships.update({
      where: { id },
      data: {
        status: 'EXPIRED',
        autoRenew: false,
        pendingPlanId: null,
        pendingOrderId: null,
        pendingLevelId: null,
        pendingBillingCycle: null,
        pendingAutoRenew: null,
        pendingChangeEffectiveAt: null,
        pendingChangeRequestedAt: null,
      },
    });
  }

  activatePendingPlanInTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.user_membershipsUncheckedUpdateInput,
  ) {
    return tx.user_memberships.update({
      where: { id },
      data,
    });
  }

  findPreviousSubscriptionGrantsInTx(
    tx: Prisma.TransactionClient,
    input: { userId: string; previousCycleStart: Date; cycleStart: Date },
  ) {
    return tx.point_grants.findMany({
      where: {
        userId: input.userId,
        grantType: PointGrantType.SUBSCRIPTION,
        sourceEvent: PointLedgerEventType.subscription_grant,
        availableAmount: { gt: 0 },
        expiresAt: {
          gt: input.previousCycleStart,
          lte: input.cycleStart,
        },
      },
    });
  }
}
