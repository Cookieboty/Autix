import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { FeaturedSlotsAdminController } from './featured-slots-admin.controller';
import { FeaturedSlotsController } from './featured-slots.controller';
import { FeaturedSlotsRepository } from './featured-slots.repository';
import { FeaturedSlotsService } from './featured-slots.service';

/** 运营位编排（Featured Slots）域模块。见 gallery-design.md §5.5 / §十。 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FeaturedSlotsController, FeaturedSlotsAdminController],
  providers: [FeaturedSlotsRepository, FeaturedSlotsService],
  exports: [FeaturedSlotsService],
})
export class OperationsModule {}
