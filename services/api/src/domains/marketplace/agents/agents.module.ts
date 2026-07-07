import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { CommonModule } from '../../platform/common/common.module';
import { ResourceMetricsModule } from '../../platform/resource-metrics/resource-metrics.module';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';
import { AgentsService } from './agents.service';
import { AgentsController, AgentsAdminController } from './agents.controller';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule, ResourceMetricsModule],
  controllers: [AgentsController, AgentsAdminController],
  providers: [AgentsService, MarketplaceResourceCrudRepository],
  exports: [AgentsService],
})
export class AgentsModule {}
