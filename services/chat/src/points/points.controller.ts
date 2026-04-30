import { Controller, Get, Post, Param, Query, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PointsService } from './points.service';
import { PrismaService } from '../prisma/prisma.service';
import { PointsSource, OrderType } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('api/points')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('balance')
  async getBalance(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.pointsService.getBalance(userId);
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

  @Post('packages/:id/purchase')
  async purchasePackage(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    const pkg = await this.pointsService.getPackageById(id);
    if (!pkg) throw new NotFoundException('加油包不存在');

    const orderNo = `ORD${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    return this.prisma.orders.create({
      data: {
        userId,
        orderNo,
        orderType: OrderType.POINTS_PACKAGE,
        productId: pkg.id,
        productName: pkg.name,
        originalPrice: pkg.price,
        amount: pkg.price,
        isFirstTime: false,
        status: 'PENDING',
      },
    });
  }

  @Get('task-costs')
  async getTaskCosts() {
    return this.pointsService.getTaskCosts();
  }
}
