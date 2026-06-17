import { Module, forwardRef } from '@nestjs/common';
import { LlmService } from './llm.service';
import { OrchestratorService } from './agents/orchestrator.service';
import { ModelConfigModule } from '../model-config/model-config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentModule } from '../document/document.module';
import { CallBillingService } from './billing/call-billing.service';
import { AgentWorkflowService } from './workflow/agent-workflow.service';
import { ChatFallbackService } from './workflow/chat-fallback.service';
import { ImageGenerationFlowService } from './workflow/image-generation-flow.service';
import { ImageChatService } from './workflow/image-chat.service';
import { ImageTemplatesModule } from '../image-templates/image-templates.module';
import { PointsModule } from '../points/points.module';
import { VideoModule } from '../video/video.module';
import { InviteModule } from '../invite/invite.module';
import { CampaignModule } from '../campaign/campaign.module';

@Module({
  imports: [
    ModelConfigModule,
    PrismaModule,
    DocumentModule,
    ImageTemplatesModule,
    PointsModule,
    forwardRef(() => VideoModule),
    InviteModule,
    CampaignModule,
  ],
  providers: [
    LlmService,
    OrchestratorService,
    CallBillingService,
    AgentWorkflowService,
    ChatFallbackService,
    ImageGenerationFlowService,
    ImageChatService,
  ],
  exports: [
    LlmService,
    OrchestratorService,
    CallBillingService,
    AgentWorkflowService,
    ChatFallbackService,
    ImageGenerationFlowService,
    ImageChatService,
  ],
})
export class LlmModule { }
