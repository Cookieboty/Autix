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
  const resultRecord = asRecord(result);
  const firstMessage = result.generations?.[0]?.[0]?.message;
  const messageRecord = asRecord(firstMessage);
  const responseMetadata = asRecord(messageRecord?.response_metadata);
  const raw =
    asRecord(resultRecord?.llmOutput)?.tokenUsage ??
    asRecord(resultRecord?.llmOutput)?.token_usage ??
    messageRecord?.usage_metadata ??
    responseMetadata?.tokenUsage ??
    responseMetadata?.token_usage;

  if (!raw || typeof raw !== 'object') return {};
  const usage = raw as Record<string, unknown>;
  return {
    inputTokens: numberOrUndefined(usage.input_tokens ?? usage.promptTokens ?? usage.prompt_tokens),
    outputTokens: numberOrUndefined(
      usage.output_tokens ?? usage.completionTokens ?? usage.completion_tokens,
    ),
    contextTokens: numberOrUndefined(usage.context_tokens ?? usage.total_tokens ?? usage.totalTokens),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
