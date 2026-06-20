import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { getCurrentUserId } from '../auth/decorators/current-user.decorator';
import { OrderService } from '../order/order.service';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationService } from '../registration/registration.service';
import {
  OrderStatus,
  OrderType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../prisma/generated';
import {
  ApproveUserDto,
  FulfillOrderDto,
  GrantMembershipDto,
  GrantPointsDto,
  RefundOrderDto,
  UpsertMembershipLevelDto,
  UpsertMembershipPlanDto,
  UpsertPointsPackageDto,
  UpsertPricingRuleDto,
  PreviewPricingRuleInputDto,
} from './dto/admin-write.dto';
import { AdminAuditStore } from './admin-audit.store';
import { BatchJobService } from './batch-job.service';
import type { AuthUser } from '@autix/types';

@Injectable()
export class AdminService {
  private readonly auditLogger = new Logger('AdminAudit');

  constructor(
    private readonly prisma: PrismaService,
    private readonly registrationService: RegistrationService,
    private readonly batchJobService: BatchJobService,
    private readonly pointsService: PointsService,
    private readonly orderService: OrderService,
    private readonly auditStore: AdminAuditStore,
  ) {}

  getAuditLogs(input: {
    action?: string;
    actorId?: string;
    limit?: string;
    cursor?: string;
  }) {
    return this.auditStore.query({
      action: input.action,
      actorId: input.actorId,
      limit: parseInt(input.limit ?? '50', 10) || 50,
      cursor: input.cursor ? parseInt(input.cursor, 10) || undefined : undefined,
    });
  }

  listBatchJobs(user: AuthUser, page = '1', pageSize = '20') {
    const userId = getCurrentUserId(user);
    return this.batchJobService.listJobs(
      userId,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
  }

  getBatchJob(id: string) {
    return this.batchJobService.getJob(id);
  }

  getMembershipLevels() {
    return this.prisma.membership_levels.findMany({
      include: { plans: true },
      orderBy: { sort: 'asc' },
    });
  }

  createMembershipLevel(user: AuthUser, body: UpsertMembershipLevelDto) {
    this.audit(user, 'membership_levels.create', { name: body.name, level: body.level });
    return this.prisma.membership_levels.create({
      data: body as unknown as Prisma.membership_levelsUncheckedCreateInput,
    });
  }

  updateMembershipLevel(user: AuthUser, id: string, body: UpsertMembershipLevelDto) {
    this.audit(user, 'membership_levels.update', { id });
    return this.prisma.membership_levels.update({
      where: { id },
      data: body as unknown as Prisma.membership_levelsUncheckedUpdateInput,
    });
  }

  getMembershipPlans() {
    return this.prisma.membership_plans.findMany({
      include: { level: true },
      orderBy: { sort: 'asc' },
    });
  }

  createMembershipPlan(user: AuthUser, body: UpsertMembershipPlanDto) {
    this.audit(user, 'membership_plans.create', {
      levelId: body.levelId,
      durationMonths: body.durationMonths,
      price: body.price,
    });
    return this.prisma.membership_plans.create({
      data: body as unknown as Prisma.membership_plansUncheckedCreateInput,
    });
  }

  updateMembershipPlan(user: AuthUser, id: string, body: UpsertMembershipPlanDto) {
    this.audit(user, 'membership_plans.update', { id });
    return this.prisma.membership_plans.update({
      where: { id },
      data: body as unknown as Prisma.membership_plansUncheckedUpdateInput,
    });
  }

  getPointsPackages() {
    return this.prisma.points_packages.findMany({ orderBy: { sort: 'asc' } });
  }

  createPointsPackage(user: AuthUser, body: UpsertPointsPackageDto) {
    this.audit(user, 'points_packages.create', { name: body.name, points: body.points });
    return this.prisma.points_packages.create({
      data: body as Prisma.points_packagesUncheckedCreateInput,
    });
  }

  updatePointsPackage(user: AuthUser, id: string, body: UpsertPointsPackageDto) {
    this.audit(user, 'points_packages.update', { id });
    return this.prisma.points_packages.update({
      where: { id },
      data: body as Prisma.points_packagesUncheckedUpdateInput,
    });
  }

  getPricingRules() {
    return this.prisma.generation_pricing_rules.findMany({
      orderBy: [{ taskType: 'asc' }, { name: 'asc' }],
    });
  }

  createPricingRule(user: AuthUser, body: UpsertPricingRuleDto) {
    this.audit(user, 'generation_pricing_rules.create', {
      taskType: body.taskType,
      name: body.name,
      baseCost: body.baseCost,
    });
    return this.prisma.generation_pricing_rules.create({
      data: body as Prisma.generation_pricing_rulesUncheckedCreateInput,
    });
  }

  updatePricingRule(user: AuthUser, id: string, body: UpsertPricingRuleDto) {
    this.audit(user, 'generation_pricing_rules.update', { id, baseCost: body.baseCost });
    return this.prisma.generation_pricing_rules.update({
      where: { id },
      data: body as Prisma.generation_pricing_rulesUncheckedUpdateInput,
    });
  }

  previewPricingRule(body: PreviewPricingRuleInputDto) {
    return this.pointsService.previewPricingRule(
      body as unknown as Parameters<PointsService['previewPricingRule']>[0],
    );
  }

  async getOrders(input: {
    page?: string;
    pageSize?: string;
    userId?: string;
    status?: string;
    orderType?: string;
  }) {
    const p = parseInt(input.page ?? '1', 10) || 1;
    const ps = parseInt(input.pageSize ?? '20', 10) || 20;
    const where: Prisma.ordersWhereInput = {};
    if (input.userId) where.userId = input.userId;
    if (input.status) where.status = input.status as OrderStatus;
    if (input.orderType) where.orderType = input.orderType as OrderType;

    const [items, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orders.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  fulfillOrder(user: AuthUser, id: string, body: FulfillOrderDto = {}) {
    this.audit(user, 'orders.fulfill', {
      id,
      externalPaymentId: body.externalPaymentId,
      amount: body.amount,
    });
    return this.orderService.confirmManualPayment(id, {
      operatorId: getCurrentUserId(user),
      externalPaymentId: body.externalPaymentId,
      amount: body.amount,
      currency: body.currency,
      remark: body.remark,
    });
  }

  refundOrder(user: AuthUser, id: string, body: RefundOrderDto = {}) {
    this.audit(user, 'orders.refund', {
      id,
      amount: body.amount,
      reclaimPoints: body.reclaimPoints,
      reason: body.reason,
    });
    return this.orderService.refundOrder(id, {
      provider: 'admin_manual',
      externalRefundId: body.externalRefundId,
      amount: body.amount,
      currency: body.currency,
      reclaimPoints: body.reclaimPoints,
      maxPointsToReclaim: body.maxPointsToReclaim,
      reason: body.reason ?? body.remark ?? 'admin refund',
      metadata: {
        operatorId: getCurrentUserId(user),
        remark: body.remark,
      },
    });
  }

  async getPointsRecords(input: {
    page?: string;
    pageSize?: string;
    userId?: string;
    source?: string;
  }) {
    const p = parseInt(input.page ?? '1', 10) || 1;
    const ps = parseInt(input.pageSize ?? '20', 10) || 20;
    const where: Prisma.points_recordsWhereInput = {};
    if (input.userId) where.userId = input.userId;
    if (input.source) where.source = input.source as PointsSource;

    const [items, total] = await Promise.all([
      this.prisma.points_records.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.points_records.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getUsers(page = '1', pageSize = '20', search = '') {
    const p = parseInt(page, 10) || 1;
    const ps = parseInt(pageSize, 10) || 20;

    const where = search
      ? {
        OR: [
          { username: { contains: search } },
          { email: { contains: search } },
          { realName: { contains: search } },
        ],
      }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
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
      users.map(async (u) => {
        const [membership, points] = await Promise.all([
          this.prisma.user_memberships.findUnique({
            where: { userId: u.id },
            include: { level: true },
          }),
          this.prisma.user_points.findUnique({ where: { userId: u.id } }),
        ]);
        return {
          id: u.id,
          username: u.username,
          email: u.email,
          realName: u.realName,
          status: u.status,
          membership,
          pointsBalance: points?.balance ?? 0,
        };
      }),
    );

    return {
      items: enriched,
      total,
      page: p,
      pageSize: ps,
      hasMore: p * ps < total,
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

    return {
      ...userInfo,
      membership,
      points: points?.balance ?? 0,
      recentRecords,
      recentOrders,
    };
  }

  async getUserPointsDetail(
    userId: string,
    grantTake = '50',
    holdTake = '20',
    recordTake = '50',
  ) {
    const grantLimit = Math.min(Math.max(parseInt(grantTake, 10) || 50, 1), 200);
    const holdLimit = Math.min(Math.max(parseInt(holdTake, 10) || 20, 1), 100);
    const recordLimit = Math.min(Math.max(parseInt(recordTake, 10) || 50, 1), 200);

    const [account, grants, holds, records, grantSummary, holdSummary] = await Promise.all([
      this.prisma.user_points.findUnique({ where: { userId } }),
      this.prisma.point_grants.findMany({
        where: { userId },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
        take: grantLimit,
      }),
      this.prisma.point_holds.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: holdLimit,
        include: { items: true },
      }),
      this.prisma.points_records.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: recordLimit,
      }),
      this.prisma.point_grants.groupBy({
        by: ['grantType'],
        where: { userId },
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
        where: { userId },
        _count: { _all: true },
        _sum: { estimatedAmount: true, confirmedAmount: true },
      }),
    ]);

    return {
      userId,
      account,
      grantSummary,
      holdSummary,
      grants,
      holds,
      records,
    };
  }

  async approveUser(user: AuthUser, userId: string, body: ApproveUserDto) {
    const registration = await this.prisma.systemRegistration.findFirst({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!registration) {
      throw new BadRequestException('没有待审批的注册申请');
    }
    this.audit(user, 'users.approve', { userId, note: body.note });
    return this.registrationService.approve(registration.id, user, { note: body.note });
  }

  async grantMembership(user: AuthUser, userId: string, body: GrantMembershipDto) {
    const { levelId, months = 1 } = body;

    const level = await this.prisma.membership_levels.findUnique({ where: { id: levelId } });
    if (!level) throw new BadRequestException('会员等级不存在');

    const now = new Date();
    const expiresAt = OrderService.addMonths(now, Math.max(1, months));
    const pointsToGrant = level.pointsPerMonth;

    this.audit(user, 'users.grant_membership', { userId, levelId, months });

    await this.prisma.$transaction(async (tx) => {
      await tx.user_memberships.upsert({
        where: { userId },
        update: {
          levelId,
          startedAt: now,
          expiresAt,
          status: 'ACTIVE',
          autoRenew: false,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
        create: {
          userId,
          levelId,
          startedAt: now,
          expiresAt,
          status: 'ACTIVE',
          autoRenew: false,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      });

      if (pointsToGrant > 0) {
        await this.pointsService.grantPointsWithinTx(tx, userId, {
          amount: pointsToGrant,
          grantType: PointGrantType.SUBSCRIPTION,
          sourceEvent: PointLedgerEventType.admin_adjustment,
          source: PointsSource.ADMIN_GRANT,
          expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          remark: `管理员授予 ${level.name} 当前周期积分`,
          metadata: { months, grantPolicy: 'current_cycle_only' },
        });
      }
    });

    return { message: '授予成功' };
  }

  async grantPoints(user: AuthUser, userId: string, body: GrantPointsDto) {
    let pointsToGrant: number;
    let remark: string;

    if (body.packageId) {
      const pkg = await this.prisma.points_packages.findUnique({ where: { id: body.packageId } });
      if (!pkg) throw new BadRequestException('积分包不存在');
      pointsToGrant = pkg.points;
      remark = body.remark || `管理员授予积分包: ${pkg.name}`;
    } else if (body.points && body.points > 0) {
      pointsToGrant = body.points;
      remark = body.remark || '管理员手动授予积分';
    } else {
      throw new BadRequestException('请提供 points 或 packageId');
    }

    this.audit(user, 'users.grant_points', {
      userId,
      points: pointsToGrant,
      packageId: body.packageId,
    });

    const current = await this.prisma.$transaction(async (tx) => {
      const grantType = body.packageId ? PointGrantType.PURCHASED : PointGrantType.COMPENSATION;
      const result = await this.pointsService.grantPointsWithinTx(tx, userId, {
        amount: pointsToGrant,
        grantType,
        sourceEvent: PointLedgerEventType.admin_adjustment,
        source: PointsSource.ADMIN_GRANT,
        remark,
      });

      return { balance: result.balance };
    });

    return { message: '授予成功', balance: current.balance };
  }

  private audit(user: AuthUser, action: string, payload: Record<string, unknown>) {
    const actorId = getCurrentUserId(user);
    const at = new Date().toISOString();
    this.auditLogger.log(
      JSON.stringify({
        action,
        actorId,
        at,
        payload,
      }),
    );
    this.auditStore.record({ action, actorId, at, payload });
  }
}
