import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationService } from '../registration/registration.service';
import { BatchJobService } from './batch-job.service';
import { PointsService } from '../points/points.service';
import { OrderService } from '../order/order.service';
import { PointGrantType, PointLedgerEventType, PointsSource } from '../prisma/generated';
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
import type { AuthUser } from '@autix/types';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  // P1-3: 基础操作审计，先以结构化日志落地，后续如果接入 audit 表可平滑迁移。
  private readonly auditLogger = new Logger('AdminAudit');

  constructor(
    private prisma: PrismaService,
    private registrationService: RegistrationService,
    private batchJobService: BatchJobService,
    private pointsService: PointsService,
    private orderService: OrderService,
    private auditStore: AdminAuditStore,
  ) { }

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
    // P2-A2: 同步写入内存 ring buffer，便于通过 GET /admin/audit-logs 查询
    this.auditStore.record({ action, actorId, at, payload });
  }

  // P2-A2: 查询近期 admin 操作审计（来自内存 ring buffer，仅近 N 条）
  @Get('audit-logs')
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit = '50',
    @Query('cursor') cursor?: string,
  ) {
    return this.auditStore.query({
      action,
      actorId,
      limit: parseInt(limit, 10) || 50,
      cursor: cursor ? parseInt(cursor, 10) || undefined : undefined,
    });
  }


  // ── Batch Jobs ────────────────────────────────────────────────────

  @Get('batch-jobs')
  async listBatchJobs(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const userId = getCurrentUserId(user);
    return this.batchJobService.listJobs(
      userId,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
  }

  @Get('batch-jobs/:id')
  async getBatchJob(@Param('id') id: string) {
    return this.batchJobService.getJob(id);
  }

  // ── Membership Levels ─────────────────────────────────────────────

  @Get('membership/levels')
  async getMembershipLevels() {
    return this.prisma.membership_levels.findMany({
      include: { plans: true },
      orderBy: { sort: 'asc' },
    });
  }

  @Post('membership/levels')
  async createMembershipLevel(
    @CurrentUser() user: AuthUser,
    @Body() body: UpsertMembershipLevelDto,
  ) {
    this.audit(user, 'membership_levels.create', { name: body.name, level: body.level });
    return this.prisma.membership_levels.create({ data: body as any });
  }

  @Put('membership/levels/:id')
  async updateMembershipLevel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpsertMembershipLevelDto,
  ) {
    this.audit(user, 'membership_levels.update', { id });
    return this.prisma.membership_levels.update({ where: { id }, data: body as any });
  }

  // ── Membership Plans ──────────────────────────────────────────────

  @Get('membership/plans')
  async getMembershipPlans() {
    return this.prisma.membership_plans.findMany({
      include: { level: true },
      orderBy: { sort: 'asc' },
    });
  }

  @Post('membership/plans')
  async createMembershipPlan(
    @CurrentUser() user: AuthUser,
    @Body() body: UpsertMembershipPlanDto,
  ) {
    this.audit(user, 'membership_plans.create', {
      levelId: body.levelId,
      durationMonths: body.durationMonths,
      price: body.price,
    });
    return this.prisma.membership_plans.create({ data: body as any });
  }

  @Put('membership/plans/:id')
  async updateMembershipPlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpsertMembershipPlanDto,
  ) {
    this.audit(user, 'membership_plans.update', { id });
    return this.prisma.membership_plans.update({ where: { id }, data: body as any });
  }

  // ── Points Packages ───────────────────────────────────────────────

  @Get('points/packages')
  async getPointsPackages() {
    return this.prisma.points_packages.findMany({ orderBy: { sort: 'asc' } });
  }

  @Post('points/packages')
  async createPointsPackage(
    @CurrentUser() user: AuthUser,
    @Body() body: UpsertPointsPackageDto,
  ) {
    this.audit(user, 'points_packages.create', { name: body.name, points: body.points });
    return this.prisma.points_packages.create({ data: body as any });
  }

  @Put('points/packages/:id')
  async updatePointsPackage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpsertPointsPackageDto,
  ) {
    this.audit(user, 'points_packages.update', { id });
    return this.prisma.points_packages.update({ where: { id }, data: body as any });
  }

  // ── Generation Pricing Rules ─────────────────────────────────────

  @Get('points/pricing-rules')
  async getPricingRules() {
    return this.prisma.generation_pricing_rules.findMany({
      orderBy: [{ taskType: 'asc' }, { name: 'asc' }],
    });
  }

  @Post('points/pricing-rules')
  async createPricingRule(
    @CurrentUser() user: AuthUser,
    @Body() body: UpsertPricingRuleDto,
  ) {
    this.audit(user, 'generation_pricing_rules.create', {
      taskType: body.taskType,
      name: body.name,
      baseCost: body.baseCost,
    });
    return this.prisma.generation_pricing_rules.create({ data: body as any });
  }

  @Put('points/pricing-rules/:id')
  async updatePricingRule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpsertPricingRuleDto,
  ) {
    this.audit(user, 'generation_pricing_rules.update', { id, baseCost: body.baseCost });
    return this.prisma.generation_pricing_rules.update({ where: { id }, data: body as any });
  }

  @Post('points/pricing-rules/preview')
  async previewPricingRule(@Body() body: PreviewPricingRuleInputDto) {
    // P2-B: 走 previewPricingRule 返回 estimate + metaCheck warnings，便于运营在保存前发现规则问题
    return this.pointsService.previewPricingRule(body as any);
  }

  // ── Orders ────────────────────────────────────────────────────────

  @Get('orders')
  async getOrders(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('orderType') orderType?: string,
  ) {
    const p = parseInt(page, 10) || 1;
    const ps = parseInt(pageSize, 10) || 20;
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (orderType) where.orderType = orderType;

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

  @Post('orders/:id/fulfill')
  async fulfillOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: FulfillOrderDto = {},
  ) {
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

  @Post('orders/:id/refund')
  async refundOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: RefundOrderDto = {},
  ) {
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

  // ── Points Records ────────────────────────────────────────────────

  @Get('points/records')
  async getPointsRecords(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('userId') userId?: string,
    @Query('source') source?: string,
  ) {
    const p = parseInt(page, 10) || 1;
    const ps = parseInt(pageSize, 10) || 20;
    const where: any = {};
    if (userId) where.userId = userId;
    if (source) where.source = source;

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

  // ── User Management ───────────────────────────────────────────────

  @Get('users')
  async getUsers(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('search') search = '',
  ) {
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

  @Get('users/:userId')
  async getUserDetail(@Param('userId') userId: string) {
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

  // P2-A1: 用户积分详情聚合接口，便于后台一屏看到 账户 / 在用批次 / 冻结中 / 近期流水。
  // 仅消费现有表，不引入 migration；分页用 query 控制 grants/holds/records 各自 take。
  @Get('users/:userId/points-detail')
  async getUserPointsDetail(
    @Param('userId') userId: string,
    @Query('grantTake') grantTake = '50',
    @Query('holdTake') holdTake = '20',
    @Query('recordTake') recordTake = '50',
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

  @Post('users/:userId/approve')
  async approveUser(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() body: ApproveUserDto,
  ) {
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

  @Post('users/:userId/grant-membership')
  async grantMembership(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() body: GrantMembershipDto,
  ) {
    const { levelId, months = 1 } = body;

    const level = await this.prisma.membership_levels.findUnique({ where: { id: levelId } });
    if (!level) throw new BadRequestException('会员等级不存在');

    const now = new Date();
    // P1-5: 复用 OrderService.addMonths 进行自然月对齐推进，避免按 30 天近似带来的偏差
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

  @Post('users/:userId/grant-points')
  async grantPoints(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() body: GrantPointsDto,
  ) {
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
}
