import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import {
  CurrentUser,
  OptionalCurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { Public } from '../../identity/auth/decorators/public.decorator';
import {
  CampaignRewardService,
  type RecordFeedbackInput,
  type UpsertCampaignInput,
} from './campaign-reward.service';
import type { AuthUser } from '@autix/domain';

@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignRewardService: CampaignRewardService) { }

  @Get('active')
  async activeCampaigns() {
    return this.campaignRewardService.listActiveCampaigns();
  }

  @Public()
  @Get('home-starter')
  async homeStarterTasks(@OptionalCurrentUser() user?: AuthUser) {
    return this.campaignRewardService.listHomeStarterTasks(user?.id);
  }

  @Post('home-starter/:code/claim')
  async claimHomeStarterTask(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.campaignRewardService.claimHomeStarterTask(code, userId);
  }

  @Get('me/progress')
  async myProgress(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.campaignRewardService.getMyProgress(userId);
  }

  @Post('feedback')
  async recordFeedback(
    @CurrentUser() user: AuthUser,
    @Body() body: RecordFeedbackInput,
  ) {
    const userId = getCurrentUserId(user);
    return this.campaignRewardService.recordFeedback(userId, body);
  }
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/campaigns')
export class AdminCampaignController {
  constructor(private readonly campaignRewardService: CampaignRewardService) { }

  @Get()
  async listCampaigns() {
    return this.campaignRewardService.listAdminCampaigns();
  }

  @Post()
  async createCampaign(@Body() body: UpsertCampaignInput) {
    return this.campaignRewardService.createCampaign(body);
  }

  @Put(':id')
  async updateCampaign(
    @Param('id') id: string,
    @Body() body: UpsertCampaignInput,
  ) {
    return this.campaignRewardService.updateCampaign(id, body);
  }

  @Get(':id/rewards')
  async listRewards(
    @Param('id') id: string,
    @Query('take') take?: string,
  ) {
    return this.campaignRewardService.listCampaignRewards(
      id,
      take ? Number(take) : undefined,
    );
  }

  @Post(':id/grant-once')
  async grantOnce(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { userId?: string },
  ) {
    const actorId = getCurrentUserId(user);
    if (!body.userId) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'campaign.user_id_required');
    return this.campaignRewardService.grantOnce(id, body.userId ?? '', actorId);
  }
}
