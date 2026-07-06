import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { ResourceMetricsRepository } from './resource-metrics.repository';
import { ResourceMetricsService } from './resource-metrics.service';
import { ResourceMetricsController } from './resource-metrics.controller';
import { ResourceViewPipelineService } from './resource-view.pipeline';
import { TelemetryController } from './telemetry.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ResourceMetricsController, TelemetryController],
  providers: [
    ResourceMetricsRepository,
    ResourceMetricsService,
    ResourceViewPipelineService,
  ],
  exports: [ResourceMetricsService, ResourceViewPipelineService],
})
export class ResourceMetricsModule {}
