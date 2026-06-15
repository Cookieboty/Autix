import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PointsModule } from '../points/points.module';
import { StorageModule } from '../storage/storage.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { InviteModule } from '../invite/invite.module';
import { RiskModule } from '../risk/risk.module';
import { CampaignModule } from '../campaign/campaign.module';
import { SeedanceApiService } from './seedance-api.service';
import { VideoGenerationFlowService } from './video-generation-flow.service';
import { VideoProjectService } from './video-project.service';
import { VideoMaterialService } from './video-material.service';
import { VideoChatService } from './video-chat.service';
import { VideoWorkflowTemplatesService } from './video-workflow-templates.service';
import { VideoProjectController } from './video-project.controller';
import { VideoMaterialController } from './video-material.controller';
import { VideoCallbackController } from './video-callback.controller';
import { VideoWorkflowTemplatesController } from './video-workflow-templates.controller';

@Module({
  imports: [
    PrismaModule,
    PointsModule,
    StorageModule,
    ModelConfigModule,
    AuthModule,
    MembershipModule,
    InviteModule,
    RiskModule,
    CampaignModule,
  ],
  controllers: [
    VideoProjectController,
    VideoMaterialController,
    VideoCallbackController,
    VideoWorkflowTemplatesController,
  ],
  providers: [
    SeedanceApiService,
    VideoGenerationFlowService,
    VideoProjectService,
    VideoMaterialService,
    VideoChatService,
    VideoWorkflowTemplatesService,
  ],
  exports: [
    VideoChatService,
    VideoGenerationFlowService,
    VideoProjectService,
  ],
})
export class VideoModule { }
