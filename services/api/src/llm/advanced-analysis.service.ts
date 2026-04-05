import { Injectable, Logger } from '@nestjs/common';
import { RunnableMemoryService } from './memory/runnable-memory.service';
import { OrchestratorService, OrchestratorResult } from './agents/orchestrator.service';
import { writeFileTool } from './tools/business.tools';

export interface AnalysisResult {
  sessionId: string;
  needsClarification: boolean;
  clarificationQuestions?: string[];
  report?: string;
  ticketPath?: string;
  orchestratorResult: OrchestratorResult;
}

@Injectable()
export class AdvancedAnalysisService {
  private readonly logger = new Logger(AdvancedAnalysisService.name);

  constructor(
    private readonly memoryService: RunnableMemoryService,
    private readonly orchestratorService: OrchestratorService,
  ) {}

  async analyze(sessionId: string, input: string): Promise<AnalysisResult> {
    // Step 1: Get history from memory
    this.logger.log(`[${sessionId}] Step 1: Reading history`);
    const history = await this.memoryService.getHistory(sessionId);

    // Step 2: Build context from history + current input
    const contextMessages = history.map((msg) => {
      const role = msg._getType();
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return `${role === 'human' ? 'User' : 'Assistant'}: ${content}`;
    });
    contextMessages.push(`User: ${input}`);
    const fullContext = contextMessages.join('\n');

    this.logger.log(`[${sessionId}] Step 2: Context built with ${history.length} history messages`);

    // Step 3: Call orchestrator with full context
    this.logger.log(`[${sessionId}] Step 3: Calling orchestrator`);
    const orchestratorResult = await this.orchestratorService.orchestrate(fullContext);

    // Step 4: Check if clarification is needed
    if (orchestratorResult.clarificationQuestions && orchestratorResult.clarificationQuestions.length > 0) {
      this.logger.log(`[${sessionId}] Clarification needed`);

      // Append clarification questions to memory
      const clarificationText = '需要补充以下信息：\n' +
        orchestratorResult.clarificationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');

      await this.memoryService.appendMessage(sessionId, input, clarificationText);

      return {
        sessionId,
        needsClarification: true,
        clarificationQuestions: orchestratorResult.clarificationQuestions,
        orchestratorResult,
      };
    }

    // Step 5: If no clarification needed, write report to tickets/
    let ticketPath: string | undefined;
    if (orchestratorResult.report) {
      this.logger.log(`[${sessionId}] Step 4: Writing report to tickets/`);

      // Extract orderId from steps.extract if available
      let orderId = 'unknown';
      try {
        const extractResult = JSON.parse(orchestratorResult.steps['extract'] || '{}');
        orderId = extractResult.orderId || 'unknown';
      } catch {
        // ignore parse error
      }

      ticketPath = `tickets/${orderId}-analysis-${Date.now()}.md`;
      await writeFileTool.invoke({
        filePath: ticketPath,
        content: orchestratorResult.report,
      });

      this.logger.log(`[${sessionId}] Report written to ${ticketPath}`);
    }

    // Step 6: Append final conclusion to memory (without re-invoking model)
    const conclusion = orchestratorResult.report || orchestratorResult.fallback || '分析完成';
    await this.memoryService.appendMessage(sessionId, input, conclusion);

    this.logger.log(`[${sessionId}] Analysis complete`);

    return {
      sessionId,
      needsClarification: false,
      report: orchestratorResult.report,
      ticketPath,
      orchestratorResult,
    };
  }
}
