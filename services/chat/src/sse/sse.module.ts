import { Module } from '@nestjs/common';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { TaskEventController } from './task-event.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SseService],
  controllers: [SseController, TaskEventController],
  exports: [SseService],
})
export class SseModule {}