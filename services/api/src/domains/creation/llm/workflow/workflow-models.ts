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
  pointCostWeight: number;
}

export type RuntimeModelConfigInput = Omit<RuntimeModelConfig, 'pointCostWeight'> & {
  pointCostWeight?: unknown;
};

export interface WorkflowModelFactories {
  createModel?: (config: RuntimeModelConfig) => BaseChatModel;
  createTracked?: (
    model: BaseChatModel,
    billing: CallBillingService,
    ctx: TrackerContext,
  ) => BaseChatModel;
}

export function toRuntimeModelConfig(config: RuntimeModelConfigInput): RuntimeModelConfig {
  return {
    ...config,
    pointCostWeight: Number(config.pointCostWeight ?? 1),
  };
}

export function resolveBillingTier(config: unknown): string | undefined {
  const metadata = config && typeof config === 'object'
    ? (config as { metadata?: unknown }).metadata
    : undefined;
  const tier = metadata && typeof metadata === 'object'
    ? (metadata as Record<string, unknown>).billingTier
    : undefined;
  return typeof tier === 'string' ? tier : undefined;
}

export function buildTrackerContext(opts: {
  userId: string;
  runId?: string;
  runStepId?: string;
  modelConfig: RuntimeModelConfig;
}): TrackerContext {
  return {
    userId: opts.userId,
    runId: opts.runId,
    runStepId: opts.runStepId,
    modelConfigId: opts.modelConfig.id,
    modelName: opts.modelConfig.model ?? opts.modelConfig.name,
    modelProvider: opts.modelConfig.provider,
    modelTier: resolveBillingTier(opts.modelConfig),
    pointCostWeight: opts.modelConfig.pointCostWeight,
  };
}

export function createTrackedWorkflowModel(
  opts: {
    billing: CallBillingService;
    modelConfig: RuntimeModelConfig;
    userId: string;
    runId?: string;
    runStepId?: string;
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
  });

  // 自有模型不再免费：工作流每步调用一律计费（tracked model）。
  return {
    baseModel,
    model: createTracked(baseModel, opts.billing, trackerContext),
    trackerContext,
  };
}
