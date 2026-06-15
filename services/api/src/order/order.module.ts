import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PaymentWebhookController } from './payment-webhook.controller';

@Module({
  imports: [PrismaModule, AuthModule, PointsModule],
  controllers: [OrderController, PaymentWebhookController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
