import { Module, forwardRef } from '@nestjs/common';
import { LlmService } from './llm.service';
import { OrchestratorService } from './agents/orchestrator.service';
import { ModelConfigModule } from '../model-config/model-config.module';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { DocumentModule } from '../document/document.module';
import { CallBillingService } from './billing/call-billing.service';
import { AgentWorkflowService } from './workflow/agent-workflow.service';
import { ChatFallbackService } from './workflow/chat-fallback.service';
import { ImageGenerationFlowService } from './workflow/image-generation-flow.service';
import { ImageChatService } from './workflow/image-chat.service';
import { ImageTemplatesModule } from '../../marketplace/image-templates/image-templates.module';
import { PointsModule } from '../../billing/points/points.module';
import { VideoModule } from '../video/video.module';
import { CampaignModule } from '../../billing/campaign/campaign.module';
import { LlmRepository } from './llm.repository';

@Module({
  imports: [
    ModelConfigModule,
    PrismaModule,
    DocumentModule,
    ImageTemplatesModule,
    PointsModule,
    forwardRef(() => VideoModule),
    CampaignModule,
  ],
  providers: [
    LlmService,
    LlmRepository,
    OrchestratorService,
    CallBillingService,
    AgentWorkflowService,
    ChatFallbackService,
    ImageGenerationFlowService,
    ImageChatService,
  ],
  exports: [
    LlmService,
    LlmRepository,
    OrchestratorService,
    CallBillingService,
    AgentWorkflowService,
    ChatFallbackService,
    ImageGenerationFlowService,
    ImageChatService,
  ],
})
export class LlmModule { }
