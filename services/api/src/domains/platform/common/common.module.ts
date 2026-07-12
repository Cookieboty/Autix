import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RuntimeDetectorService } from './runtime-detector.service';
import { RuntimeDetectorRepository } from './runtime-detector.repository';
import { ResourceInteractionRepository } from './resource-interaction.repository';
import { RateLimitService } from './rate-limit.service';
import { RateLimitRepository } from './rate-limit.repository';
import { RateLimitCleanupCron } from './rate-limit-cleanup.cron';

@Module({
  imports: [PrismaModule],
  providers: [
    RuntimeDetectorService,
    RuntimeDetectorRepository,
    ResourceInteractionRepository,
    RateLimitRepository,
    RateLimitService,
    RateLimitCleanupCron,
  ],
  exports: [RuntimeDetectorService, ResourceInteractionRepository, RateLimitService],
})
export class CommonModule {}
