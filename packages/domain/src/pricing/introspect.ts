import type { PricingSchema } from './types';

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
