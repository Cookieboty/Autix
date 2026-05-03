import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RuntimeDetectorService } from './runtime-detector.service';

@Module({
  imports: [PrismaModule],
  providers: [RuntimeDetectorService],
  exports: [RuntimeDetectorService],
})
export class CommonModule {}
