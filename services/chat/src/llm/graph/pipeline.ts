/**
 * pipeline.ts
 *
 * 第九章 9.5：Plan-and-Execute + Reflexion 外层流水线
 * 用于处理跨工单的联合分析任务。
 * 外层包住 9.2/9.3 的完整分析图，planner 拆步骤 → executor 逐步调用 → evaluator 评估 → reflector 反思。
 */
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { createAnalysisGraph } from './requirement-analysis-graph';

// ---------------------------------------------------------------------------
// PipelineState
// ---------------------------------------------------------------------------

export interface PlanStep {
  id: string;
  description: string;
  done: boolean;
}

export const PipelineState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  plan: Annotation<PlanStep[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  currentStepIndex: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  stepResults: Annotation<Record<string, string>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  reflections: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  retryCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  parentThreadId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  finalReport: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  approved: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
});

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

const planSchema = z.object({
  steps: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
      }),
    )
    .min(1)
    .max(10),
  reasoning: z.string(),
});

export async function plannerNode(
  state: typeof PipelineState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof PipelineState.State>> {
  const { model } = config;
  const structured = model.withStructuredOutput(planSchema);

  const userInput = state.messages[0]?.content || '';

  const result = await structured.invoke([
    {
      role: 'system',
      content: `你是任务规划专家。将复杂的跨工单分析任务拆解为可执行的步骤。

**规则**：
1. 每个步骤应该是独立的、可执行的子任务
2. 步骤数量：最少 1 个，最多 10 个
3. 每个步骤的 description 应该是完整的、可直接传给需求分析系统的输入
4. 步骤之间应该有逻辑顺序（如先分析单个需求，再分析交叉影响）

**输出格式**：
- steps: 步骤数组，每项包含 id（唯一标识，如 "step-1"）和 description
- reasoning: 拆解的理由（为什么这样拆，每步做什么）`,
    },
    {
      role: 'user',
      content: `请将以下任务拆解为步骤：\n\n${userInput}`,
    },
  ]);

  const plan: PlanStep[] = result.steps.map((step) => ({
    ...step,
    done: false,
  }));

  console.log(`[Planner] 拆解为 ${plan.length} 个步骤：`);
  plan.forEach((step, i) => {
    console.log(
      `  ${i + 1}. ${step.id}: ${step.description.substring(0, 60)}...`,
    );
  });

  return {
    plan,
    currentStepIndex: 0,
    parentThreadId: state.parentThreadId || `pipeline-${Date.now()}`,
  };
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executorNode(
  state: typeof PipelineState.State,
  config: { analysisGraph: ReturnType<typeof createAnalysisGraph> },
): Promise<Partial<typeof PipelineState.State>> {
  const step = state.plan[state.currentStepIndex];
  if (!step) return {};

  const { analysisGraph } = config;

  console.log(
    `[Executor] 执行步骤 ${state.currentStepIndex + 1}/${state.plan.length}: ${step.description.substring(0, 80)}`,
  );

  try {
    const subResult = await analysisGraph.invoke(
      {
        input: step.description,
        retrievedContext: '',
        messages: [],
      },
      {
        configurable: {
          thread_id: `${state.parentThreadId}:step-${state.currentStepIndex}`,
        },
      },
    );

    const updatedPlan = [...state.plan];
    updatedPlan[state.currentStepIndex] = { ...step, done: true };

    return {
      plan: updatedPlan,
      stepResults: {
        [step.id]: subResult.summary || subResult.analysisResult || '(无输出)',
      },
      currentStepIndex: state.currentStepIndex + 1,
    };
  } catch (error) {
    console.error(`[Executor] 步骤 ${step.id} 执行失败:`, error);

    const updatedPlan = [...state.plan];
    updatedPlan[state.currentStepIndex] = { ...step, done: true };

    return {
      plan: updatedPlan,
      stepResults: {
        [step.id]: `[执行失败] ${error instanceof Error ? error.message : String(error)}`,
      },
      currentStepIndex: state.currentStepIndex + 1,
    };
  }
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

const evaluationSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(z.string()),
  suggestion: z.string(),
});

export async function evaluatorNode(
  state: typeof PipelineState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof PipelineState.State>> {
  const { model } = config;
  const structured = model.withStructuredOutput(evaluationSchema);

  const allResults = state.plan
    .map((step, i) => {
      const result = state.stepResults[step.id];
      return `### 步骤 ${i + 1}: ${step.description}\n结果：\n${result || '(未执行)'}`;
    })
    .join('\n\n---\n\n');

  const finalReport = `# 联合分析报告\n\n${allResults}`;

  const evaluation = await structured.invoke([
    {
      role: 'system',
      content: `你是质量评估专家。评估跨工单联合分析报告的完整性和质量。

**评分标准**（0-100分）：
- 80-100分：所有工单都分析完整，交叉影响清晰，结论明确 → approved: true
- 60-79分：基本完整但有遗漏，或部分结论不够深入 → approved: false
- 0-59分：重大遗漏或逻辑错误 → approved: false

**评估维度**：
1. 每个子任务是否都有对应的分析结果
2. 交叉影响分析是否充分（如有多个工单）
3. 结论是否可操作、具体

如果 approved 为 false，在 issues 中列出具体问题，在 suggestion 中给出改进建议。`,
    },
    {
      role: 'user',
      content: `请评估以下报告：\n\n${finalReport}`,
    },
  ]);

  console.log(
    `[Evaluator] 评分：${evaluation.score}/100, 通过：${evaluation.approved}`,
  );
  if (!evaluation.approved) {
    console.log(`[Evaluator] 问题：${evaluation.issues.join('; ')}`);
  }

  return {
    finalReport,
    approved: evaluation.approved,
  };
}

// ---------------------------------------------------------------------------
// Reflector
// ---------------------------------------------------------------------------

const reflectSchema = z.object({
  revisedSteps: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
      }),
    )
    .min(1)
    .max(10),
  reflection: z.string(),
});

export async function reflectorNode(
  state: typeof PipelineState.State,
  config: { model: BaseChatModel },
): Promise<Partial<typeof PipelineState.State>> {
  const { model } = config;
  const structured = model.withStructuredOutput(reflectSchema);

  const result = await structured.invoke([
    {
      role: 'system',
      content: `分析为什么总报告不达标。如果是前面步骤信息不足，修订计划（补充新步骤或调整现有步骤）；如果只是表达问题，返回原计划不变。

返回修订后的步骤列表和反思总结。`,
    },
    {
      role: 'user',
      content: `当前报告：\n${state.finalReport}\n\n当前计划：\n${JSON.stringify(state.plan, null, 2)}`,
    },
  ]);

  const newPlan: PlanStep[] = result.revisedSteps.map((s) => ({
    ...s,
    done: false,
  }));

  console.log(
    `[Reflector] 修订计划为 ${newPlan.length} 步，反思：${result.reflection.substring(0, 100)}`,
  );

  return {
    plan: newPlan,
    currentStepIndex: 0,
    reflections: [result.reflection],
    retryCount: state.retryCount + 1,
  };
}

// ---------------------------------------------------------------------------
// 路由函数
// ---------------------------------------------------------------------------

export function shouldContinue(
  state: typeof PipelineState.State,
): string {
  if (state.currentStepIndex < state.plan.length) {
    return 'executor';
  }
  return 'evaluator';
}

export function shouldReflect(
  state: typeof PipelineState.State,
): string {
  if (state.approved) {
    return END;
  }
  if (state.retryCount >= 1) {
    console.log('[Pipeline] 已达重试上限，强制结束');
    return END;
  }
  return 'reflector';
}

// ---------------------------------------------------------------------------
// Pipeline 图装配
// ---------------------------------------------------------------------------

export function createPipelineGraph(model: BaseChatModel) {
  const analysisGraph = createAnalysisGraph(model);

  return new StateGraph(PipelineState)
    .addNode('planner', (state) => plannerNode(state, { model }))
    .addNode('executor', (state) =>
      executorNode(state, { analysisGraph }),
    )
    .addNode('evaluator', (state) => evaluatorNode(state, { model }))
    .addNode('reflector', (state) => reflectorNode(state, { model }))
    .addEdge(START, 'planner')
    .addEdge('planner', 'executor')
    .addConditionalEdges('executor', shouldContinue, {
      executor: 'executor',
      evaluator: 'evaluator',
    })
    .addConditionalEdges('evaluator', shouldReflect, {
      reflector: 'reflector',
      [END]: END,
    })
    .addEdge('reflector', 'executor')
    .compile();
}
