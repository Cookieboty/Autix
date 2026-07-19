import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { PointsModule } from '../../billing/points/points.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { MembershipModule } from '../../billing/membership/membership.module';
import { RiskModule } from '../risk/risk.module';
import { GalleryModule } from '../gallery/gallery.module';
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
import { VideoDirectGenerationService } from './video-direct-generation.service';
import { VideoGenController } from './video-gen.controller';

@Module({
  imports: [
    PrismaModule,
    PointsModule,
    StorageModule,
    ModelConfigModule,
    AuthModule,
    MembershipModule,
    RiskModule,
    // history 要附广场帖状态，需要 GalleryService；GalleryModule 非 @Global，
    // 不显式 import 的话 Nest 在 bootstrap 阶段就解析不出依赖、整个进程起不来。
    GalleryModule,
  ],
  controllers: [
    VideoProjectController,
    VideoMaterialController,
    VideoCallbackController,
    VideoWorkflowTemplatesController,
    VideoGenController,
  ],
  providers: [
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
    VideoDirectGenerationService,
  ],
  exports: [
    VideoChatService,
    VideoGenerationFlowService,
    VideoProjectService,
  ],
})
export class VideoModule { }
