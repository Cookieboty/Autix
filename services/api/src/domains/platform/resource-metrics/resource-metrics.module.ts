import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { ResourceMetricsRepository } from './resource-metrics.repository';
import { ResourceMetricsService } from './resource-metrics.service';
import { ResourceMetricsController } from './resource-metrics.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ResourceMetricsController],
  providers: [ResourceMetricsRepository, ResourceMetricsService],
  exports: [ResourceMetricsService],
})
export class ResourceMetricsModule {}
