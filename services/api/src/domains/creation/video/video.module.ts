import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { PointsModule } from '../../billing/points/points.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { MembershipModule } from '../../billing/membership/membership.module';
import { InviteModule } from '../../billing/invite/invite.module';
import { RiskModule } from '../risk/risk.module';
import { SeedanceApiService } from './seedance-api.service';
import { VideoAssetPersistenceService } from './video-asset-persistence.service';
import { VideoCallbackUrlBuilder } from './video-callback-url.builder';
import { VideoChainTriggerDispatcherService } from './video-chain-trigger-dispatcher.service';
import { VideoGenerationFlowService } from './video-generation-flow.service';
import { VideoGenerationHoldReconciliationService } from './video-generation-hold-reconciliation.service';
import { VideoGenerationModelResolverService } from './video-generation-model-resolver.service';
import { VideoGenerationRepository } from './video-generation.repository';
import { VideoGenerationTerminalConvergenceService } from './video-generation-terminal-convergence.service';
import { VideoMaterialRepository } from './video-material.repository';
import { VideoProjectStatusConvergenceService } from './video-project-status-convergence.service';
import { VideoProjectRepository } from './video-project.repository';
import { VideoProjectService } from './video-project.service';
import { VideoMaterialService } from './video-material.service';
import { VideoChatService } from './video-chat.service';
import { VideoWorkflowTemplatesService } from './video-workflow-templates.service';
import { VideoProjectController } from './video-project.controller';
import { VideoMaterialController } from './video-material.controller';
import { VideoCallbackController } from './video-callback.controller';
import { VideoWorkflowTemplatesController } from './video-workflow-templates.controller';
import { VideoWorkflowTemplateRepository } from './video-workflow-template.repository';

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
  ],
  controllers: [
    VideoProjectController,
    VideoMaterialController,
    VideoCallbackController,
    VideoWorkflowTemplatesController,
  ],
  providers: [
    SeedanceApiService,
    VideoAssetPersistenceService,
    VideoCallbackUrlBuilder,
    VideoChainTriggerDispatcherService,
    VideoGenerationFlowService,
    VideoGenerationHoldReconciliationService,
    VideoGenerationModelResolverService,
    VideoGenerationRepository,
    VideoGenerationTerminalConvergenceService,
    VideoMaterialRepository,
    VideoProjectStatusConvergenceService,
    VideoProjectRepository,
    VideoProjectService,
    VideoMaterialService,
    VideoChatService,
    VideoWorkflowTemplatesService,
    VideoWorkflowTemplateRepository,
  ],
  exports: [
    VideoChatService,
    VideoGenerationFlowService,
    VideoProjectService,
  ],
})
export class VideoModule { }
