import { Injectable, Logger } from '@nestjs/common';
import {
  extractAgent,
  policyCheckAgent,
  riskReviewAgent,
  qaAgent,
  summaryAgent,
} from './sub-agents';

export interface OrchestratorResult {
  mode: 'fixed';
  usedAgents: string[];
  steps: Record<string, string>;
  clarificationQuestions?: string[];
  fallback?: string;
  report?: string;
}

const REQUIRED_FIELDS = ['orderId', 'requestType'];

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  async orchestrate(input: string): Promise<OrchestratorResult> {
    const usedAgents: string[] = [];
    const steps: Record<string, string> = {};

    try {
      // Step 1: Extract
      this.logger.log('Step 1: extractAgent running');
      usedAgents.push('extractAgent');
      const extractRaw = await extractAgent.invoke({ input });
      steps['extract'] = extractRaw;

      // Parse extract result — extract first JSON object from output
      let extracted: Record<string, any>;
      let cleanedJson = '';
      try {
        // First strip markdown code fences
        let raw = extractRaw
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```\s*$/i, '')
          .trim();

        // Extract the first { ... } block (handles trailing text after JSON)
        const jsonMatch = raw.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          cleanedJson = jsonMatch[0];
          extracted = JSON.parse(cleanedJson);
        } else {
          throw new Error('No JSON object found in extract output');
        }
        steps['extract'] = cleanedJson;
      } catch (e) {
        this.logger.warn(`Failed to parse extract result: ${e}. Raw: ${extractRaw.slice(0, 200)}`);
        extracted = {};
      }

      // Only orderId and requestType are required to proceed
      const missing = REQUIRED_FIELDS.filter(
        (f) => extracted[f] === null || extracted[f] === undefined || extracted[f] === '',
      );
      if (missing.length > 0) {
        const clarificationQuestions = this.buildClarificationQuestions(
          missing,
          extracted,
        );
        return {
          mode: 'fixed',
          usedAgents,
          steps,
          clarificationQuestions,
        };
      }

      // Step 2: Parallel — policyCheck + riskReview
      this.logger.log('Step 2: policyCheckAgent + riskReviewAgent in parallel');
      usedAgents.push('policyCheckAgent', 'riskReviewAgent');
      const [policyResult, riskResult] = await Promise.all([
        policyCheckAgent.invoke({ extractResult: cleanedJson }),
        riskReviewAgent.invoke({ extractResult: cleanedJson, input }),
      ]);
      steps['policyCheck'] = policyResult;
      steps['riskReview'] = riskResult;

      // Step 3: QA
      this.logger.log('Step 3: qaAgent running');
      usedAgents.push('qaAgent');
      const qaResult = await qaAgent.invoke({ extractResult: cleanedJson });
      steps['qa'] = qaResult;

      // Step 4: Summary
      this.logger.log('Step 4: summaryAgent running');
      usedAgents.push('summaryAgent');
      const report = await summaryAgent.invoke({
        input,
        extractResult: cleanedJson,
        policyResult,
        riskResult,
        qaResult,
      });
      steps['summary'] = report;

      return {
        mode: 'fixed',
        usedAgents,
        steps,
        report,
      };
    } catch (err) {
      this.logger.error('Orchestrator error', err);
      return {
        mode: 'fixed',
        usedAgents,
        steps,
        fallback: 'manual_review',
      };
    }
  }

  private buildClarificationQuestions(
    missing: string[],
    _extracted: Record<string, any>,
  ): string[] {
    const questions: string[] = [];
    if (missing.includes('orderId')) {
      questions.push('请提供您的订单号（例如：EC20240315001）');
    }
    if (missing.includes('requestType')) {
      questions.push('请问您是需要退货、退款，还是换货？');
    }
    return questions;
  }
}
