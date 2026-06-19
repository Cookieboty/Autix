import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../auth/decorators/current-user.decorator';
import { PointsService } from './points.service';
import { PointsSource } from '../prisma/generated';
import type { AuthUser } from '@autix/types';

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
  async getPackages() {
    return this.pointsService.getPackages();
  }

  @Get('pricing-rules')
  async getPricingRules() {
    return this.pointsService.getPricingRules();
  }

  @Post('estimate')
  async estimateCost(@Body() body: any) {
    return this.pointsService.estimateCost(body);
  }
}
