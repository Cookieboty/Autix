import { quoteTask } from './quote';
import type { ParamsSchema, PricingSchema } from './types';

/**
 * 静态分析出哪些参数会影响价格。前端只给这些控件挂价格标签。
 * 这是有序 terms 相比表达式 DSL 的关键优势：结构可内省。
 */
export function affectedParams(schema: PricingSchema): string[] {
  const params: string[] = [];
  const push = (name: string) => {
    if (!params.includes(name)) params.push(name);
  };

  for (const term of schema.terms) {
    if ('table' in term) push(term.table.param);
    if ('perUnit' in term) push(term.perUnit.param);
    for (const clause of term.when?.all ?? []) push(clause.param);
  }

  return params;
}

export interface PriceOptionsContext {
  multiplier: number;
  discountFactor: number;
}

/**
 * 为每个「影响价格的 enum 参数」的每个候选值算出总价，供前端在控件上标价。
 *
 * 不计入 taskFixedCost：usage 在任务完成前不可知，且 taskFixedCost 是
 * 加性常量，不随 params 变化，对选项之间的相对价格没有影响。
 * 因此控件标价是模型侧价格，而非最终账单。
 *
 * 非 enum 参数（连续区间）不在此列——它们的价格由 UI 实时调 evaluatePricing 显示。
 */
export function priceOptions(
  paramsSchema: ParamsSchema,
  pricingSchema: PricingSchema,
  currentParams: Record<string, unknown>,
  ctx: PriceOptionsContext,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  for (const name of affectedParams(pricingSchema)) {
    const property = paramsSchema.properties[name];
    if (!property?.enum) continue;

    // role: 'wire' 的属性不参与计价 —— 给它算价签既无意义又会放大 quote 次数（spec 墙 8）
    if ((property['x-ui']?.role ?? 'both') === 'wire') continue;

    const prices: Record<string, number> = {};
    for (const candidate of property.enum) {
      prices[String(candidate)] = quoteTask({
        modelSchema: pricingSchema,
        multiplier: ctx.multiplier,
        discountFactor: ctx.discountFactor,
        params: { ...currentParams, [name]: candidate },
      }).total;
    }
    result[name] = prices;
  }

  return result;
}
