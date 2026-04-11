import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TaskHistoryQueryDto, TaskHistoryResponseDto } from './dto/task-history.query.dto';

@Controller('api/tasks')
@UseGuards(JwtAuthGuard)
export class TaskEventController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('history')
  async getHistory(
    @Req() req: Request,
    @Query() query: TaskHistoryQueryDto,
  ): Promise<TaskHistoryResponseDto> {
    const userId = (req.user as any).userId;
    const { page = 1, pageSize = 20, taskType, startDate, endDate } = query;

    // 默认时间范围：最近 30 天
    const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const effectiveStart = startDate ?? defaultStart;
    const effectiveEnd = endDate ?? new Date().toISOString();

    const where: any = {
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
      this.prisma.taskEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.taskEvent.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        id: e.id,
        taskType: e.taskType,
        taskId: e.taskId,
        status: e.status,
        message: e.message ?? undefined,
        metadata: e.metadata ?? undefined,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  @Get(':taskId')
  async getByTaskId(@Req() req: Request, @Param('taskId') taskId: string) {
    const userId = (req.user as any).userId;

    const event = await this.prisma.taskEvent.findFirst({
      where: { taskId, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!event) {
      throw new NotFoundException('任务不存在');
    }

    return {
      id: event.id,
      taskType: event.taskType,
      taskId: event.taskId,
      status: event.status,
      message: event.message ?? undefined,
      metadata: event.metadata ?? undefined,
      createdAt: event.createdAt.toISOString(),
    };
  }

  @Patch(':taskId/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@Req() req: Request, @Param('taskId') taskId: string) {
    const userId = (req.user as any).userId;
    const updated = await this.prisma.taskEvent.updateMany({
      where: { taskId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      throw new NotFoundException('任务不存在或已读');
    }
    return { readAt: new Date().toISOString() };
  }
}