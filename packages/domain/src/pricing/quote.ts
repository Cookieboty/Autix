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
 * 合并下单参数与结算用量,供模型侧求值。两者是独立命名空间且业务上不重叠——
 * `params` 是下单时确定并冻结的值(quality/resolution/seconds/referenceImages),
 * `usage` 是结算时才知道的真实值(inputTokens/outputTokens)。
 *
 * 键相交即拒绝,而不是静默以 usage 覆盖 params——这是"结算不能篡改下单参数"
 * 这条防篡改铁律的落地方式:结算时传一个 quality 会被拒绝,而不是被悄悄采纳。
 * 见 spec §3.1.1.65。
 */
function mergeParamsAndUsage(
  params: Record<string, unknown>,
  usage: Record<string, unknown>,
): Record<string, unknown> {
  const collisions = Object.keys(usage).filter((key) => key in params);
  if (collisions.length > 0) {
    throw new Error(
      `quoteTask: usage key(s) [${collisions.join(', ')}] collide with frozen params — settlement usage must not restate an order-time param`,
    );
  }
  return { ...params, ...usage };
}

/**
 * total = ceil(模型价 × 倍率 × 折扣 + 任务固定开销)
 *
 * ceil 包住整个账单，只取整一次。它必须包住 taskFixedCost：
 * point_holds.estimatedAmount 是 Int，assertConfirmAmount() 拒绝小数，
 * 而 taskFixedCost 可以是 toolCalls × 0.5 这样的分数。
 *
 * taskFixedCost 仍不吃折扣——它在 discountFactor 的乘法之外，只是被同一个 ceil 包住。
 *
 * 模型侧求值吃 params 与 usage 的合并结果(mergeParamsAndUsage)，不是只吃
 * params——text 模型的 inputTokens/outputTokens 是 valueSource: 'usage' 的
 * 模型侧计价项，只在结算时通过 usage 传入真实值；params 里冻结的估算值
 * (常为 0，见 applyParamDefaults 对 usage 来源参数的跳过)不能是唯一来源，
 * 否则每一次 text 结算都会按冻结的估算值计费（spec §3.1.1.65 记录的 bug）。
 */
export function quoteTask(input: QuoteInput): QuoteResult {
  const model = evaluatePricing(input.modelSchema, mergeParamsAndUsage(input.params, input.usage ?? {}));
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
