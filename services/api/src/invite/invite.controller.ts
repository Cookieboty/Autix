import {
  Controller,
  Get,
  Req,
  UseGuards,
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
}
