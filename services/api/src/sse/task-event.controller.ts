import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../auth/decorators/current-user.decorator';
import { TaskHistoryQueryDto } from './dto/task-history.query.dto';
import { TaskHistoryResponseDto } from './dto/task-event.response.dto';
import { TaskEventService } from './task-event.service';
import type { AuthUser } from '@autix/types';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskEventController {
  constructor(private readonly taskEventService: TaskEventService) {}

  @Get('history')
  async getHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: TaskHistoryQueryDto,
  ): Promise<TaskHistoryResponseDto> {
    const userId = getCurrentUserId(user);
    return this.taskEventService.getHistory(userId, query);
  }

  @Get(':taskId')
  async getByTaskId(@CurrentUser() user: AuthUser, @Param('taskId') taskId: string) {
    const userId = getCurrentUserId(user);
    return this.taskEventService.getByTaskId(userId, taskId);
  }

  @Patch(':taskId/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@CurrentUser() user: AuthUser, @Param('taskId') taskId: string) {
    const userId = getCurrentUserId(user);
    return this.taskEventService.markRead(userId, taskId);
  }
}
