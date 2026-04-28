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
import { createChatModelFromDbConfig } from '../model.factory';
import { ModelConfigService } from '../../model-config/model-config.service';
import { ModelType } from '@prisma/client';
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

      // ── Step 0：按模型配置创建 Model 实例（支持运行时切换模型）──────────
      const resolvedId = modelConfigId ?? await this.resolveDefaultModelId();
      const dbConfig = await this.modelConfigService.getConfigForOrchestrator(resolvedId);
      const model = createChatModelFromDbConfig(dbConfig);

      // ── 使用 LangGraph 执行需求分析流程 ──────────────────────
      const { runAnalysisGraph } = await import('../graph/requirement-analysis-graph');
      
      const graphResult = await runAnalysisGraph({
        input,
        retrievedContext: retrievedContext || '无相关参考文档',
        model,
      });

      // 映射 graph 结果到原有的返回格式
      Object.assign(steps, graphResult.steps);

      // 根据意图决定返回类型
      const intent = graphResult.intent || 'analyze';
      
      if (intent === 'analyze') {
        // 完整分析流程
        usedAgents.push('extractAgent', 'clarifyAgent', 'analysisAgent', 'riskAgent', 'summaryAgent');
        
        const thinking = `分析过程：需求提取 → 澄清判断 → 多维度分析 → 风险评估 → 综合报告`;
        
        return {
          responseType: 'markdown',
          mode: 'fixed',
          usedAgents,
          steps,
          report: graphResult.summary,
          thinking,
        };
      } else if (intent === 'query') {
        // 查询处理
        usedAgents.push('queryHandler');
        
        return {
          responseType: 'markdown',
          mode: 'fixed',
          usedAgents,
          steps,
          report: graphResult.summary,
          thinking: '查询需求状态',
        };
      } else {
        // 聊天处理
        usedAgents.push('chatHandler');
        
        return {
          responseType: 'markdown',
          mode: 'fixed',
          usedAgents,
          steps,
          report: graphResult.summary,
          thinking: '友好对话',
        };
      }
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

      // 从 uiContext 或 steps 获取之前的分析结果
      let analysisResult = uiContext.analysisResult || steps['analysis'];
      let riskResult = uiContext.riskResult || steps['risk'];

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
  private async resolveDefaultModelId(): Promise<string> {
    const defaultModel = await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!defaultModel) {
      throw new Error('未配置默认模型，请在模型配置中设置一个默认的 general 类型模型');
    }
    return defaultModel.id;
  }

  private async createAgents(modelConfigId?: string) {
    const resolvedId = modelConfigId ?? await this.resolveDefaultModelId();
    const dbConfig = await this.modelConfigService.getConfigForOrchestrator(resolvedId);
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
    let currentStep = 0;
    
    // 节点名称到 Agent 名称的映射
    const nodeToAgentMap: Record<string, string> = {
      'classifier': 'classifierAgent',
      'extractStep': 'extractAgent',
      'clarifyStep': 'clarifyAgent',
      'analysisStep': 'analysisAgent',
      'riskStep': 'riskAgent',
      'summaryStep': 'summaryAgent',
      'queryHandler': 'queryAgent',
      'chatHandler': 'chatAgent',
    };
    
    // Agent 执行顺序（用于计算步骤）
    const agentOrder = ['classifierAgent', 'extractAgent', 'clarifyAgent', 'analysisAgent', 'riskAgent', 'summaryAgent'];
    
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

      // 创建 Model 实例
      const { model } = await this.createAgents(modelConfigId);
      
      // Yield 日志事件代替原有的 fetch
      yield {
        type: 'log',
        level: 'info',
        message: 'streamOrchestrate 准备执行 graph',
        data: { input: input.substring(0, 100) },
      };
      
      // 使用流式 Graph 执行需求分析流程
      const { streamAnalysisGraph } = await import('../graph/requirement-analysis-graph');
      
      const graphStream = streamAnalysisGraph({
        input,
        retrievedContext: retrievedContext || '无相关参考文档',
        model,
      });
      
      // 处理 graph 流式事件
      for await (const event of graphStream) {
        switch (event.type) {
          case 'node_start':
            const agentName = nodeToAgentMap[event.node] || event.node;
            const agentIndex = agentOrder.indexOf(agentName);
            currentStep = agentIndex >= 0 ? agentIndex + 1 : currentStep + 1;
            
            yield {
              type: 'agent_start',
              agent: agentName,
              step: currentStep,
              totalSteps: agentOrder.length,
            };
            break;
            
          case 'token':
            // 转发 token 事件
            const tokenAgentName = nodeToAgentMap[event.node] || event.node;
            yield {
              type: 'token',
              content: event.content,
              agent: tokenAgentName,
            };
            break;
            
          case 'node_end':
            const endAgentName = nodeToAgentMap[event.node] || event.node;
            const endAgentIndex = agentOrder.indexOf(endAgentName);
            const endStep = endAgentIndex >= 0 ? endAgentIndex + 1 : currentStep;
            
            yield {
              type: 'agent_end',
              agent: endAgentName,
              step: endStep,
            };
            break;
            
          case 'log':
            // 转发日志事件
            yield {
              type: 'log',
              level: event.level,
              message: event.message,
              data: event.data,
            };
            break;
            
          case 'complete':
            // 处理完成事件
            const graphResult = event.result;
            Object.assign(steps, graphResult.steps);
            
            yield {
              type: 'log',
              level: 'info',
              message: '准备 yield final 事件',
              data: { intent: graphResult.intent },
            };
            
            const intent = graphResult.intent || 'analyze';
            
            if (intent === 'analyze') {
              // 检查是否需要澄清（短路逻辑）
              const needsClarification = graphResult.clarified?.needsClarification === true;
              
              if (needsClarification) {
                // 需要澄清，只执行了 extract 和 clarify
                usedAgents.push('extractAgent', 'clarifyAgent');
                
                const thinking = `分析过程：需求提取 → 澄清判断 → 等待用户反馈`;
                
                yield {
                  type: 'final',
                  result: {
                    responseType: 'markdown',
                    mode: 'fixed',
                    usedAgents,
                    steps,
                    report: graphResult.summary,
                    thinking,
                  },
                };
                
                yield {
                  type: 'log',
                  level: 'info',
                  message: 'analyze 分支（需要澄清）yield final 完成',
                };
              } else {
                // 完整分析流程
                usedAgents.push('extractAgent', 'clarifyAgent', 'analysisAgent', 'riskAgent', 'summaryAgent');
                
                const thinking = `分析过程：需求提取 → 澄清判断 → 多维度分析 → 风险评估 → 综合报告`;
                
                yield {
                  type: 'final',
                  result: {
                    responseType: 'markdown',
                    mode: 'fixed',
                    usedAgents,
                    steps,
                    report: graphResult.summary,
                    thinking,
                  },
                };
                
                yield {
                  type: 'log',
                  level: 'info',
                  message: 'analyze 分支（完整分析）yield final 完成',
                };
              }
            } else if (intent === 'query') {
              // 查询处理
              usedAgents.push('queryHandler');
              
              yield {
                type: 'final',
                result: {
                  responseType: 'markdown',
                  mode: 'fixed',
                  usedAgents,
                  steps,
                  report: graphResult.summary,
                  thinking: '查询需求状态',
                },
              };
              
              yield {
                type: 'log',
                level: 'info',
                message: 'query 分支 yield final 完成',
              };
            } else {
              // 聊天处理
              usedAgents.push('chatHandler');
              
              yield {
                type: 'final',
                result: {
                  responseType: 'markdown',
                  mode: 'fixed',
                  usedAgents,
                  steps,
                  report: graphResult.summary,
                  thinking: '友好对话',
                },
              };
              
              yield {
                type: 'log',
                level: 'info',
                message: 'chat 分支 yield final 完成',
              };
            }
            break;
        }
      }
      
      return;
    } catch (err) {
      console.error('[streamOrchestrate] Pipeline 执行失败:', err);
      
      yield {
        type: 'log',
        level: 'error',
        message: 'streamOrchestrate 执行失败',
        data: { error: err instanceof Error ? err.message : String(err) },
      };
      
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
