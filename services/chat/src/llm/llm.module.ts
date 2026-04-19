import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { OrchestratorService } from './agents/orchestrator.service';
import { ModelConfigModule } from '../model-config/model-config.module';
import { UIResponseService } from './ui-protocol/ui-response.service';

@Module({
  imports: [ModelConfigModule],
  providers: [LlmService, OrchestratorService, UIResponseService],
  exports: [LlmService, OrchestratorService, UIResponseService],
})
export class LlmModule {}
