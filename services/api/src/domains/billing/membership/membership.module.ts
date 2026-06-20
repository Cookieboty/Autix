import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { PointsModule } from '../points/points.module';
import { MembershipCycleService } from './membership-cycle.service';
import { MembershipRepository } from './membership.repository';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), forwardRef(() => PointsModule)],
  controllers: [MembershipController],
  providers: [MembershipService, MembershipCycleService, MembershipRepository],
  exports: [MembershipService, MembershipCycleService],
})
export class MembershipModule {}
