import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { Public } from '../../identity/auth/decorators/public.decorator';
import { PointsService } from './points.service';
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

  // POST /points/estimate 已移到 PointsEstimateController(在 TasksModule 里),
  // 因为它需要 MembershipService 解析会员等级,而 PointsModule 不能 import
  // MembershipModule(5 模块 DI 环)。见 points-estimate.controller.ts。
}
