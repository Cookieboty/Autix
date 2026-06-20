import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { PointsModule } from '../points/points.module';
import { MembershipCycleService } from './membership-cycle.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), forwardRef(() => PointsModule)],
  controllers: [MembershipController],
  providers: [MembershipService, MembershipCycleService],
  exports: [MembershipService, MembershipCycleService],
})
export class MembershipModule {}
