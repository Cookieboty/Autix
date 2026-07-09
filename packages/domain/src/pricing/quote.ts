import { evaluatePricing } from './evaluate';
import type { Breakdown, PricingSchema } from './types';

export interface QuoteInput {
  modelSchema: PricingSchema;
  /** (任务 × 模型) 绑定倍率。 */
  multiplier: number;
  /** 已解析的折扣因子。0.6 = 六折。无折扣传 1。 */
  discountFactor: number;
  /** 任务侧固定开销 schema。求值输入是 usage，不是 params。 */
  taskFixedSchema?: PricingSchema | null;
  params: Record<string, unknown>;
  usage?: Record<string, unknown>;
}

export interface QuoteResult {
  /** 整数。写入 point_holds.estimatedAmount / confirmedAmount。 */
  total: number;
  /** 未取整的模型侧价格（已含倍率与折扣），供 breakdown 展示。 */
  modelSubtotalRaw: number;
  /** 未取整的任务侧开销。不受折扣影响。 */
  taskFixedCostRaw: number;
  breakdown: Breakdown[];
}

/** 写入 point_holds.pricingSnapshot，confirm 时原样读回。 */
export interface PricingSnapshot {
  schemaVersion: number;
  modelConfigId: string;
  modelSchema: PricingSchema;
  taskFixedSchema: PricingSchema | null;
  multiplier: number;
  discountFactor: number;
  discountCode: string | null;
  params: Record<string, unknown>;
}

const EMPTY: { total: number; breakdown: Breakdown[] } = { total: 0, breakdown: [] };

/**
 * total = ceil(模型价 × 倍率 × 折扣 + 任务固定开销)
 *
 * ceil 包住整个账单，只取整一次。它必须包住 taskFixedCost：
 * point_holds.estimatedAmount 是 Int，assertConfirmAmount() 拒绝小数，
 * 而 taskFixedCost 可以是 toolCalls × 0.5 这样的分数。
 *
 * taskFixedCost 仍不吃折扣——它在 discountFactor 的乘法之外，只是被同一个 ceil 包住。
 */
export function quoteTask(input: QuoteInput): QuoteResult {
  const model = evaluatePricing(input.modelSchema, input.params);
  const modelSubtotalRaw = model.total * input.multiplier * input.discountFactor;

  const task = input.taskFixedSchema
    ? evaluatePricing(input.taskFixedSchema, input.usage ?? {})
    : EMPTY;

  return {
    total: Math.ceil(modelSubtotalRaw + task.total),
    modelSubtotalRaw,
    taskFixedCostRaw: task.total,
    breakdown: [...model.breakdown, ...task.breakdown],
  };
}

/**
 * confirm 结算专用。schema / 倍率 / 折扣 / params 全部取自 hold 快照，
 * 只有 usage 用真实值。管理员改价永远不影响进行中的任务。
 *
 * usage 不能覆盖 params —— 两者是独立命名空间。否则结算时传一个
 * { quality: 'low' } 就能把已按 high 冻结的单子改便宜。
 */
export function quoteTaskFromSnapshot(
  snapshot: PricingSnapshot,
  usage: Record<string, unknown>,
): QuoteResult {
  return quoteTask({
    modelSchema: snapshot.modelSchema,
    multiplier: snapshot.multiplier,
    discountFactor: snapshot.discountFactor,
    taskFixedSchema: snapshot.taskFixedSchema,
    params: snapshot.params,
    usage,
  });
}
