import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { OrchestratorService } from './agents/orchestrator.service';
import { ModelConfigModule } from '../model-config/model-config.module';

@Module({
  imports: [ModelConfigModule],
  providers: [LlmService, OrchestratorService],
  exports: [LlmService, OrchestratorService],
})
export class LlmModule {}
