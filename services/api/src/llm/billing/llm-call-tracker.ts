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
  pointCostWeight: number;
  basePerCall?: number;
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
    });

    try {
      const result = await originalGenerate(messages, options, runManager);
      await billing.confirm(holdId);
      return result;
    } catch (err) {
      await billing.refund(holdId);
      throw err;
    }
  };

  return proxy;
}
