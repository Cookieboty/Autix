import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../prisma/generated';
import { I18nHttpException } from '../i18n/i18n-http.exception';
import { TaskHistoryQueryDto } from './dto/task-history.query.dto';
import { TaskEventResponseDto, TaskHistoryResponseDto } from './dto/task-event.response.dto';
import { TaskEventRepository, TaskEventRow } from './task-event.repository';

@Injectable()
export class TaskEventService {
  constructor(private readonly repository: TaskEventRepository) {}

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

    const [items, total] = await this.repository.findHistory({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((event) => this.toResponse(event)),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async getByTaskId(userId: string, taskId: string): Promise<TaskEventResponseDto> {
    const event = await this.repository.findLatestByTaskId(userId, taskId);

    if (!event) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'task.not_found');
    }

    return this.toResponse(event);
  }

  async markRead(userId: string, taskId: string) {
    const readAt = new Date();
    const updated = await this.repository.markUnreadTaskEventsRead(
      userId,
      taskId,
      readAt,
    );
    if (updated.count === 0) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'task.already_read');
    }
    return { readAt: readAt.toISOString() };
  }

  private toResponse(event: TaskEventRow): TaskEventResponseDto {
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
