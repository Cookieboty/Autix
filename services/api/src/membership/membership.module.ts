import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { PointsModule } from '../points/points.module';
import { MembershipCycleService } from './membership-cycle.service';

@Module({
  imports: [PrismaModule, AuthModule, PointsModule],
  controllers: [MembershipController],
  providers: [MembershipService, MembershipCycleService],
  exports: [MembershipService, MembershipCycleService],
})
export class MembershipModule {}
