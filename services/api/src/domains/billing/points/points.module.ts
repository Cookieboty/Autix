import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { PointsRepository } from './repositories/points.repository';
import { PricingRuleRepository } from './repositories/pricing-rule.repository';
import { PointsLedgerService } from './services/points-ledger.service';
import { PointsHoldService } from './services/points-hold.service';
import { PricingEstimatorService } from './services/pricing-estimator.service';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PointsController],
  providers: [
    PointsRepository,
    PricingRuleRepository,
    PointsLedgerService,
    PointsHoldService,
    PricingEstimatorService,
    PointsService,
  ],
  exports: [PointsService],
})
export class PointsModule {}
