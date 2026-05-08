import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Headers,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InviteService } from './invite.service';

@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @UseGuards(JwtAuthGuard)
  @Get('invite/code')
  async getCode(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.inviteService.getOrCreateCode(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('invite/records')
  async getRecords(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.inviteService.getRecords(userId);
  }

  @Post('internal/invite/reward')
  async reward(
    @Headers('x-internal-secret') secret: string,
    @Body()
    body: {
      inviteCode: string;
      inviteeUserId: string;
      rewardPoints?: number;
    },
  ) {
    if (!secret || secret !== process.env.INTERNAL_SECRET) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return this.inviteService.rewardInviter(
      body.inviteCode,
      body.inviteeUserId,
      body.rewardPoints ?? 100,
    );
  }
}
