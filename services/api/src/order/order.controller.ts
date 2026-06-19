import { Body, Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../auth/decorators/current-user.decorator';
import { OrderService } from './order.service';
import { OrderType } from '../prisma/generated';
import { StripePaymentService } from './stripe-payment.service';
import type { AuthUser } from '@autix/types';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly stripePaymentService: StripePaymentService,
  ) {}

  @Get()
  async getUserOrders(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('orderType') orderType?: OrderType,
  ) {
    const userId = getCurrentUserId(user);
    return this.orderService.getUserOrders(userId, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      status,
      orderType,
    });
  }

  @Post('checkout/stripe')
  async createStripeCheckout(
    @CurrentUser() user: AuthUser,
    @Body() body: { orderType: OrderType; productId: string },
  ) {
    const userId = getCurrentUserId(user);
    return this.stripePaymentService.createCheckout(userId, body);
  }

  @Get(':id')
  async getOrderById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.orderService.getOrderById(id, userId);
  }

  @Post(':id/checkout/stripe')
  async createStripeCheckoutForOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.stripePaymentService.createCheckoutForExistingOrder(userId, id);
  }

  @Post(':id/cancel')
  async cancelOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.orderService.cancelOrder(id, userId);
  }
}
