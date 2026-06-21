import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { PointsModule } from '../points/points.module';
import { OrderRepository } from './repositories/order.repository';
import { PaymentEventRepository } from './repositories/payment-event.repository';
import { OrderCreationService } from './services/order-creation.service';
import { OrderFulfillmentService } from './services/order-fulfillment.service';
import { OrderPointReclaimService } from './services/order-point-reclaim.service';
import { OrderRefundService } from './services/order-refund.service';
import { OrderService } from './order.service';
import { OrderTimeoutService } from './order-timeout.service';
import { OrderController } from './order.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { StripePaymentService } from './stripe-payment.service';

@Module({
  imports: [PrismaModule, AuthModule, PointsModule],
  controllers: [OrderController, PaymentWebhookController],
  providers: [
    OrderRepository,
    PaymentEventRepository,
    OrderCreationService,
    OrderFulfillmentService,
    OrderPointReclaimService,
    OrderRefundService,
    OrderService,
    OrderTimeoutService,
    StripePaymentService,
  ],
  exports: [OrderService, StripePaymentService],
})
export class OrderModule {}
