import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AdvancedAnalysisService, AnalysisResult } from './advanced-analysis.service';

@Controller('api/advanced')
export class AdvancedController {
  constructor(private readonly advancedAnalysisService: AdvancedAnalysisService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(
    @Body() body: { sessionId: string; input: string },
  ): Promise<AnalysisResult> {
    const { sessionId, input } = body;
    return this.advancedAnalysisService.analyze(sessionId, input);
  }
}
