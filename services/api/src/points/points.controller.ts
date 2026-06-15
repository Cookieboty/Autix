import { Body, Controller, Get, Post, Param, Query, Req, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PointsService } from './points.service';
import { MembershipService } from '../membership/membership.service';
import { PrismaService } from '../prisma/prisma.service';
import { PointsSource, OrderType } from '../prisma/generated';

@UseGuards(JwtAuthGuard)
@Controller('points')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly membershipService: MembershipService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('balance')
  async getBalance(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.pointsService.getBalance(userId);
  }

  @Get('summary')
  async getSummary(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.pointsService.getAccountSummary(userId);
  }

  @Get('records')
  async getRecords(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('source') source?: PointsSource,
  ) {
    const userId = (req.user as any).userId;
    return this.pointsService.getRecords(userId, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      source,
    });
  }

  @Get('packages')
  async getPackages() {
    return this.pointsService.getPackages();
  }

  @Post('packages/:id/purchase')
  async purchasePackage(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;

    const { membership } = await this.membershipService.getUserMembership(userId);
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.expiresAt <= new Date()
    ) {
      throw new ForbiddenException('购买积分包需要先开通会员，请先订阅会员套餐');
    }

    const pkg = await this.pointsService.getPackageById(id);
    if (!pkg) throw new NotFoundException('积分包不存在');

    const orderNo = `ORD${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    return this.prisma.orders.create({
      data: {
        userId,
        orderNo,
        orderType: OrderType.POINTS_PACKAGE,
        businessType: 'points_order',
        productId: pkg.id,
        productName: pkg.name,
        originalPrice: pkg.price,
        amount: pkg.price,
        isFirstTime: false,
        status: 'PENDING',
      },
    });
  }

  @Get('pricing-rules')
  async getPricingRules() {
    return this.pointsService.getPricingRules();
  }

  @Post('estimate')
  async estimateCost(@Body() body: any) {
    return this.pointsService.estimateCost(body);
  }
}
