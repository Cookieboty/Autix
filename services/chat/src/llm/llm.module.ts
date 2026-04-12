import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { OrchestratorService } from './agents/orchestrator.service';

@Module({
  providers: [LlmService, OrchestratorService],
  exports: [LlmService, OrchestratorService],
})
export class LlmModule {}
