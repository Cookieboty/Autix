import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { PointsModule } from '../points/points.module';
import {
  AdminCampaignController,
  CampaignController,
} from './campaign.controller';
import { CampaignRewardService } from './campaign-reward.service';
import { CampaignRepository } from './campaign.repository';

@Module({
  imports: [PrismaModule, PointsModule],
  controllers: [CampaignController, AdminCampaignController],
  providers: [CampaignRewardService, CampaignRepository],
  exports: [CampaignRewardService],
})
export class CampaignModule {}
