import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { TaskHistoryQueryDto } from './dto/task-history.query.dto';
import { TaskEventResponseDto, TaskHistoryResponseDto } from './dto/task-event.response.dto';

@Injectable()
export class TaskEventService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(
    userId: string,
    query: TaskHistoryQueryDto,
  ): Promise<TaskHistoryResponseDto> {
    const { page = 1, pageSize = 20, taskType, startDate, endDate } = query;

    const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const effectiveStart = startDate ?? defaultStart;
    const effectiveEnd = endDate ?? new Date().toISOString();

    const where: Prisma.task_eventsWhereInput = {
      userId,
      createdAt: {
        gte: effectiveStart,
        lte: effectiveEnd,
      },
    };
    if (taskType) {
      where.taskType = taskType;
    }

    const [items, total] = await Promise.all([
      this.prisma.task_events.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task_events.count({ where }),
    ]);

    return {
      items: items.map((event) => this.toResponse(event)),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async getByTaskId(userId: string, taskId: string): Promise<TaskEventResponseDto> {
    const event = await this.prisma.task_events.findFirst({
      where: { taskId, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!event) {
      throw new NotFoundException('任务不存在');
    }

    return this.toResponse(event);
  }

  async markRead(userId: string, taskId: string) {
    const updated = await this.prisma.task_events.updateMany({
      where: { taskId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      throw new NotFoundException('任务不存在或已读');
    }
    return { readAt: new Date().toISOString() };
  }

  private toResponse(event: {
    id: string;
    taskType: string;
    taskId: string;
    status: string;
    message: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    readAt: Date | null;
  }): TaskEventResponseDto {
    return {
      id: event.id,
      taskType: event.taskType,
      taskId: event.taskId,
      status: event.status as TaskEventResponseDto['status'],
      message: event.message ?? undefined,
      metadata: (event.metadata as Record<string, unknown>) ?? undefined,
      createdAt: event.createdAt.toISOString(),
      readAt: event.readAt?.toISOString() ?? undefined,
    };
  }
}
