import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import type { ChatResult } from '@langchain/core/outputs';
import type { CallBillingService } from './call-billing.service';

export interface TrackerContext {
  userId: string;
  runId?: string;
  runStepId?: string;
  modelConfigId: string;
  modelName?: string;
  modelProvider?: string | null;
  modelTier?: string;
  pointCostWeight: number;
  basePerCall?: number;
  taskType?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  estimatedContextTokens?: number;
  toolCalls?: number;
}

/**
 * 包装任意 ChatModel，在每次 invoke/stream 前后执行 hold/confirm/refund。
 * 使用 Object.create 创建代理，不 mutate 原始（可能被缓存的）实例。
 */
export function createTrackedModel(
  model: BaseChatModel,
  billing: CallBillingService,
  ctx: TrackerContext,
): BaseChatModel {
  const basePerCall = ctx.basePerCall ?? 1;
  const pointsPerCall = Math.ceil(ctx.pointCostWeight * basePerCall);

  // Object.create 保证原始（缓存）实例的 _generate 不被 mutate
  const proxy = Object.create(model) as BaseChatModel;
  const originalGenerate = model._generate.bind(model);

  proxy._generate = async function (
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const { holdId } = await billing.hold(ctx.userId, pointsPerCall, {
      runId: ctx.runId,
      runStepId: ctx.runStepId,
      modelConfigId: ctx.modelConfigId,
      modelName: ctx.modelName,
      pricing: {
        taskType: ctx.taskType ?? resolveChatTaskType(ctx),
        modelProvider: ctx.modelProvider ?? undefined,
        modelName: ctx.modelName,
        modelTier: ctx.modelTier,
        inputTokens: ctx.estimatedInputTokens,
        outputTokens: ctx.estimatedOutputTokens,
        contextTokens: ctx.estimatedContextTokens,
        toolCalls: ctx.toolCalls,
      },
    });

    try {
      const result = await originalGenerate(messages, options, runManager);
      await billing.confirm(holdId, {
        taskType: ctx.taskType ?? resolveChatTaskType(ctx),
        modelProvider: ctx.modelProvider ?? undefined,
        modelName: ctx.modelName,
        modelTier: ctx.modelTier,
        ...extractTokenUsage(result),
        toolCalls: ctx.toolCalls,
      });
      return result;
    } catch (err) {
      await billing.refund(holdId);
      throw err;
    }
  };

  return proxy;
}

function resolveChatTaskType(ctx: TrackerContext): string {
  if (ctx.taskType) return ctx.taskType;
  const key = `${ctx.modelTier ?? ''} ${ctx.modelName ?? ''}`.toLowerCase();
  if (key.includes('reason') || key.includes('thinking') || key.includes('o1') || key.includes('o3')) {
    return 'chat_message_reasoning';
  }
  if (key.includes('fast') || key.includes('mini') || key.includes('flash')) {
    return 'chat_message_fast';
  }
  return 'chat_message_standard';
}

function extractTokenUsage(result: ChatResult) {
  const raw =
    (result as any).llmOutput?.tokenUsage ??
    (result as any).llmOutput?.token_usage ??
    (result.generations?.[0]?.[0]?.message as any)?.usage_metadata ??
    (result.generations?.[0]?.[0]?.message as any)?.response_metadata?.tokenUsage ??
    (result.generations?.[0]?.[0]?.message as any)?.response_metadata?.token_usage;

  if (!raw || typeof raw !== 'object') return {};
  return {
    inputTokens: numberOrUndefined(raw.input_tokens ?? raw.promptTokens ?? raw.prompt_tokens),
    outputTokens: numberOrUndefined(raw.output_tokens ?? raw.completionTokens ?? raw.completion_tokens),
    contextTokens: numberOrUndefined(raw.context_tokens ?? raw.total_tokens ?? raw.totalTokens),
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
