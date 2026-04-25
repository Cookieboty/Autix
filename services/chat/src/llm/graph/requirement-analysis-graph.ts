/**
 * requirement-analysis-graph.ts
 *
 * 使用 LangGraph 实现需求分析流程。
 * 将原有的 Promise 链式调用迁移到 StateGraph，支持并行执行和状态管理。
 * 支持意图分类和多路由：分析、查询、聊天。
 */
import { Annotation, MessagesAnnotation, StateGraph, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import {
  createExtractAgent,
  createClarifyAgent,
  createAnalysisAgent,
  createRiskAgent,
  createSummaryAgent,
} from '../agents/sub-agents';
import { analysisTools } from '../tools/analysis-tools';

/**
 * 意图分类的 Zod Schema
 */
const IntentSchema = z.object({
  intent: z.enum(['analyze', 'query', 'chat']).describe(
    '用户意图：analyze=需求分析，query=查询需求状态，chat=闲聊对话'
  ),
  reasoning: z.string().describe('判断该意图的理由（1-2句话）'),
});

/**
 * 定义需求分析的状态类型
 * 使用 Annotation.Root 自动推断类型
 */
export const RequirementAnalysisState = Annotation.Root({
  // 复用 MessagesAnnotation 处理消息历史
  ...MessagesAnnotation.spec,
  
  // 用户原始输入
  input: Annotation<string>,
  
  // RAG 检索上下文
  retrievedContext: Annotation<string>,
  
  // 用户意图（带默认值）
  intent: Annotation<'analyze' | 'query' | 'chat'>({
    reducer: (_, newValue) => newValue,
    default: () => 'analyze' as const,
  }),
  
  // extract 节点输出：结构化的需求字段
  extracted: Annotation<Record<string, unknown>>,
  
  // clarify 节点输出：澄清判断结果
  clarified: Annotation<{
    needsClarification: boolean;
    questions: string[];
  }>,
  
  // analysis 节点输出：多维度分析结果（Markdown）
  analysisResult: Annotation<string>,
  
  // risk 节点输出：风险评估结果（Markdown）
  riskResult: Annotation<string>,
  
  // summary 节点输出：最终综合报告（Markdown）
  summary: Annotation<string>,
  
  // 查询响应
  queryResponse: Annotation<string>,
  
  // 聊天响应
  chatResponse: Annotation<string>,
  
  // 工具循环计数（用于 ReAct 子图的硬上限控制）
  toolLoopCount: Annotation<number>({
    reducer: (_, newValue) => newValue,
    default: () => 0,
  }),
});

/**
 * 节点 0：意图分类器
 * 使用简单的 AI 调用判断用户意图
 */
async function classifierNode(
  state: typeof RequirementAnalysisState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof RequirementAnalysisState.State>> {
  const { model } = config;
  
  // #region agent log
  fetch('http://127.0.0.1:7439/ingest/d2836ca5-d253-4abc-ae4c-b65a3a5711c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28b230'},body:JSON.stringify({sessionId:'28b230',location:'requirement-analysis-graph.ts:78',message:'classifierNode 开始',data:{input:state.input.substring(0,100)},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const response = await model.invoke([
    {
      role: 'system',
      content: `判断用户意图，只返回一个词：
- analyze：用户想要分析需求（包含"分析"、"评估"、"设计"等关键词，或描述功能需求）
- query：用户想要查询已有需求的状态、信息（包含"查询"、"状态"、需求编号等）
- chat：普通闲聊、问候、无明确目的的对话

只返回 analyze、query 或 chat 三个词之一，不要有其他内容。`,
    },
    {
      role: 'user',
      content: state.input,
    },
  ]);
  
  // #region agent log
  fetch('http://127.0.0.1:7439/ingest/d2836ca5-d253-4abc-ae4c-b65a3a5711c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28b230'},body:JSON.stringify({sessionId:'28b230',location:'requirement-analysis-graph.ts:96',message:'classifierNode AI响应',data:{responseContent:response.content},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const content = (response.content as string).toLowerCase().trim();
  let intent: 'analyze' | 'query' | 'chat' = 'analyze';
  
  if (content.includes('query')) {
    intent = 'query';
  } else if (content.includes('chat')) {
    intent = 'chat';
  } else if (content.includes('analyze')) {
    intent = 'analyze';
  } else {
    // 关键词后备匹配
    const input = state.input.toLowerCase();
    if (input.includes('查询') || input.includes('状态') || /REQ-\d{8}-\d{3}/.test(input)) {
      intent = 'query';
    } else if (
      (input.includes('你好') || input.includes('天气') || input.includes('聊天')) &&
      !input.includes('分析') && !input.includes('需求') && !input.includes('评估')
    ) {
      intent = 'chat';
    }
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7439/ingest/d2836ca5-d253-4abc-ae4c-b65a3a5711c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28b230'},body:JSON.stringify({sessionId:'28b230',location:'requirement-analysis-graph.ts:121',message:'classifierNode 完成',data:{intent:intent},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  return { intent };
}

/**
 * 节点 1：需求提取
 * 从用户输入中提取结构化的需求信息
 */
async function extractNode(
  state: typeof RequirementAnalysisState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof RequirementAnalysisState.State>> {
  const { model } = config;
  
  // #region agent log
  fetch('http://127.0.0.1:7439/ingest/d2836ca5-d253-4abc-ae4c-b65a3a5711c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28b230'},body:JSON.stringify({sessionId:'28b230',location:'requirement-analysis-graph.ts:133',message:'extractNode 开始',data:{input:state.input.substring(0,50)},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  
  const extractAgent = createExtractAgent(model);
  
  const extractRaw = await extractAgent.invoke({ input: state.input });
  
  // #region agent log
  fetch('http://127.0.0.1:7439/ingest/d2836ca5-d253-4abc-ae4c-b65a3a5711c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28b230'},body:JSON.stringify({sessionId:'28b230',location:'requirement-analysis-graph.ts:143',message:'extractNode AI 完成',data:{rawLength:extractRaw.length},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  
  // 清洗 LLM 输出：移除 markdown 代码块和文本前缀
  let cleanExtract = extractRaw.trim();
  
  // 1. 尝试提取 markdown 代码块中的内容
  const fenceMatch = cleanExtract.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleanExtract = fenceMatch[1].trim();
  }
  
  // 2. 移除可能的文本前缀（如 "analyze{...}" 中的 "analyze"）
  // 查找第一个 { 或 [ 的位置
  const jsonStart = Math.min(
    cleanExtract.indexOf('{') !== -1 ? cleanExtract.indexOf('{') : Infinity,
    cleanExtract.indexOf('[') !== -1 ? cleanExtract.indexOf('[') : Infinity,
  );
  
  if (jsonStart !== Infinity && jsonStart > 0) {
    cleanExtract = cleanExtract.substring(jsonStart);
  }
  
  // 尝试解析 JSON
  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(cleanExtract);
  } catch (error) {
    console.error('[extractNode] JSON 解析失败:', error, '\n原始内容:', extractRaw);
    extracted = {
      isComplete: false,
      missingFields: ['JSON 解析失败，请重试'],
    };
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7439/ingest/d2836ca5-d253-4abc-ae4c-b65a3a5711c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28b230'},body:JSON.stringify({sessionId:'28b230',location:'requirement-analysis-graph.ts:163',message:'extractNode 完成',data:{hasExtracted:!!extracted},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  
  return { extracted };
}

/**
 * 节点 2：澄清判断
 * 判断是否需要向用户提问以获取更多信息
 */
async function clarifyNode(
  state: typeof RequirementAnalysisState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof RequirementAnalysisState.State>> {
  const { model } = config;
  const clarifyAgent = createClarifyAgent(model);
  
  const extractResultStr = JSON.stringify(state.extracted);
  const clarifyRaw = await clarifyAgent.invoke({
    extractResult: extractResultStr,
    input: state.input,
  });
  
  // 清洗 LLM 输出：移除 markdown 代码块和文本前缀
  let cleanClarify = clarifyRaw.trim();
  
  // 1. 尝试提取 markdown 代码块中的内容
  const fenceMatch = cleanClarify.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleanClarify = fenceMatch[1].trim();
  }
  
  // 2. 移除可能的文本前缀
  const jsonStart = Math.min(
    cleanClarify.indexOf('{') !== -1 ? cleanClarify.indexOf('{') : Infinity,
    cleanClarify.indexOf('[') !== -1 ? cleanClarify.indexOf('[') : Infinity,
  );
  
  if (jsonStart !== Infinity && jsonStart > 0) {
    cleanClarify = cleanClarify.substring(jsonStart);
  }
  
  // 尝试解析 JSON
  let clarified: { needsClarification: boolean; questions: string[] };
  try {
    clarified = JSON.parse(cleanClarify);
  } catch (error) {
    console.error('[clarifyNode] JSON 解析失败:', error, '\n原始内容:', clarifyRaw);
    clarified = { needsClarification: false, questions: [] };
  }
  
  return { clarified };
}

/**
 * 创建 ReAct 子图：用于需求分析
 * 支持循环调用工具进行多轮思考和信息收集
 */
function createAnalysisSubGraph(model: BaseChatModel) {
  /**
   * Agent 节点：思考节点
   * 模型负责判断是否需要调用工具，或直接输出分析结论
   */
  async function agentNode(
    state: typeof RequirementAnalysisState.State
  ): Promise<Partial<typeof RequirementAnalysisState.State>> {
    const modelWithTools = model.bindTools?.(analysisTools) || model;
    
    const response = await modelWithTools.invoke([
      {
        role: 'system',
        content: `你是需求分析专家。任务：对用户需求进行全面分析。

**工具使用策略**：
1. 如果需求中提到具体编号（如 REQ-XXX），先用 search_requirement 查询详情
2. 如果需要检测冲突（涉及登录、认证、权限等关键功能），调用 check_conflicts 工具
3. 获取足够信息后，直接输出分析结论，不再调用工具
4. 避免对相同参数重复调用同一工具

**分析输出要求**：
必须包含以下内容：

### 1. 功能分解
- 列出主要功能模块（至少3个）
- 每个模块的核心职责

### 2. 用户故事
- 至少3个典型使用场景
- 格式：作为[角色]，我想要[功能]，以便[目标]

### 3. 验收标准
- 每个功能的可测试标准
- 明确的输入输出要求

### 4. 技术复杂度评估
- 实现难度：低/中/高
- 关键技术点
- 潜在风险`,
      },
      ...state.messages,
      {
        role: 'user',
        content: `当前输入：${state.input}

已澄清信息：${JSON.stringify(state.clarified)}

已提取字段：${JSON.stringify(state.extracted)}`,
      },
    ]);
    
    console.log('[ReAct子图] agentNode 执行完成');
    return { messages: [response] };
  }

  /**
   * 条件边函数：判断是否需要调用工具
   */
  function shouldCallTools(
    state: typeof RequirementAnalysisState.State
  ): string {
    const lastMessage = state.messages.at(-1) as AIMessage;
    
    // 优先级 1：硬上限检查（防止无限循环）
    const toolMessages = state.messages.filter(
      (m: BaseMessage) => m._getType?.() === 'tool'
    );
    if (toolMessages.length >= 6) {
      console.log('[ReAct子图] 达到硬上限（6次工具调用），强制终止');
      return 'finalize';
    }
    
    // 优先级 2：检查是否有待执行的工具调用
    const hasToolCalls = lastMessage?.tool_calls && lastMessage.tool_calls.length > 0;
    if (hasToolCalls) {
      console.log(`[ReAct子图] 准备调用 ${lastMessage.tool_calls!.length} 个工具`);
      return 'tools';
    }
    
    // 优先级 3：无工具调用，进入finalize
    console.log('[ReAct子图] 无工具调用，准备输出最终结果');
    return 'finalize';
  }

  /**
   * Finalize 节点：结果提取节点
   * 从最后一条 AIMessage 中提取分析结果
   */
  async function finalizeNode(
    state: typeof RequirementAnalysisState.State
  ): Promise<Partial<typeof RequirementAnalysisState.State>> {
    const lastMessage = state.messages.at(-1);
    const content = (lastMessage?.content as string) ?? '';
    
    // 如果内容为空，提供降级输出
    if (!content.trim()) {
      console.warn('[ReAct子图] 警告：最终输出为空');
      return { 
        analysisResult: '⚠️ 分析未完成：未获取到有效输出。请检查工具调用是否成功，或需求描述是否完整。'
      };
    }
    
    console.log(`[ReAct子图] finalizeNode 完成，分析结果长度：${content.length}`);
    return { analysisResult: content };
  }

  // 构建并返回子图
  return new StateGraph(RequirementAnalysisState)
    .addNode('agent', agentNode)
    .addNode('tools', new ToolNode(analysisTools))
    .addNode('finalize', finalizeNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldCallTools, {
      tools: 'tools',
      finalize: 'finalize',
    })
    .addEdge('tools', 'agent')  // 关键：回边，形成循环
    .addEdge('finalize', END)
    .compile();
}

/**
 * 节点 3：多维度分析（旧版本，将被子图替换）
 * 对需求进行功能分解、用户故事、验收标准等多维度分析
 */
async function analysisNode(
  state: typeof RequirementAnalysisState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof RequirementAnalysisState.State>> {
  const { model } = config;
  const analysisAgent = createAnalysisAgent(model);
  
  const extractResultStr = JSON.stringify(state.extracted);
  const analysisResult = await analysisAgent.invoke({
    extractResult: extractResultStr,
    input: state.input,
  });
  
  return { analysisResult };
}

/**
 * 节点 4：风险评估
 * 识别需求中的模糊性、范围、技术、业务等风险
 */
async function riskNode(
  state: typeof RequirementAnalysisState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof RequirementAnalysisState.State>> {
  const { model } = config;
  const riskAgent = createRiskAgent(model);
  
  const extractResultStr = JSON.stringify(state.extracted);
  const riskResult = await riskAgent.invoke({
    extractResult: extractResultStr,
    input: state.input,
  });
  
  return { riskResult };
}

/**
 * 节点 5：综合报告
 * 基于所有分析结果生成最终的需求分析报告
 */
async function summaryNode(
  state: typeof RequirementAnalysisState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof RequirementAnalysisState.State>> {
  const { model } = config;
  const summaryAgent = createSummaryAgent(model);
  
  const extractResultStr = JSON.stringify(state.extracted);
  const summary = await summaryAgent.invoke({
    input: state.input,
    extractResult: extractResultStr,
    analysisResult: state.analysisResult,
    riskResult: state.riskResult,
    retrievedContext: state.retrievedContext || '无相关参考文档',
  });
  
  return { summary };
}

/**
 * 节点：查询处理器
 * 处理需求查询请求
 */
async function queryHandlerNode(
  state: typeof RequirementAnalysisState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof RequirementAnalysisState.State>> {
  const { model } = config;
  
  const response = await model.invoke([
    {
      role: 'system',
      content: '你是一个需求查询助手。根据用户的查询请求，提供需求的状态、进度等信息。',
    },
    {
      role: 'user',
      content: state.input,
    },
  ]);
  
  return { 
    queryResponse: response.content as string,
    summary: response.content as string, // 兼容旧接口
  };
}

/**
 * 节点：聊天处理器
 * 处理普通对话
 */
async function chatHandlerNode(
  state: typeof RequirementAnalysisState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof RequirementAnalysisState.State>> {
  const { model } = config;
  
  const response = await model.invoke([
    {
      role: 'system',
      content: '你是一个友好的 AI 助手。自然地回应用户的问候和闲聊。',
    },
    {
      role: 'user',
      content: state.input,
    },
  ]);
  
  return { 
    chatResponse: response.content as string,
    summary: response.content as string, // 兼容旧接口
  };
}

/**
 * 路由函数：根据 intent 决定下一个节点
 */
function routeByIntent(
  state: typeof RequirementAnalysisState.State,
): string {
  const intent = state.intent || 'analyze';
  
  switch (intent) {
    case 'query':
      return 'queryHandler';
    case 'chat':
      return 'chatHandler';
    case 'analyze':
    default:
      return 'extractStep';
  }
}

/**
 * 路由函数：根据澄清结果决定是否继续分析
 * 如果需要澄清，则直接结束；否则继续执行分析和风险评估
 */
function routeAfterClarify(
  state: typeof RequirementAnalysisState.State,
): string | string[] {
  // 检查是否需要澄清
  if (state.clarified?.needsClarification) {
    // 需要澄清，直接结束流程
    return END;
  }
  
  // 不需要澄清，继续并行执行分析和风险评估
  return ['analysisStep', 'riskStep'];
}

/**
 * 创建需求分析图（支持意图路由）
 * @param model LangChain 模型实例
 * @returns 编译后的 StateGraph
 */
export function createAnalysisGraph(model: BaseChatModel) {
  // 创建 ReAct 子图用于需求分析
  const analysisSubGraph = createAnalysisSubGraph(model);
  
  const graph = new StateGraph(RequirementAnalysisState)
    // 添加意图分类节点
    .addNode('classifier', (state) => classifierNode(state, { model }))
    
    // 添加原有的五个分析节点（注意：节点名不能与状态字段名冲突）
    .addNode('extractStep', (state) => extractNode(state, { model }))
    .addNode('clarifyStep', (state) => clarifyNode(state, { model }))
    // ⭐ 关键：将 analysisStep 替换为 ReAct 子图
    .addNode('analysisStep', analysisSubGraph)
    .addNode('riskStep', (state) => riskNode(state, { model }))
    .addNode('summaryStep', (state) => summaryNode(state, { model }))
    
    // 添加查询和聊天处理节点
    .addNode('queryHandler', (state) => queryHandlerNode(state, { model }))
    .addNode('chatHandler', (state) => chatHandlerNode(state, { model }))
    
    // 从 START 到 classifier
    .addEdge(START, 'classifier')
    
    // 条件边：从 classifier 根据 intent 路由
    .addConditionalEdges('classifier', routeByIntent)
    
    // 保留完整的分析链
    .addEdge('extractStep', 'clarifyStep')
    
    // 条件边：clarify 完成后根据是否需要澄清决定路由
    .addConditionalEdges('clarifyStep', routeAfterClarify)
    
    // 汇聚：analysis 和 risk 都完成后才执行 summary
    .addEdge('analysisStep', 'summaryStep')
    .addEdge('riskStep', 'summaryStep')
    
    .addEdge('summaryStep', END)
    
    // 查询和聊天直接结束
    .addEdge('queryHandler', END)
    .addEdge('chatHandler', END);
  
  // 编译图
  return graph.compile();
}

/**
 * 运行需求分析图的输入类型
 */
export interface RunAnalysisGraphInput {
  input: string;
  retrievedContext: string;
  model: BaseChatModel;
}

/**
 * 运行需求分析图的输出类型
 */
export interface RunAnalysisGraphOutput {
  intent?: 'analyze' | 'query' | 'chat';
  summary: string;
  extracted?: Record<string, unknown>;
  clarified?: { needsClarification: boolean; questions: string[] };
  analysisResult?: string;
  riskResult?: string;
  queryResponse?: string;
  chatResponse?: string;
  steps: Record<string, string>;
}

/**
 * 运行需求分析图
 * @param input 输入参数
 * @returns 包含 intent、summary 和中间步骤的结果
 */
export async function runAnalysisGraph(
  input: RunAnalysisGraphInput,
): Promise<RunAnalysisGraphOutput> {
  const { input: userInput, retrievedContext, model } = input;
  
  // #region agent log
  fetch('http://127.0.0.1:7439/ingest/d2836ca5-d253-4abc-ae4c-b65a3a5711c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28b230'},body:JSON.stringify({sessionId:'28b230',location:'requirement-analysis-graph.ts:397',message:'runAnalysisGraph 开始',data:{input:userInput.substring(0,100)},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // 创建图实例
  const graph = createAnalysisGraph(model);
  
  // 执行图
  const result = await graph.invoke({
    input: userInput,
    retrievedContext,
    messages: [],
  });
  
  // #region agent log
  fetch('http://127.0.0.1:7439/ingest/d2836ca5-d253-4abc-ae4c-b65a3a5711c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28b230'},body:JSON.stringify({sessionId:'28b230',location:'requirement-analysis-graph.ts:411',message:'graph.invoke 完成',data:{intent:result.intent,hasSummary:!!result.summary,hasQueryResponse:!!result.queryResponse,hasChatResponse:!!result.chatResponse},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // 构建步骤记录
  const steps: Record<string, string> = {
    intent: result.intent || 'analyze',
  };
  
  // 根据意图添加相应步骤
  if (result.intent === 'analyze') {
    steps.extract = JSON.stringify(result.extracted);
    steps.clarify = JSON.stringify(result.clarified);
    steps.analysis = result.analysisResult || '';
    steps.risk = result.riskResult || '';
    steps.summary = result.summary || '';
  } else if (result.intent === 'query') {
    steps.queryResponse = result.queryResponse || '';
  } else if (result.intent === 'chat') {
    steps.chatResponse = result.chatResponse || '';
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7439/ingest/d2836ca5-d253-4abc-ae4c-b65a3a5711c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28b230'},body:JSON.stringify({sessionId:'28b230',location:'requirement-analysis-graph.ts:436',message:'runAnalysisGraph 完成',data:{intent:result.intent,summaryLength:(result.summary||result.queryResponse||result.chatResponse||'').length},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // 返回结果
  return {
    intent: result.intent,
    summary: result.summary || result.queryResponse || result.chatResponse || '',
    extracted: result.extracted,
    clarified: result.clarified,
    analysisResult: result.analysisResult,
    riskResult: result.riskResult,
    queryResponse: result.queryResponse,
    chatResponse: result.chatResponse,
    steps,
  };
}

/**
 * 流式事件类型
 */
export type GraphStreamEvent = 
  | { type: 'node_start'; node: string }
  | { type: 'token'; content: string; node: string }
  | { type: 'node_end'; node: string; output: any }
  | { type: 'log'; level: 'info' | 'debug' | 'error'; message: string; data?: Record<string, any> }
  | { type: 'complete'; result: RunAnalysisGraphOutput };

/**
 * 流式运行需求分析图
 * 使用 LangGraph stream API 结合 streamEvents 实现真正的 token 级流式输出
 * 
 * @param input 输入参数
 * @returns AsyncGenerator 生成流式事件
 */
export async function* streamAnalysisGraph(
  input: RunAnalysisGraphInput,
): AsyncGenerator<GraphStreamEvent> {
  const { input: userInput, retrievedContext, model } = input;
  
  // Yield 日志事件
  yield {
    type: 'log',
    level: 'info',
    message: 'streamAnalysisGraph 开始',
    data: { input: userInput.substring(0, 100) },
  };
  
  // 创建图实例
  const graph = createAnalysisGraph(model);
  
  // 用于累积状态和步骤
  let finalState: typeof RequirementAnalysisState.State | null = null;
  const steps: Record<string, string> = {};
  const visitedNodes = new Set<string>();
  
  try {
    // 使用 stream 结合 streamEvents 获取完整的执行信息
    // 方案：并行运行两个流，一个获取状态更新，一个获取 token
    const streamPromise = (async () => {
      const chunks: any[] = [];
      for await (const chunk of await graph.stream(
        {
          input: userInput,
          retrievedContext,
          messages: [],
        },
        { streamMode: 'updates' }
      )) {
        chunks.push(chunk);
      }
      return chunks;
    })();
    
    // 使用 streamEvents 获取 token 级别的输出
    let currentNode: string | null = null;
    const eventStream = graph.streamEvents(
      {
        input: userInput,
        retrievedContext,
        messages: [],
      },
      { version: 'v2' }
    );
    
    for await (const event of eventStream) {
      // 监听节点开始事件
      if (event.event === 'on_chain_start') {
        const nodeName = event.name;
        
        // 过滤掉内部节点和非业务节点
        const internalNodes = [
          'RunnableSequence',
          'StateGraph',
          'LangGraph',
          'RunnableLambda',
          '__start__',
          '__end__'
        ];
        const isInternalNode = internalNodes.some(internal => nodeName?.includes(internal));
        
        if (nodeName && !isInternalNode && !visitedNodes.has(nodeName)) {
          visitedNodes.add(nodeName);
          currentNode = nodeName;
          yield {
            type: 'node_start',
            node: nodeName,
          };
          
          yield {
            type: 'log',
            level: 'debug',
            message: `节点开始: ${nodeName}`,
          };
        }
      }
      
      // 监听 LLM token 流式输出
      // 只流式发送 markdown 内容节点的输出，不发送 JSON 节点（extract、clarify）的输出
      if (event.event === 'on_chat_model_stream') {
        const chunk = event.data?.chunk;
        if (chunk?.content && typeof chunk.content === 'string' && currentNode) {
          // 过滤掉返回 JSON 的节点
          const jsonNodes = ['extractStep', 'clarifyStep', 'classifier'];
          const shouldStreamToken = !jsonNodes.includes(currentNode);
          
          if (shouldStreamToken) {
            yield {
              type: 'token',
              content: chunk.content,
              node: currentNode,
            };
          }
        }
      }
      
      // 监听节点完成事件
      if (event.event === 'on_chain_end') {
        const nodeName = event.name;
        
        // 只处理已记录的业务节点
        if (nodeName && visitedNodes.has(nodeName)) {
          const output = event.data?.output;
          
          yield {
            type: 'node_end',
            node: nodeName,
            output,
          };
          
          yield {
            type: 'log',
            level: 'debug',
            message: `节点完成: ${nodeName}`,
            data: { hasOutput: !!output },
          };
        }
      }
      
      // 监听整个 graph 完成（获取最终状态）
      if (event.event === 'on_chain_end' && event.name && event.name.includes('StateGraph')) {
        finalState = event.data?.output;
      }
    }
    
    // 等待 stream 完成以确保获取到最终状态
    await streamPromise;
    
    // 如果 finalState 还是 null，再次获取
    if (!finalState) {
      finalState = await graph.invoke({
        input: userInput,
        retrievedContext,
        messages: [],
      });
    }
    
    const result = finalState;
    
    yield {
      type: 'log',
      level: 'info',
      message: 'graph 执行完成',
      data: {
        intent: result.intent,
        hasSummary: !!result.summary,
        hasQueryResponse: !!result.queryResponse,
        hasChatResponse: !!result.chatResponse,
      },
    };
    
    // 构建步骤记录
    steps.intent = result.intent || 'analyze';
    
    // 检查是否需要澄清（短路逻辑）
    const needsClarification = result.clarified?.needsClarification === true;
    
    if (result.intent === 'analyze') {
      steps.extract = JSON.stringify(result.extracted);
      steps.clarify = JSON.stringify(result.clarified);
      
      // 只有在不需要澄清时才有后续步骤
      if (!needsClarification) {
        steps.analysis = result.analysisResult || '';
        steps.risk = result.riskResult || '';
        steps.summary = result.summary || '';
      }
    } else if (result.intent === 'query') {
      steps.queryResponse = result.queryResponse || '';
    } else if (result.intent === 'chat') {
      steps.chatResponse = result.chatResponse || '';
    }
    
    // 返回最终结果
    // 如果需要澄清，summary 应该包含澄清问题
    let summary = '';
    if (needsClarification && result.clarified?.questions && result.clarified.questions.length > 0) {
      // 格式化澄清问题 - 使用更友好的展示方式
      const questionList = result.clarified.questions
        .map((q, i) => `**${i + 1}.** ${q}`)
        .join('\n\n');
      
      summary = `## 📋 需要补充信息

为了更好地分析需求，还需要了解以下信息：

${questionList}

---

💡 **提示**：请补充上述信息后，我将继续为您生成完整的需求分析报告。`;
    } else {
      summary = result.summary || result.queryResponse || result.chatResponse || '';
    }
    
    const finalResult: RunAnalysisGraphOutput = {
      intent: result.intent,
      summary,
      extracted: result.extracted,
      clarified: result.clarified,
      analysisResult: result.analysisResult,
      riskResult: result.riskResult,
      queryResponse: result.queryResponse,
      chatResponse: result.chatResponse,
      steps,
    };
    
    yield {
      type: 'complete',
      result: finalResult,
    };
    
    yield {
      type: 'log',
      level: 'info',
      message: 'streamAnalysisGraph 完成',
      data: {
        intent: result.intent,
        summaryLength: (result.summary || result.queryResponse || result.chatResponse || '').length,
      },
    };
    
  } catch (error) {
    yield {
      type: 'log',
      level: 'error',
      message: 'streamAnalysisGraph 执行失败',
      data: { error: error instanceof Error ? error.message : String(error) },
    };
    
    throw error;
  }
}
