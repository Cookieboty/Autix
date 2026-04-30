import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { MembershipModule } from '../membership/membership.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';

@Module({
  imports: [PrismaModule, AuthModule, PointsModule, forwardRef(() => MembershipModule)],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
