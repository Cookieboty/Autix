import { Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { PointsModule } from './points.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

/**
 * Deliberately a sibling of PointsModule, not a member of it. TasksController
 * needs both PointsService (quote) and MembershipService (resolving the caller's
 * discount-eligible membership level for both GET /models and POST /quote).
 * PointsModule already sits inside an existing forwardRef'd cycle with
 * MembershipModule (via OrderModule/AuthModule/CampaignModule) — adding a
 * PointsModule -> MembershipModule edge there turns that into a 5-module cycle
 * Nest's scanner cannot unwind, forwardRef or not (see points.module.ts). Nothing
 * inside that cycle imports TasksModule — only BillingDomainModule does — so
 * TasksModule can import both PointsModule and MembershipModule as plain imports
 * with no forwardRef needed.
 */
@Module({
  imports: [PointsModule, MembershipModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
