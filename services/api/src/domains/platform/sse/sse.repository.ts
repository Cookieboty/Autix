import { Injectable } from '@nestjs/common';
import { Prisma } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import type { TaskEventPayload } from './sse.service';

@Injectable()
export class SseRepository {
  constructor(private readonly prisma: PrismaService) {}

  createTaskEvent(userId: string, event: TaskEventPayload): Promise<unknown> {
    return this.prisma.task_events.create({
      data: {
        id: event.id,
        userId,
        taskType: event.taskType,
        taskId: event.taskId,
        status: event.status,
        message: event.message ?? undefined,
        metadata: (event.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        createdAt: new Date(event.createdAt),
      },
    });
  }

  deleteTaskEventsOlderThan(cutoff: Date, limit = 10000): Promise<number> {
    return this.prisma.$executeRaw`
      DELETE FROM task_events
      WHERE id IN (
        SELECT id FROM task_events
        WHERE "createdAt" < ${cutoff}
        LIMIT ${limit}
      )
    `;
  }
}
