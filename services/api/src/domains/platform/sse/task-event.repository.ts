import { Injectable } from '@nestjs/common';
import { Prisma } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';

export type TaskEventRow = {
  id: string;
  taskType: string;
  taskId: string;
  status: string;
  message: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  readAt: Date | null;
};

@Injectable()
export class TaskEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  findHistory(input: {
    where: Prisma.task_eventsWhereInput;
    skip: number;
    take: number;
  }): Promise<[TaskEventRow[], number]> {
    return Promise.all([
      this.prisma.task_events.findMany({
        where: input.where,
        orderBy: { createdAt: 'desc' },
        skip: input.skip,
        take: input.take,
      }),
      this.prisma.task_events.count({ where: input.where }),
    ]);
  }

  findLatestByTaskId(
    userId: string,
    taskId: string,
  ): Promise<TaskEventRow | null> {
    return this.prisma.task_events.findFirst({
      where: { taskId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  markUnreadTaskEventsRead(
    userId: string,
    taskId: string,
    readAt: Date,
  ): Promise<{ count: number }> {
    return this.prisma.task_events.updateMany({
      where: { taskId, userId, readAt: null },
      data: { readAt },
    });
  }
}
