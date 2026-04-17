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
import { UIResponseService } from '../ui-protocol/ui-response.service';
import type { UIContext } from '../../conversation/ui-action.parser';
import type { AIUIResponse, OrchestratorStreamEvent, OrchestratorResult } from '../ui-protocol/ui-types';

/**
 * Pipeline 的最终返回类型（已导入自 ui-types.ts）
 */

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly uiResponseService: UIResponseService,
  ) {}

  /**
   * 执行完整的需求分析 Pipeline。
   *
   * @param input           用户原始消息（当前轮，可能已拼接历史上下文）
   * @param retrievedContext 已格式化的 RAG 检索结果字符串，
   *                        由 ConversationController 在调用前处理好传入。
   *                        无检索结果时传 '无相关参考文档'。
   * @param modelConfigId   可选：ModelConfig 表的 ID，传入则使用该模型；
   *                        不传则使用 langchain.yaml 中的默认模型（向后兼容）
   * @param uiContext       可选：UI 交互上下文（包含当前阶段、用户操作等）
   * @returns OrchestratorResult
   */
  async orchestrate(
    input: string,
    retrievedContext: string,
    modelConfigId?: string,
    uiContext?: UIContext,
  ): Promise<OrchestratorResult> {
    const usedAgents: string[] = [];
    const steps: Record<string, string> = {};

    try {
      // ── UI 状态机处理 ──────────────────────────────────────────
      // 如果有 UI 上下文，根据当前阶段和用户操作决定流程
      if (uiContext?.uiStage && uiContext.userAction) {
        return await this.handleUIStateMachine(
          input,
          retrievedContext,
          modelConfigId,
          uiContext,
          usedAgents,
          steps,
        );
      }

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

      // 生成需求类型选择 UI（第一步）
      const selectionResponse = await this.uiResponseService.generateSelectionForRequirementType();
      
      // 为 selection UI 添加引导性的 thinking
      if (selectionResponse) {
        selectionResponse.thinking = '请先选择您的需求类型，这将帮助我更好地理解和分析您的需求';
      }
      
      return {
        responseType: 'ui',
        mode: 'fixed',
        usedAgents,
        steps,
        nextUIStage: 'select_type',
        uiResponse: selectionResponse,
      };

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

      // 为 Markdown 响应添加 thinking
      const thinking = `分析过程：需求提取 → 多维度分析 → 风险评估 → 综合报告`;
      
      return {
        responseType: 'markdown',
        mode: 'fixed',
        usedAgents,
        steps,
        report,
        thinking,
      };
    } catch (err) {
      // Pipeline 整体失败，返回错误标记但不抛异常
      console.error('[OrchestratorService] Pipeline 执行失败:', err);
      return {
        responseType: 'markdown',
        mode: 'fixed',
        usedAgents,
        steps,
        report: '## 分析失败\n\n系统内部错误，请稍后重试。',
      };
    }
  }

  /**
   * 处理 UI 状态机逻辑
   * 根据当前 UI 阶段和用户操作，决定执行哪些 Agent 并生成相应的 UI 响应
   */
  private async handleUIStateMachine(
    input: string,
    retrievedContext: string,
    modelConfigId: string | undefined,
    uiContext: UIContext,
    usedAgents: string[],
    steps: Record<string, string>,
  ): Promise<OrchestratorResult> {
    const { uiStage, userAction, collectedData } = uiContext;

    // 确保 userAction 存在
    if (!userAction) {
      return {
        responseType: 'markdown',
        mode: 'fixed',
        usedAgents: ['ui-error'],
        steps: { 'ui-error': '缺少用户操作' },
        report: 'UI 状态错误，缺少用户操作',
      };
    }

    // ── Stage 1 → Stage 2: 用户选择了需求类型，生成表单 ──────────
    if (uiStage === 'select_type' && userAction.action === 'submit') {
      const selectedType = (userAction.data.selectedType || userAction.data.value || 'functional') as string;
      const formResponse = await this.uiResponseService.generateFormForRequirementDetail(selectedType);
      
      return {
        responseType: 'ui',
        mode: 'fixed',
        usedAgents: ['ui-select-type'],
        steps: { 'ui-select-type': `用户选择: ${selectedType}` },
        report: `用户选择了需求类型: ${selectedType}`,
        nextUIStage: 'fill_detail',
        uiResponse: formResponse,
      };
    }

    // ── Stage 2 → Stage 3: 用户填写了表单，运行分析并生成确认 ──────
    if (uiStage === 'fill_detail' && userAction.action === 'submit') {
      // 合并所有收集的数据
      const extracted = { ...collectedData, ...userAction.data };
      const extractResultStr = JSON.stringify(extracted);

      // 创建 Agent 实例
      const { model, agents } = await this.createAgents(modelConfigId);
      
      // 运行分析和风险评估
      usedAgents.push('analysisAgent', 'riskAgent');
      const [analysisResult, riskResult] = await Promise.all([
        agents.analysis.invoke({ extractResult: extractResultStr, input }),
        agents.risk.invoke({ extractResult: extractResultStr, input }),
      ]);
      steps['analysis'] = analysisResult;
      steps['risk'] = riskResult;

      // 生成确认对话框和分析结果卡片
      const confirmResponse = await this.uiResponseService.generateConfirmation(
        analysisResult,
        riskResult,
      );

      return {
        responseType: 'ui',
        mode: 'fixed',
        usedAgents,
        steps,
        report: `分析完成\n\n${analysisResult}\n\n${riskResult}`,
        nextUIStage: 'confirm',
        uiResponse: confirmResponse,
      };
    }

    // ── Stage 3 → Stage 4: 用户确认，运行 summary 并生成结果 ────
    // 用户点击确认按钮时，action 为 'submit'
    if (uiStage === 'confirm' && userAction.action === 'submit') {
      // 从 collectedData 或上一阶段获取数据
      const extracted = collectedData;
      const extractResultStr = JSON.stringify(extracted);

      // 创建 Agent 实例
      const { model, agents } = await this.createAgents(modelConfigId);

      // 从 steps 获取之前的分析结果，如果没有则重新运行
      let analysisResult = steps['analysis'];
      let riskResult = steps['risk'];

      if (!analysisResult || !riskResult) {
        usedAgents.push('analysisAgent', 'riskAgent');
        [analysisResult, riskResult] = await Promise.all([
          agents.analysis.invoke({ extractResult: extractResultStr, input }),
          agents.risk.invoke({ extractResult: extractResultStr, input }),
        ]);
        steps['analysis'] = analysisResult;
        steps['risk'] = riskResult;
      }

      // 运行 summary
      usedAgents.push('summaryAgent');
      const report = await agents.summary.invoke({
        input,
        extractResult: extractResultStr,
        analysisResult,
        riskResult,
        retrievedContext: retrievedContext || '无相关参考文档',
      });
      steps['summary'] = report;

      // 生成结果步骤和操作按钮
      const resultResponse = await this.uiResponseService.generateResultSteps(report);

      return {
        responseType: 'ui',
        mode: 'fixed',
        usedAgents,
        steps,
        report,
        nextUIStage: 'result',
        uiResponse: resultResponse,
      };
    }

    // ── 取消操作：返回初始状态 ──────────────────────────────────
    if (userAction.action === 'cancel') {
      const selectionResponse = await this.uiResponseService.generateSelectionForRequirementType();
      return {
        responseType: 'ui',
        mode: 'fixed',
        usedAgents: ['ui-reset'],
        steps: { 'ui-reset': '用户取消操作' },
        report: '操作已取消',
        nextUIStage: 'select_type',
        uiResponse: selectionResponse,
      };
    }

    // ── 未知状态：返回错误 ────────────────────────────────────
    return {
      responseType: 'markdown',
      mode: 'fixed',
      usedAgents: ['ui-error'],
      steps: { 'ui-error': `未知的 UI 状态: ${uiStage}` },
      report: 'UI 状态错误，请重新开始',
    };
  }

  /**
   * 创建 Agent 实例的辅助方法
   */
  private async createAgents(modelConfigId?: string) {
    if (modelConfigId) {
      const dbConfig = await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
      const model = createChatModelFromDbConfig(dbConfig);
      return {
        model,
        agents: {
          extract: createExtractAgent(model),
          clarify: createClarifyAgent(model),
          analysis: createAnalysisAgent(model),
          risk: createRiskAgent(model),
          summary: createSummaryAgent(model),
        },
      };
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
      return {
        model,
        agents: {
          extract: createExtractAgent(model),
          clarify: createClarifyAgent(model),
          analysis: createAnalysisAgent(model),
          risk: createRiskAgent(model),
          summary: createSummaryAgent(model),
        },
      };
    }
  }

  /**
   * 流式编排方法 - 使用 LangChain streamEvents API 实现真正的 token 级流式输出
   * 
   * @param input 用户消息
   * @param retrievedContext RAG 检索结果
   * @param modelConfigId 模型配置 ID
   * @param uiContext UI 交互上下文
   * @returns AsyncGenerator 生成流式事件
   */
  async *streamOrchestrate(
    input: string,
    retrievedContext: string,
    modelConfigId?: string,
    uiContext?: UIContext,
  ): AsyncGenerator<OrchestratorStreamEvent> {
    const usedAgents: string[] = [];
    const steps: Record<string, string> = {};
    
    try {
      // 如果有 UI 上下文，使用原有的同步逻辑(UI 流程不需要流式)
      if (uiContext?.uiStage && uiContext.userAction) {
        const result = await this.handleUIStateMachine(
          input,
          retrievedContext,
          modelConfigId,
          uiContext,
          usedAgents,
          steps,
        );
        yield { type: 'final', result };
        return;
      }

      // 创建 Agent 实例
      const { agents } = await this.createAgents(modelConfigId);
      
      // Step 1: 需求抽取(不需要流式)
      usedAgents.push('extractAgent');
      yield { type: 'agent_start', agent: 'extractAgent' };
      
      const extractRaw = await agents.extract.invoke({ input });
      steps['extract'] = extractRaw;
      
      const extractFenceMatch = extractRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const cleanExtract = extractFenceMatch ? extractFenceMatch[1].trim() : extractRaw.trim();
      
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
      
      yield { type: 'agent_end', agent: 'extractAgent', output: extractResultStr };
      
      // Step 2: 澄清判断(不需要流式)
      usedAgents.push('clarifyAgent');
      yield { type: 'agent_start', agent: 'clarifyAgent' };
      
      const clarifyRaw = await agents.clarify.invoke({
        extractResult: extractResultStr,
        input,
      });
      steps['clarify'] = clarifyRaw;
      
      const clarifyFenceMatch = clarifyRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const cleanClarify = clarifyFenceMatch ? clarifyFenceMatch[1].trim() : clarifyRaw.trim();
      
      let clarifyResult: { needsClarification: boolean; questions: string[] };
      try {
        clarifyResult = JSON.parse(cleanClarify);
      } catch {
        clarifyResult = { needsClarification: false, questions: [] };
      }
      
      yield { type: 'agent_end', agent: 'clarifyAgent', output: JSON.stringify(clarifyResult) };
      
      const selectionResponse = await this.uiResponseService.generateSelectionForRequirementType();
      
      if (selectionResponse) {
        selectionResponse.thinking = '请先选择您的需求类型，这将帮助我更好地理解和分析您的需求';
      }
      
      yield {
        type: 'final',
        result: {
          responseType: 'ui',
          mode: 'fixed',
          usedAgents,
          steps,
          nextUIStage: 'select_type',
          uiResponse: selectionResponse,
        },
      };
      return;
      
      usedAgents.push('analysisAgent', 'riskAgent');
      yield { type: 'agent_start', agent: 'analysisAgent' };
      yield { type: 'agent_start', agent: 'riskAgent' };
      
      const [analysisResult, riskResult] = await Promise.all([
        agents.analysis.invoke({ extractResult: extractResultStr, input }),
        agents.risk.invoke({ extractResult: extractResultStr, input }),
      ]);
      steps['analysis'] = analysisResult;
      steps['risk'] = riskResult;
      
      yield { type: 'agent_end', agent: 'analysisAgent', output: analysisResult };
      yield { type: 'agent_end', agent: 'riskAgent', output: riskResult };
      
      // Step 4: 综合报告(流式输出)
      usedAgents.push('summaryAgent');
      yield { type: 'agent_start', agent: 'summaryAgent' };
      
      // 构建 summary agent 的输入
      const summaryInput = {
        input,
        extractResult: extractResultStr,
        analysisResult,
        riskResult,
        retrievedContext: retrievedContext || '无相关参考文档',
      };
      
      // 使用流式 API
      let accumulatedReport = '';
      const summaryStream = await agents.summary.stream(summaryInput);
      
      for await (const chunk of summaryStream) {
        const content = typeof chunk === 'string' ? chunk : '';
        if (content) {
          accumulatedReport += content;
          yield { type: 'token', content, agent: 'summaryAgent' };
        }
      }
      
      steps['summary'] = accumulatedReport;
      yield { type: 'agent_end', agent: 'summaryAgent', output: accumulatedReport };
      
      // 返回最终结果，添加 thinking
      const thinking = `分析过程：需求提取 → 多维度分析 → 风险评估 → 综合报告`;
      
      yield {
        type: 'final',
        result: {
          responseType: 'markdown',
          mode: 'fixed',
          usedAgents,
          steps,
          report: accumulatedReport,
          thinking,
        },
      };
    } catch (err) {
      console.error('[streamOrchestrate] Pipeline 执行失败:', err);
        yield {
          type: 'final',
          result: {
            responseType: 'markdown',
            mode: 'fixed',
            usedAgents,
            steps,
            report: '## 分析失败\n\n系统内部错误，请稍后重试。',
          },
        };
    }
  }

  /**
   * 将 OrchestratorService 包装为 LangChain Runnable，
   * 供 RunnableWithMessageHistory 调用。
   *
   * 输入：{ input: string, modelConfigId?: string }
   *        + RunnableWithMessageHistory 自动注入的 history（由 extractPrompt 的 MessagesPlaceholder 消费）
   * 输出：OrchestratorResult（整个 pipeline 结果，含 report / thinking 等）
   *
   * @param retrievedContext 在调用时通过 config.configurable.retrievedContext 传入
   * @param modelConfigId    在调用时通过 config.configurable.modelConfigId 传入
   * @param uiContext        在调用时通过 config.configurable.uiContext 传入
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
        const uiContext = (config as any)?.configurable?.uiContext as UIContext | undefined;
        return this.orchestrate(input.input, retrievedContext, modelConfigId, uiContext);
      },
    });
  }
}
