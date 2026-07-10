import { Body, Controller, Get, Headers, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { OptionalCurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { Public } from '../../identity/auth/decorators/public.decorator';
import type { AuthUser } from '@autix/domain';
import { TasksService } from './tasks.service';
import { PointsService } from './points.service';
import { MembershipService } from '../membership/membership.service';
import { QuoteTaskDto } from './dto/quote-task.dto';
import { resolveRequestLocale } from './tasks.helpers';

/**
 * `/tasks/:taskType/quote` prices for DISPLAY only — it calls
 * `PointsService.estimateCost` and returns the result, and nothing here calls
 * `createHold`. The authoritative charge happens later, at hold creation, from the
 * generation flow itself. If `estimateCost` can't price the request (unknown task,
 * no binding, invalid params) it throws and this controller lets that propagate as
 * the response's error — it never substitutes a guessed number.
 */
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly pointsService: PointsService,
    private readonly membershipService: MembershipService,
  ) {}

  @Get()
  @Public()
  async listTasks() {
    return this.tasksService.listTasks();
  }

  @Get(':taskType/models')
  @Public()
  async listModels(
    @Param('taskType') taskType: string,
    @OptionalCurrentUser() user: AuthUser | undefined,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.tasksService.listModelsForTask(taskType, {
      userId: user ? getCurrentUserId(user) : undefined,
      locale: resolveRequestLocale(acceptLanguage),
    });
  }

  @Post(':taskType/quote')
  @Public()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async quote(
    @Param('taskType') taskType: string,
    @Body() body: QuoteTaskDto,
    @OptionalCurrentUser() user: AuthUser | undefined,
  ) {
    const membershipLevel = user
      ? await this.membershipService.resolveActiveMembershipLevel(getCurrentUserId(user))
      : 0;
    const estimate = await this.pointsService.estimateCost({
      taskType,
      modelConfigId: body.modelConfigId,
      params: body.params,
      usage: body.usage,
      membershipLevel,
    });
    return {
      total: estimate.estimatedCost,
      breakdown: estimate.breakdown,
      snapshot: estimate.pricingSnapshot,
    };
  }
}
