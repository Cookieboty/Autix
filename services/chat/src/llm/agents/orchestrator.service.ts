/**
 * orchestrator.service.ts
 *
 * 需求分析编排服务。
 * 按照固定的五步 Pipeline 顺序/并行调用 sub-agents.ts 中定义的五个 Agent 链。
 *
 * Pipeline 流程：
 *   1. extractAgent      提取结构化需求（JSON）
 *   2. clarifyAgent      判断是否需要澄清（JSON），需要则短路返回
 *   3. analysisAgent     多维度分析（Markdown）  ┐ 并行执行
 *      riskAgent         风险评估（Markdown）    ┘
 *   4. summaryAgent      生成最终报告（Markdown）
 *
 * 注意：OrchestratorService 不做任何 DB 操作和 HTTP 操作，
 * 仅负责编排 Agent 调用并返回结构化结果。
 */
import { Injectable } from '@nestjs/common';
import {
  extractAgent,
  clarifyAgent,
  analysisAgent,
  riskAgent,
  summaryAgent,
} from './sub-agents';

/**
 * Pipeline 的最终返回类型。
 *
 * mode: 固定为 'fixed'（区别于未来可能的动态路由模式）
 * usedAgents: 实际执行过的 Agent 名称列表（按执行顺序）
 * steps: 每个 Agent 的原始输出，key 为 Agent 名，value 为输出字符串（用于调试）
 * needsClarification: 是否需要向用户追问
 * clarificationQuestions: 澄清问题列表（needsClarification=true 时有值）
 * report: 最终需求分析报告 Markdown（正常流程完成时有值）
 */
export interface OrchestratorResult {
  mode: 'fixed';
  usedAgents: string[];
  steps: Record<string, string>;
  needsClarification: boolean;
  clarificationQuestions: string[];
  report?: string;
}

@Injectable()
export class OrchestratorService {
  /**
   * 执行完整的需求分析 Pipeline。
   *
   * @param input           用户原始消息（当前轮，可能已拼接历史上下文）
   * @param retrievedContext 已格式化的 RAG 检索结果字符串，
   *                        由 ConversationController 在调用前处理好传入。
   *                        无检索结果时传 '无相关参考文档'。
   * @returns OrchestratorResult
   */
  async orchestrate(
    input: string,
    retrievedContext: string,
  ): Promise<OrchestratorResult> {
    const usedAgents: string[] = [];
    const steps: Record<string, string> = {};

    try {
      // ── Step 1：需求抽取 ─────────────────────────────────────
      usedAgents.push('extractAgent');
      const extractRaw = await extractAgent.invoke({ input });
      steps['extract'] = extractRaw;

      // 清洗模型可能添加的 markdown 代码块包裹
      const cleanExtract = extractRaw
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();

      // 尝试解析 JSON，失败时用降级值（避免整个 pipeline 崩溃）
      let extracted: Record<string, unknown>;
      try {
        extracted = JSON.parse(cleanExtract);
      } catch (e) {
        console.warn('[OrchestratorService] extractAgent JSON 解析失败，使用降级值:', e);
        extracted = {
          isComplete: false,
          missingFields: ['JSON 解析失败，请重试'],
        };
      }

      // ── Step 2：澄清判断 ─────────────────────────────────────
      usedAgents.push('clarifyAgent');
      const clarifyRaw = await clarifyAgent.invoke({
        extractResult: cleanExtract,
        input,
      });
      steps['clarify'] = clarifyRaw;

      const cleanClarify = clarifyRaw
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();

      let clarifyResult: { needsClarification: boolean; questions: string[] };
      try {
        clarifyResult = JSON.parse(cleanClarify);
      } catch (e) {
        console.warn('[OrchestratorService] clarifyAgent JSON 解析失败，跳过澄清:', e);
        clarifyResult = { needsClarification: false, questions: [] };
      }

      // 如果需要澄清，提前返回，不继续执行后续 Agent
      if (clarifyResult.needsClarification && clarifyResult.questions.length > 0) {
        console.log('[OrchestratorService] 需要澄清，短路返回');
        return {
          mode: 'fixed',
          usedAgents,
          steps,
          needsClarification: true,
          clarificationQuestions: clarifyResult.questions,
        };
      }

      // ── Step 3：多维度分析 + 风险评估（并行执行）───────────────
      usedAgents.push('analysisAgent', 'riskAgent');
      console.log('[OrchestratorService] 并行执行 analysisAgent + riskAgent...');
      const [analysisResult, riskResult] = await Promise.all([
        analysisAgent.invoke({ extractResult: cleanExtract, input }),
        riskAgent.invoke({ extractResult: cleanExtract, input }),
      ]);
      steps['analysis'] = analysisResult;
      steps['risk'] = riskResult;

      // ── Step 4：综合报告 ─────────────────────────────────────
      usedAgents.push('summaryAgent');
      console.log('[OrchestratorService] 生成最终报告...');
      const report = await summaryAgent.invoke({
        input,
        extractResult: cleanExtract,
        analysisResult,
        riskResult,
        retrievedContext: retrievedContext || '无相关参考文档',
      });
      steps['summary'] = report;

      return {
        mode: 'fixed',
        usedAgents,
        steps,
        needsClarification: false,
        clarificationQuestions: [],
        report,
      };
    } catch (err) {
      // Pipeline 整体失败，返回错误标记但不抛异常
      console.error('[OrchestratorService] Pipeline 执行失败:', err);
      return {
        mode: 'fixed',
        usedAgents,
        steps,
        needsClarification: false,
        clarificationQuestions: [],
        report: `## 分析失败\n\n系统内部错误，请稍后重试。\n\n错误信息：${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
