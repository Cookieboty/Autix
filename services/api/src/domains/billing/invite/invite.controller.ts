import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { InviteService } from './invite.service';
import type { AuthUser } from '@autix/types';

@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @UseGuards(JwtAuthGuard)
  @Get('invite/code')
  async getCode(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.inviteService.getOrCreateCode(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('invite/records')
  async getRecords(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.inviteService.getRecords(userId);
  }
}
