import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PointsService } from './points.service';
import { PointsSource } from '../prisma/generated';

@UseGuards(JwtAuthGuard)
@Controller('points')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
  ) {}

  @Get('balance')
  async getBalance(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.pointsService.getBalance(userId);
  }

  @Get('summary')
  async getSummary(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.pointsService.getAccountSummary(userId);
  }

  @Get('records')
  async getRecords(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('source') source?: PointsSource,
  ) {
    const userId = (req.user as any).userId;
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
