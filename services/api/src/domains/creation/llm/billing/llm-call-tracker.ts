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
  taskType: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  estimatedContextTokens?: number;
  toolCalls?: number;
  mcpCalls?: number;
  skillCalls?: number;
}

/**
 * 包装任意 ChatModel，在每次 invoke/stream 前后执行 hold/confirm/refund。
 * 使用 Object.create 创建代理，不 mutate 原始（可能被缓存的）实例。
 *
 * `taskType` 现在是 `TrackerContext` 的必填字段，由调用方显式声明——不再有
 * "按 modelTier/modelName 字符串猜档" 的 resolveChatTaskType，也不再有
 * pointCostWeight 兜底积分数：hold 的第二个参数固定传 0，真正的计费金额完全
 * 由 CallBillingService.hold 内部的定价引擎（taskType + modelConfigId 绑定）
 * 算出；查不到绑定就是 400，不会退回一个按权重算出的数字。
 */
export function createTrackedModel(
  model: BaseChatModel,
  billing: CallBillingService,
  ctx: TrackerContext,
): BaseChatModel {
  // Object.create 保证原始（缓存）实例的 _generate 不被 mutate
  const proxy = Object.create(model) as BaseChatModel;
  const originalGenerate = model._generate.bind(model);

  proxy._generate = async function (
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const { holdId } = await billing.hold(ctx.userId, 0, {
      runId: ctx.runId,
      runStepId: ctx.runStepId,
      modelConfigId: ctx.modelConfigId,
      modelName: ctx.modelName,
      pricing: {
        taskType: ctx.taskType,
        modelConfigId: ctx.modelConfigId,
        inputTokens: ctx.estimatedInputTokens,
        outputTokens: ctx.estimatedOutputTokens,
        contextTokens: ctx.estimatedContextTokens,
        toolCalls: ctx.toolCalls,
        mcpCalls: ctx.mcpCalls,
        skillCalls: ctx.skillCalls,
      },
    });

    try {
      const result = await originalGenerate(messages, options, runManager);
      await billing.confirm(holdId, {
        taskType: ctx.taskType,
        modelConfigId: ctx.modelConfigId,
        ...extractTokenUsage(result),
        toolCalls: ctx.toolCalls,
        mcpCalls: ctx.mcpCalls,
        skillCalls: ctx.skillCalls,
      });
      return result;
    } catch (err) {
      await billing.refund(holdId);
      throw err;
    }
  };

  return proxy;
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
