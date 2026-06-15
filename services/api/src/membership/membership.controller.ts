import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { MembershipService } from './membership.service';

@Controller('membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Public()
  @Get('public/levels')
  async getPublicLevels() {
    return this.membershipService.getPublicLevels();
  }

  @UseGuards(JwtAuthGuard)
  @Get('levels')
  async getLevels(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.membershipService.getLevelsForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyMembership(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.membershipService.getUserMembership(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase')
  async purchase(@Req() req: Request, @Body() body: { planId: string }) {
    const userId = (req.user as any).userId;
    return this.membershipService.purchaseMembership(userId, body.planId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel-at-period-end')
  async cancelAtPeriodEnd(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.membershipService.cancelAtPeriodEnd(userId);
  }
}
