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
import { RunnableLambda, RunnableConfig } from '@langchain/core/runnables';
import {
  createExtractAgent,
  createClarifyAgent,
  createAnalysisAgent,
  createRiskAgent,
  createSummaryAgent,
} from './sub-agents';
import { createChatModelFromDbConfig, createChatModel } from '../model.factory';
import { ModelConfigService } from '../../model-config/model-config.service';

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
  constructor(private readonly modelConfigService: ModelConfigService) {}

  /**
   * 执行完整的需求分析 Pipeline。
   *
   * @param input           用户原始消息（当前轮，可能已拼接历史上下文）
   * @param retrievedContext 已格式化的 RAG 检索结果字符串，
   *                        由 ConversationController 在调用前处理好传入。
   *                        无检索结果时传 '无相关参考文档'。
   * @param modelConfigId   可选：ModelConfig 表的 ID，传入则使用该模型；
   *                        不传则使用 langchain.yaml 中的默认模型（向后兼容）
   * @returns OrchestratorResult
   */
  async orchestrate(
    input: string,
    retrievedContext: string,
    modelConfigId?: string,
  ): Promise<OrchestratorResult> {
    const usedAgents: string[] = [];
    const steps: Record<string, string> = {};

    try {
      // ── Step 0：按模型配置创建 Agent 实例（支持运行时切换模型）──────────
      let extract: ReturnType<typeof createExtractAgent>;
      let clarify: ReturnType<typeof createClarifyAgent>;
      let analysis: ReturnType<typeof createAnalysisAgent>;
      let risk: ReturnType<typeof createRiskAgent>;
      let summary: ReturnType<typeof createSummaryAgent>;

      if (modelConfigId) {
        const dbConfig = await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
        const model = createChatModelFromDbConfig(dbConfig);
        extract = createExtractAgent(model);
        clarify = createClarifyAgent(model);
        analysis = createAnalysisAgent(model);
        risk = createRiskAgent(model);
        summary = createSummaryAgent(model);
      } else {
        const { loadLangChainConfig, getApiKeys } = await import('../../config/load-langchain-config');
        const config = loadLangChainConfig();
        const keys = getApiKeys();
        const model = createChatModel({
          modelConfigId: 'default',
          modelName: config.llm.model,
          temperature: config.llm.temperature,
          maxTokens: config.llm.maxTokens,
          baseUrl: keys.openaiBaseUrl,
          apiKey: keys.openaiApiKey,
        });
        extract = createExtractAgent(model);
        clarify = createClarifyAgent(model);
        analysis = createAnalysisAgent(model);
        risk = createRiskAgent(model);
        summary = createSummaryAgent(model);
      }

      // ── Step 1：需求抽取 ─────────────────────────────────────
      usedAgents.push('extractAgent');
      const extractRaw = await extract.invoke({ input });
      steps['extract'] = extractRaw;

      // 清洗模型可能添加的 markdown 代码块包裹
      const extractFenceMatch = extractRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const cleanExtract = extractFenceMatch
        ? extractFenceMatch[1].trim()
        : extractRaw.trim();

      // 尝试解析 JSON，失败时用降级值（避免整个 pipeline 崩溃）
      let extracted: Record<string, unknown>;
      try {
        extracted = JSON.parse(cleanExtract);
      } catch {
        extracted = {
          isComplete: false,
          missingFields: ['JSON 解析失败，请重试'],
        };
      }
      const extractResultStr = JSON.stringify(extracted);

      // ── Step 2：澄清判断 ─────────────────────────────────────
      usedAgents.push('clarifyAgent');
      const clarifyRaw = await clarify.invoke({
        extractResult: extractResultStr,
        input,
      });
      steps['clarify'] = clarifyRaw;

      const clarifyFenceMatch = clarifyRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const cleanClarify = clarifyFenceMatch
        ? clarifyFenceMatch[1].trim()
        : clarifyRaw.trim();

      let clarifyResult: { needsClarification: boolean; questions: string[] };
      try {
        clarifyResult = JSON.parse(cleanClarify);
      } catch {
        clarifyResult = { needsClarification: false, questions: [] };
      }

      // 如果需要澄清，提前返回，不继续执行后续 Agent
      if (clarifyResult.needsClarification && clarifyResult.questions.length > 0) {
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
      const [analysisResult, riskResult] = await Promise.all([
        analysis.invoke({ extractResult: extractResultStr, input }),
        risk.invoke({ extractResult: extractResultStr, input }),
      ]);
      steps['analysis'] = analysisResult;
      steps['risk'] = riskResult;

      // ── Step 4：综合报告 ─────────────────────────────────────
      usedAgents.push('summaryAgent');
      const report = await summary.invoke({
        input,
        extractResult: extractResultStr,
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
        report: '## 分析失败\n\n系统内部错误，请稍后重试。',
      };
    }
  }

  /**
   * 将 OrchestratorService 包装为 LangChain Runnable，
   * 供 RunnableWithMessageHistory 调用。
   *
   * 输入：{ input: string, modelConfigId?: string }
   *        + RunnableWithMessageHistory 自动注入的 history（由 extractPrompt 的 MessagesPlaceholder 消费）
   * 输出：OrchestratorResult（整个 pipeline 结果，含 report / needsClarification 等）
   *
   * @param retrievedContext 在调用时通过 config.configurable.retrievedContext 传入
   * @param modelConfigId    在调用时通过 config.configurable.modelConfigId 传入
   */
  asRunnable() {
    return new RunnableLambda({
      func: async (
        input: { input: string; modelConfigId?: string },
        config?: RunnableConfig,
      ) => {
        const modelConfigId = (config as any)?.configurable?.modelConfigId;
        const retrievedContext =
          (config as any)?.configurable?.retrievedContext ?? '无相关参考文档';
        return this.orchestrate(input.input, retrievedContext, modelConfigId);
      },
    });
  }
}
