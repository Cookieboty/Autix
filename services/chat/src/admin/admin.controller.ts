import {
  Controller,
  Get,
  Post,
  Put,
  Req,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UserRpcService } from '../auth/user-rpc.service';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private userRpc: UserRpcService,
  ) {}

  // ── Membership Levels ─────────────────────────────────────────────

  @Get('membership/levels')
  async getMembershipLevels() {
    return this.prisma.membership_levels.findMany({
      include: { plans: true },
      orderBy: { sort: 'asc' },
    });
  }

  @Post('membership/levels')
  async createMembershipLevel(@Body() body: any) {
    return this.prisma.membership_levels.create({ data: body });
  }

  @Put('membership/levels/:id')
  async updateMembershipLevel(@Param('id') id: string, @Body() body: any) {
    return this.prisma.membership_levels.update({ where: { id }, data: body });
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
  async createMembershipPlan(@Body() body: any) {
    return this.prisma.membership_plans.create({ data: body });
  }

  @Put('membership/plans/:id')
  async updateMembershipPlan(@Param('id') id: string, @Body() body: any) {
    return this.prisma.membership_plans.update({ where: { id }, data: body });
  }

  // ── Points Packages ───────────────────────────────────────────────

  @Get('points/packages')
  async getPointsPackages() {
    return this.prisma.points_packages.findMany({ orderBy: { sort: 'asc' } });
  }

  @Post('points/packages')
  async createPointsPackage(@Body() body: any) {
    return this.prisma.points_packages.create({ data: body });
  }

  @Put('points/packages/:id')
  async updatePointsPackage(@Param('id') id: string, @Body() body: any) {
    return this.prisma.points_packages.update({ where: { id }, data: body });
  }

  // ── Task Point Costs ──────────────────────────────────────────────

  @Get('points/task-costs')
  async getTaskCosts() {
    return this.prisma.task_point_costs.findMany({ orderBy: { taskType: 'asc' } });
  }

  @Post('points/task-costs')
  async createTaskCost(@Body() body: any) {
    return this.prisma.task_point_costs.create({ data: body });
  }

  @Put('points/task-costs/:id')
  async updateTaskCost(@Param('id') id: string, @Body() body: any) {
    return this.prisma.task_point_costs.update({ where: { id }, data: body });
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

    const rpcResult = await this.userRpc.listUsers(p, ps, search);

    const enriched = await Promise.all(
      rpcResult.users.map(async (u) => {
        const [membership, points] = await Promise.all([
          this.prisma.user_memberships.findUnique({
            where: { userId: u.userId },
            include: { level: true },
          }),
          this.prisma.user_points.findUnique({ where: { userId: u.userId } }),
        ]);
        return {
          id: u.userId,
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
      total: rpcResult.total,
      page: p,
      pageSize: ps,
      hasMore: p * ps < rpcResult.total,
    };
  }

  @Get('users/:userId')
  async getUserDetail(@Param('userId') userId: string) {
    const [userInfo, membership, points, recentRecords, recentOrders] =
      await Promise.all([
        this.userRpc.getUserInfo(userId),
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

  @Post('users/:userId/approve')
  async approveUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { note?: string },
  ) {
    const adminUserId = req.user.userId;
    const result = await this.userRpc.approveUser(userId, adminUserId, body.note);
    if (!result.success) {
      throw new BadRequestException(result.message);
    }
    return result;
  }

  @Post('users/:userId/grant-membership')
  async grantMembership(
    @Param('userId') userId: string,
    @Body() body: { levelId: string; months?: number },
  ) {
    const { levelId, months = 1 } = body;

    const level = await this.prisma.membership_levels.findUnique({ where: { id: levelId } });
    if (!level) throw new BadRequestException('会员等级不存在');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    const totalPoints = level.pointsPerMonth * months;

    await this.prisma.$transaction(async (tx) => {
      await tx.user_memberships.upsert({
        where: { userId },
        update: { levelId, startedAt: now, expiresAt, status: 'ACTIVE' },
        create: { userId, levelId, startedAt: now, expiresAt, status: 'ACTIVE' },
      });

      const current = await tx.user_points.upsert({
        where: { userId },
        update: { balance: { increment: totalPoints } },
        create: { userId, balance: totalPoints },
      });

      await tx.points_records.create({
        data: {
          userId,
          type: 'EARN',
          amount: totalPoints,
          source: 'ADMIN_GRANT',
          balance: current.balance,
          remark: `管理员授予 ${level.name} ${months}个月`,
        },
      });
    });

    return { message: '授予成功' };
  }

  @Post('users/:userId/grant-points')
  async grantPoints(
    @Param('userId') userId: string,
    @Body() body: { points?: number; remark?: string; packageId?: string },
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

    const current = await this.prisma.$transaction(async (tx) => {
      const up = await tx.user_points.upsert({
        where: { userId },
        update: { balance: { increment: pointsToGrant } },
        create: { userId, balance: pointsToGrant },
      });

      await tx.points_records.create({
        data: {
          userId,
          type: 'EARN',
          amount: pointsToGrant,
          source: 'ADMIN_GRANT',
          balance: up.balance,
          remark,
        },
      });

      return up;
    });

    return { message: '授予成功', balance: current.balance };
  }
}
