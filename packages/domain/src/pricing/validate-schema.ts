import type { PricingSchema, Term } from './types';

export interface SchemaViolation {
  code:
    | 'EMPTY_TERMS'
    | 'FIRST_TERM_MUST_BE_ADD'
    | 'FIRST_TERM_MUST_BE_UNCONDITIONAL'
    | 'FIRST_TERM_MUST_BE_CONST'
    | 'DUPLICATE_TERM_ID'
    | 'TERM_NEEDS_EXACTLY_ONE_SOURCE'
    | 'ZERO_DIVISOR'
    | 'MALFORMED_TERM';
  message: string;
  termId?: string;
}

function sourceCount(term: Term): number {
  return (['const', 'table', 'perUnit'] as const).filter((key) => key in term).length;
}

/**
 * 保存 pricingSchema 前的结构校验。返回空数组表示合法。
 *
 * 首项的三条约束共同保证累加器一定拿到非零初值——累加器从 0 起步，
 * mul 作用在 0 上恒为 0。table / perUnit 型 term 可能因查表未命中或参数
 * 缺失而被跳过，只有 const 是无条件的。
 */
export function validatePricingSchema(schema: PricingSchema): SchemaViolation[] {
  const violations: SchemaViolation[] = [];

  if (!schema.terms || schema.terms.length === 0) {
    violations.push({ code: 'EMPTY_TERMS', message: 'pricingSchema 至少需要一个 term' });
    return violations;
  }

  const [first] = schema.terms;

  if (first === null || first === undefined || typeof first !== 'object') {
    violations.push({ code: 'MALFORMED_TERM', message: '首项不是有效的对象', termId: undefined });
  } else {
    if (first.op !== 'add') {
      violations.push({
        code: 'FIRST_TERM_MUST_BE_ADD',
        message: '首项必须是 add —— 累加器从 0 起步，mul 会把整单算成 0',
        termId: first.id,
      });
    }

    if (first.when) {
      violations.push({
        code: 'FIRST_TERM_MUST_BE_UNCONDITIONAL',
        message: '首项不能带 when —— 断言不成立时累加器会停在 0',
        termId: first.id,
      });
    }

    if (!('const' in first)) {
      violations.push({
        code: 'FIRST_TERM_MUST_BE_CONST',
        message: '首项取值源必须是 const —— table 查表未命中、perUnit 参数缺失时该项会被跳过',
        termId: first.id,
      });
    }
  }

  const seen = new Set<string>();
  for (const term of schema.terms) {
    if (term === null || term === undefined || typeof term !== 'object') {
      violations.push({ code: 'MALFORMED_TERM', message: 'term 不是有效的对象', termId: undefined });
      continue;
    }

    if (seen.has(term.id)) {
      violations.push({ code: 'DUPLICATE_TERM_ID', message: `term id 重复：${term.id}`, termId: term.id });
    }
    seen.add(term.id);

    if (sourceCount(term) !== 1) {
      violations.push({
        code: 'TERM_NEEDS_EXACTLY_ONE_SOURCE',
        message: 'term 必须恰好有一个取值源：const / table / perUnit',
        termId: term.id,
      });
    }

    if ('perUnit' in term && term.perUnit.divisor === 0) {
      violations.push({ code: 'ZERO_DIVISOR', message: 'perUnit.divisor 不能为 0', termId: term.id });
    }
  }

  return violations;
}
