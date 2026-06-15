import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MembershipModule } from '../membership/membership.module';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => MembershipModule)],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
