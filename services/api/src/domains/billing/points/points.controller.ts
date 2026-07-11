import { Body, Controller, Get, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { Public } from '../../identity/auth/decorators/public.decorator';
import { PointsService } from './points.service';
import { EstimateTaskDto } from './dto/estimate-task.dto';
import { PointsSource } from '../../platform/prisma/generated';
import type { AuthUser } from '@autix/domain';

@UseGuards(JwtAuthGuard)
@Controller('points')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
  ) {}

  @Get('balance')
  async getBalance(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.pointsService.getBalance(userId);
  }

  @Get('summary')
  async getSummary(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.pointsService.getAccountSummary(userId);
  }

  @Get('records')
  async getRecords(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('source') source?: PointsSource,
  ) {
    const userId = getCurrentUserId(user);
    return this.pointsService.getRecords(userId, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      source,
    });
  }

  @Get('packages')
  @Public()
  async getPackages() {
    return this.pointsService.getPackages();
  }

  @Post('estimate')
  @Public()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async estimateCost(@Body() body: EstimateTaskDto) {
    return this.pointsService.estimateCost(body);
  }
}
