import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import {
  CampaignRewardService,
  type RecordFeedbackInput,
  type UpsertCampaignInput,
} from './campaign-reward.service';

@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignRewardService: CampaignRewardService) {}

  @Get('active')
  async activeCampaigns() {
    return this.campaignRewardService.listActiveCampaigns();
  }

  @Get('me/progress')
  async myProgress(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.campaignRewardService.getMyProgress(userId);
  }

  @Post('feedback')
  async recordFeedback(
    @Req() req: Request,
    @Body() body: RecordFeedbackInput,
  ) {
    const userId = (req.user as any).userId ?? (req.user as any).id;
    return this.campaignRewardService.recordFeedback(userId, body);
  }
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/campaigns')
export class AdminCampaignController {
  constructor(private readonly campaignRewardService: CampaignRewardService) {}

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
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { userId?: string },
  ) {
    const actorId = (req.user as any).userId ?? (req.user as any).id;
    if (!body.userId) throw new BadRequestException('userId 必填');
    return this.campaignRewardService.grantOnce(id, body.userId ?? '', actorId);
  }
}
