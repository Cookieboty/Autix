import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderService } from './order.service';

@Injectable()
export class OrderTimeoutService {
  private readonly logger = new Logger(OrderTimeoutService.name);

  constructor(private readonly orderService: OrderService) {}

  @Cron('* * * * *')
  async cancelExpiredPendingOrders() {
    try {
      const cancelled = await this.orderService.cancelExpiredPendingOrders();
      if (cancelled > 0) {
        this.logger.log(`cancelled expired pending orders: ${cancelled}`);
      }
    } catch (error) {
      this.logger.error('cancel expired pending orders failed', error);
    }
  }
}
