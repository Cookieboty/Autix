import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService } from './order.service';
import { MembershipService } from '../membership/membership.service';
import { PointsService } from '../points/points.service';
import { OrderType } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('api/orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly membershipService: MembershipService,
    private readonly pointsService: PointsService,
  ) {}

  @Get()
  async getUserOrders(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('orderType') orderType?: OrderType,
  ) {
    const userId = (req.user as any).userId;
    return this.orderService.getUserOrders(userId, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      status,
      orderType,
    });
  }

  @Get(':id')
  async getOrderById(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    return this.orderService.getOrderById(id, userId);
  }

  @Post(':id/pay')
  async payOrder(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    const order = await this.orderService.payOrder(id, userId);

    if (order.orderType === OrderType.MEMBERSHIP) {
      const { pointsToGrant } = await this.membershipService.fulfillMembershipOrder(order.id, userId);
      if (pointsToGrant > 0) {
        await this.pointsService.addPoints(userId, pointsToGrant, 'MEMBERSHIP', order.id, `会员购买赠送 ${pointsToGrant} 积分`);
      }
    } else if (order.orderType === OrderType.POINTS_PACKAGE) {
      const pkg = await this.pointsService.getPackageById(order.productId);
      if (pkg) {
        await this.pointsService.addPoints(userId, pkg.points, 'PACKAGE', order.id, `购买${pkg.name}`);
      }
    }

    return order;
  }

  @Post(':id/cancel')
  async cancelOrder(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    return this.orderService.cancelOrder(id, userId);
  }
}
