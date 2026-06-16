import { Body, Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService } from './order.service';
import { OrderType } from '../prisma/generated';
import { StripePaymentService } from './stripe-payment.service';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly stripePaymentService: StripePaymentService,
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

  @Post('checkout/stripe')
  async createStripeCheckout(
    @Req() req: Request,
    @Body() body: { orderType: OrderType; productId: string },
  ) {
    const userId = (req.user as any).userId;
    return this.stripePaymentService.createCheckout(userId, body);
  }

  @Get(':id')
  async getOrderById(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    return this.orderService.getOrderById(id, userId);
  }

  @Post(':id/checkout/stripe')
  async createStripeCheckoutForOrder(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    return this.stripePaymentService.createCheckoutForExistingOrder(userId, id);
  }

  @Post(':id/cancel')
  async cancelOrder(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    return this.orderService.cancelOrder(id, userId);
  }
}
