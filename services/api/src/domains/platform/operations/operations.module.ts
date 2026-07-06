import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { FeaturedSlotsAdminController } from './featured-slots-admin.controller';
import { FeaturedSlotsController } from './featured-slots.controller';
import { FeaturedSlotsRepository } from './featured-slots.repository';
import { FeaturedSlotsService } from './featured-slots.service';
import { BoostAdminController } from './boost-admin.controller';
import { BoostRepository } from './boost.repository';
import { BoostService } from './boost.service';
import { BoostCron } from './boost.cron';

/**
 * 运营配置域模块：运营位编排（Featured Slots，§十）+ 内容加热（Boost，§十一）。
 * 见 gallery-design.md §5.5 / §十 / §十一。
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    FeaturedSlotsController,
    FeaturedSlotsAdminController,
    BoostAdminController,
  ],
  providers: [
    FeaturedSlotsRepository,
    FeaturedSlotsService,
    BoostRepository,
    BoostService,
    BoostCron,
  ],
  exports: [FeaturedSlotsService, BoostService],
})
export class OperationsModule {}
