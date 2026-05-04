import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { OrchestratorService } from './agents/orchestrator.service';
import { ModelConfigModule } from '../model-config/model-config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentModule } from '../document/document.module';
import { CallBillingService } from './billing/call-billing.service';
import { AgentWorkflowService } from './workflow/agent-workflow.service';
import { ChatFallbackService } from './workflow/chat-fallback.service';

@Module({
  imports: [ModelConfigModule, PrismaModule, DocumentModule],
  providers: [
    LlmService,
    OrchestratorService,
    CallBillingService,
    AgentWorkflowService,
    ChatFallbackService,
  ],
  exports: [
    LlmService,
    OrchestratorService,
    CallBillingService,
    AgentWorkflowService,
    ChatFallbackService,
  ],
})
export class LlmModule {}
