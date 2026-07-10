import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { PointsRepository } from './repositories/points.repository';
import { PricingRuleRepository } from './repositories/pricing-rule.repository';
import { TaskPricingRepository } from './repositories/task-pricing.repository';
import { PointsLedgerService } from './services/points-ledger.service';
import { PointsHoldService } from './services/points-hold.service';
import { PointsHoldReclaimCron } from './services/points-hold-reclaim.cron';
import { PricingEstimatorService } from './services/pricing-estimator.service';
import { TaskPricingEstimatorService } from './services/task-pricing-estimator.service';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PointsController],
  providers: [
    PointsRepository,
    PricingRuleRepository,
    TaskPricingRepository,
    PointsLedgerService,
    PointsHoldService,
    PointsHoldReclaimCron,
    PricingEstimatorService,
    TaskPricingEstimatorService,
    PointsService,
  ],
  // TaskPricingRepository is exported (not just PointsService) so TasksModule can
  // reuse this module's registration instead of standing up a second instance —
  // see tasks.module.ts for why TasksController/TasksService live in a sibling
  // module rather than here: PointsModule sits inside an existing
  // AuthModule -> CampaignModule -> PointsModule <-> MembershipModule -> OrderModule
  // -> AuthModule cycle (all forwardRef'd already); adding a PointsModule ->
  // MembershipModule edge here — even forwardRef'd — turns that into a 5-module
  // cycle Nest's scanner cannot unwind (verified empirically: `nest start` throws
  // `UndefinedModuleException` on OrderModule's AuthModule import). TasksModule is
  // a new leaf only BillingDomainModule imports, so it can depend on both
  // PointsModule and MembershipModule with plain imports and no forwardRef at all.
  exports: [PointsService, TaskPricingRepository],
})
export class PointsModule {}
