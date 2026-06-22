import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  OrderType,
  PointsSource,
  Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  getMembershipLevels() {
    return this.prisma.membership_levels.findMany({
      include: {
        plans: {
          orderBy: [
            { billingCycle: 'asc' },
            { months: 'asc' },
            { autoRenew: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
      orderBy: [{ sort: 'asc' }, { level: 'asc' }, { createdAt: 'asc' }],
    });
  }

  getMembershipPlans() {
    return this.prisma.membership_plans.findMany({
      include: { level: true },
      orderBy: [
        { level: { sort: 'asc' } },
        { level: { level: 'asc' } },
        { billingCycle: 'asc' },
        { months: 'asc' },
        { autoRenew: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  getPointsPackages() {
    return this.prisma.points_packages.findMany({ orderBy: { sort: 'asc' } });
  }

  createPointsPackage(data: Prisma.points_packagesUncheckedCreateInput) {
    return this.prisma.points_packages.create({ data });
  }

  updatePointsPackage(id: string, data: Prisma.points_packagesUncheckedUpdateInput) {
    return this.prisma.points_packages.update({ where: { id }, data });
  }

  getPricingRules() {
    return this.prisma.generation_pricing_rules.findMany({
      orderBy: [{ taskType: 'asc' }, { name: 'asc' }],
    });
  }

  createPricingRule(data: Prisma.generation_pricing_rulesUncheckedCreateInput) {
    return this.prisma.generation_pricing_rules.create({ data });
  }

  updatePricingRule(id: string, data: Prisma.generation_pricing_rulesUncheckedUpdateInput) {
    return this.prisma.generation_pricing_rules.update({ where: { id }, data });
  }

  async listOrders(input: {
    page: number;
    pageSize: number;
    userId?: string;
    status?: string;
    orderType?: string;
  }) {
    const where: Prisma.ordersWhereInput = {};
    if (input.userId) where.userId = input.userId;
    if (input.status) where.status = input.status as OrderStatus;
    if (input.orderType) where.orderType = input.orderType as OrderType;

    const [items, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orders.count({ where }),
    ]);

    return {
      items,
      total,
      page: input.page,
      pageSize: input.pageSize,
      hasMore: input.page * input.pageSize < total,
    };
  }

  async listPointsRecords(input: {
    page: number;
    pageSize: number;
    userId?: string;
    source?: string;
  }) {
    const where: Prisma.points_recordsWhereInput = {};
    if (input.userId) where.userId = input.userId;
    if (input.source) where.source = input.source as PointsSource;

    const [items, total] = await Promise.all([
      this.prisma.points_records.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.points_records.count({ where }),
    ]);

    return {
      items,
      total,
      page: input.page,
      pageSize: input.pageSize,
      hasMore: input.page * input.pageSize < total,
    };
  }

  async listUserSummaries(input: { page: number; pageSize: number; search: string }) {
    const where: Prisma.UserWhereInput = input.search
      ? {
          OR: [
            { username: { contains: input.search } },
            { email: { contains: input.search } },
            { realName: { contains: input.search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          realName: true,
          status: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const enriched = await Promise.all(
      users.map(async (user) => {
        const [membership, points] = await Promise.all([
          this.prisma.user_memberships.findUnique({
            where: { userId: user.id },
            include: { level: true },
          }),
          this.prisma.user_points.findUnique({ where: { userId: user.id } }),
        ]);

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          realName: user.realName,
          status: user.status,
          membership,
          pointsBalance: points?.balance ?? 0,
        };
      }),
    );

    return {
      items: enriched,
      total,
      page: input.page,
      pageSize: input.pageSize,
      hasMore: input.page * input.pageSize < total,
    };
  }

  async getUserDetail(userId: string) {
    const [userInfo, membership, points, recentRecords, recentOrders] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            email: true,
            realName: true,
            avatar: true,
            phone: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
            roles: { include: { role: true } },
          },
        }),
        this.prisma.user_memberships.findUnique({
          where: { userId },
          include: { level: true },
        }),
        this.prisma.user_points.findUnique({ where: { userId } }),
        this.prisma.points_records.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.orders.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

    const pointsBalance = points?.balance ?? 0;

    return {
      ...userInfo,
      membership,
      points: pointsBalance,
      pointsBalance,
      account: points,
      recentRecords,
      recentOrders,
      pointsRecords: recentRecords,
      orders: recentOrders,
    };
  }

  async getUserPointsDetail(input: {
    userId: string;
    grantLimit: number;
    holdLimit: number;
    recordLimit: number;
  }) {
    const [account, grants, holds, records, grantSummary, holdSummary] =
      await Promise.all([
        this.prisma.user_points.findUnique({ where: { userId: input.userId } }),
        this.prisma.point_grants.findMany({
          where: { userId: input.userId },
          orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
          take: input.grantLimit,
        }),
        this.prisma.point_holds.findMany({
          where: { userId: input.userId },
          orderBy: { createdAt: 'desc' },
          take: input.holdLimit,
          include: { items: true },
        }),
        this.prisma.points_records.findMany({
          where: { userId: input.userId },
          orderBy: { createdAt: 'desc' },
          take: input.recordLimit,
        }),
        this.prisma.point_grants.groupBy({
          by: ['grantType'],
          where: { userId: input.userId },
          _sum: {
            totalAmount: true,
            availableAmount: true,
            frozenAmount: true,
            consumedAmount: true,
            expiredAmount: true,
            refundedAmount: true,
          },
        }),
        this.prisma.point_holds.groupBy({
          by: ['status'],
          where: { userId: input.userId },
          _count: { _all: true },
          _sum: { estimatedAmount: true, confirmedAmount: true },
        }),
      ]);

    return {
      userId: input.userId,
      account,
      grantSummary,
      holdSummary,
      grants,
      holds,
      records,
    };
  }

  findPendingRegistrationByUser(userId: string) {
    return this.prisma.systemRegistration.findFirst({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
  }

  findMembershipLevel(id: string) {
    return this.prisma.membership_levels.findUnique({ where: { id } });
  }

  findPointsPackage(id: string) {
    return this.prisma.points_packages.findUnique({ where: { id } });
  }

  runMembershipGrantTransaction(
    input: {
      userId: string;
      levelId: string;
      startedAt: Date;
      expiresAt: Date;
    },
    grantPoints?: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user_memberships.upsert({
        where: { userId: input.userId },
        update: {
          levelId: input.levelId,
          startedAt: input.startedAt,
          expiresAt: input.expiresAt,
          status: 'ACTIVE',
          autoRenew: false,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
        create: {
          userId: input.userId,
          levelId: input.levelId,
          startedAt: input.startedAt,
          expiresAt: input.expiresAt,
          status: 'ACTIVE',
          autoRenew: false,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      });

      if (grantPoints) await grantPoints(tx);
    });
  }

  runPointGrantTransaction<T>(grantPoints: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(grantPoints);
  }
}
