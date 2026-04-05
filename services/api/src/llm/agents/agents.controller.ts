import { Body, Controller, Post } from '@nestjs/common';
import { OrchestratorService, OrchestratorResult } from './orchestrator.service';

@Controller('api/agents')
export class AgentsController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Post('orchestrate')
  async orchestrate(@Body() body: { input: string }): Promise<OrchestratorResult> {
    return this.orchestratorService.orchestrate(body.input);
  }
}
