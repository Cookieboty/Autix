import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { Public } from '../../identity/auth/decorators/public.decorator';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { MembershipService } from './membership.service';
import type { AuthUser } from '@autix/domain';

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
  async getLevels(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.membershipService.getLevelsForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyMembership(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.membershipService.getUserMembership(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel-at-period-end')
  async cancelAtPeriodEnd(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.membershipService.cancelAtPeriodEnd(userId);
  }
}
