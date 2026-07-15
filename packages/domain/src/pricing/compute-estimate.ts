import { applyParamDefaults } from './apply-param-defaults';
import { deriveParams } from './derive';
import { quoteTask } from './quote';
import { validateParams, type ParamViolation } from './validate-params';
import type { Breakdown, ParamsSchema, PricingSchema } from './types';

export interface ComputeTaskEstimateInput {
  pricingSchema: PricingSchema;
  paramsSchema: ParamsSchema;
  /** (任务 × 模型) 绑定倍率。 */
  multiplier: number;
  /** 已解析的折扣因子。0.6 = 六折。无折扣传 1。 */
  discountFactor: number;
  /** 任务侧固定开销 schema。图片任务为 null（无固定费）。 */
  taskFixedSchema?: PricingSchema | null;
  params: Record<string, unknown>;
  /** 文本模型的结算期 usage（token 数）。图片任务无 usage。 */
  usage?: Record<string, unknown>;
}

export interface ComputeTaskEstimateResult {
  /** 整数点数。violations 非空时无意义。 */
  total: number;
  breakdown: Breakdown[];
  /** applyParamDefaults → deriveParams 之后的参数；server 冻 PricingSnapshot、caller 复用。 */
  params: Record<string, unknown>;
  /** 非空 = 参数不合法：server 抛 400，前端把展示价置空。 */
  violations: ParamViolation[];
}

/**
 * 计价的**唯一**编排：`applyParamDefaults → deriveParams → validateParams → quoteTask`。
 *
 * 这是「展示 == 扣费」一致性的承重点：服务端 `TaskPricingEstimatorService.estimateCost`
 * 与前端本地估算**调同一段代码**，同输入必同输出（纯函数）。顺序即正确性（spec §6.2）：
 * derive 必须晚于 defaults、早于 validate/quote —— 派生值会覆盖调用方传值，早于校验会
 * 在派生前 400。
 *
 * 不抛异常（domain 层无 Nest）：参数不合法以 `violations` 返回，由调用方决定
 * （server 转 BadRequestException，前端置价为空）。
 */
export function computeTaskEstimate(
  input: ComputeTaskEstimateInput,
): ComputeTaskEstimateResult {
  const withDefaults = applyParamDefaults(input.paramsSchema, input.params);
  const params = deriveParams(input.paramsSchema, withDefaults);

  const violations = validateParams(input.paramsSchema, params);
  if (violations.length > 0) {
    return { total: 0, breakdown: [], params, violations };
  }

  const quote = quoteTask({
    modelSchema: input.pricingSchema,
    multiplier: input.multiplier,
    discountFactor: input.discountFactor,
    taskFixedSchema: input.taskFixedSchema ?? null,
    params,
    usage: input.usage,
  });

  return { total: quote.total, breakdown: quote.breakdown, params, violations: [] };
}
