import type { Breakdown, EvalResult, PricingSchema, Term } from './types';

/**
 * 解析一个 term 的取值。返回 undefined 表示该 term 不适用，应整个跳过
 * （查表未命中且无 fallback、perUnit 的参数缺失）。
 */
function resolveTermValue(term: Term, params: Record<string, unknown>): number | undefined {
  if ('const' in term) return term.const;

  if ('table' in term) {
    const raw = params[term.table.param];
    if (raw === undefined || raw === null) return term.table.fallback;
    const hit = term.table.values[String(raw)];
    return hit === undefined ? term.table.fallback : hit;
  }

  return undefined;
}

export function evaluatePricing(
  schema: PricingSchema,
  params: Record<string, unknown>,
): EvalResult {
  let accumulator = 0;
  const breakdown: Breakdown[] = [];

  for (const term of schema.terms) {
    const contribution = resolveTermValue(term, params);
    if (contribution === undefined) continue;

    accumulator = term.op === 'add' ? accumulator + contribution : accumulator * contribution;
    breakdown.push({
      id: term.id,
      op: term.op,
      contribution,
      accumulatorAfter: accumulator,
    });
  }

  return { total: accumulator, breakdown };
}
