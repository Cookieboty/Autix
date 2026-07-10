import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../platform/prisma/prisma.module';
import { PricingConfigAdminRepository } from './pricing-config-admin.repository';
import { PricingConfigAdminService } from './pricing-config-admin.service';
import { PricingConfigAdminController } from './pricing-config-admin.controller';

/**
 * Leaf module: only depends on PrismaModule. Deliberately does not import Auth/Campaign/Points/
 * Membership/Order (the known 5-module DI cycle) — AdminModule already imports this module, not
 * the other way around, so it cannot introduce a new cycle.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PricingConfigAdminController],
  providers: [PricingConfigAdminRepository, PricingConfigAdminService],
  exports: [PricingConfigAdminService],
})
export class PricingConfigAdminModule {}
