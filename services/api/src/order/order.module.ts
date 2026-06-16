import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { StripePaymentService } from './stripe-payment.service';

@Module({
  imports: [PrismaModule, AuthModule, PointsModule],
  controllers: [OrderController, PaymentWebhookController],
  providers: [OrderService, StripePaymentService],
  exports: [OrderService, StripePaymentService],
})
export class OrderModule {}
