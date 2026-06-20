import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import {
  AdminCampaignController,
  CampaignController,
} from './campaign.controller';
import { CampaignRewardService } from './campaign-reward.service';

@Module({
  imports: [PointsModule],
  controllers: [CampaignController, AdminCampaignController],
  providers: [CampaignRewardService],
  exports: [CampaignRewardService],
})
export class CampaignModule {}
