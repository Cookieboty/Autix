import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RuntimeDetectorService } from './runtime-detector.service';
import { RuntimeDetectorRepository } from './runtime-detector.repository';
import { ResourceInteractionRepository } from './resource-interaction.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    RuntimeDetectorService,
    RuntimeDetectorRepository,
    ResourceInteractionRepository,
  ],
  exports: [RuntimeDetectorService, ResourceInteractionRepository],
})
export class CommonModule {}
