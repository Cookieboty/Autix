import { Module } from '@nestjs/common';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { TaskEventController } from './task-event.controller';
import { TaskEventService } from './task-event.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SseService, TaskEventService],
  controllers: [SseController, TaskEventController],
  exports: [SseService, TaskEventService],
})
export class SseModule {}
