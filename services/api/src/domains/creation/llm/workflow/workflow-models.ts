import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { CallBillingService } from '../billing/call-billing.service';
import { createTrackedModel, type TrackerContext } from '../billing/llm-call-tracker';
import { createChatModelFromDbConfig } from '../model.factory';

export interface RuntimeModelConfig {
  id: string;
  name?: string;
  model: string;
  provider?: string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
  metadata?: unknown;
  type: string;
  createdBy?: string | null;
}

export type RuntimeModelConfigInput = RuntimeModelConfig;

export interface WorkflowModelFactories {
  createModel?: (config: RuntimeModelConfig) => BaseChatModel;
  createTracked?: (
    model: BaseChatModel,
    billing: CallBillingService,
    ctx: TrackerContext,
  ) => BaseChatModel;
}

// 这个函数以前会把旧的 model_configs.pointCostWeight 从 DB JSON 转成 number 并
// 冻结进 RuntimeModelConfig；该列已在第四期随旧计费引擎一起删除，现在这里只是把
// 入参原样传回——保留这个函数是为了不改所有调用点的调用形态
// （toRuntimeModelConfig(config) 仍然是把任意 DB 配置对象收窄成 RuntimeModelConfig 的唯一入口）。
export function toRuntimeModelConfig(config: RuntimeModelConfigInput): RuntimeModelConfig {
  return config;
}

export function buildTrackerContext(opts: {
  userId: string;
  runId?: string;
  runStepId?: string;
  modelConfig: RuntimeModelConfig;
  taskType: string;
}): TrackerContext {
  return {
    userId: opts.userId,
    runId: opts.runId,
    runStepId: opts.runStepId,
    modelConfigId: opts.modelConfig.id,
    modelName: opts.modelConfig.model ?? opts.modelConfig.name,
    modelProvider: opts.modelConfig.provider,
    taskType: opts.taskType,
  };
}

export function createTrackedWorkflowModel(
  opts: {
    billing: CallBillingService;
    modelConfig: RuntimeModelConfig;
    userId: string;
    runId?: string;
    runStepId?: string;
    taskType: string;
  },
  factories: WorkflowModelFactories = {},
): {
  baseModel: BaseChatModel;
  model: BaseChatModel;
  trackerContext: TrackerContext;
} {
  const createModel = factories.createModel ?? createChatModelFromDbConfig;
  const createTracked = factories.createTracked ?? createTrackedModel;
  const baseModel = createModel(opts.modelConfig);
  const trackerContext = buildTrackerContext({
    userId: opts.userId,
    runId: opts.runId,
    runStepId: opts.runStepId,
    modelConfig: opts.modelConfig,
    taskType: opts.taskType,
  });

  // 自有模型不再免费：工作流每步调用一律计费（tracked model）。
  return {
    baseModel,
    model: createTracked(baseModel, opts.billing, trackerContext),
    trackerContext,
  };
}
