import { affectedParams } from './introspect';
import type { ParamsSchema, PricingSchema, Term, XUiControl } from './types';

export interface SchemaViolation {
  code:
    | 'EMPTY_TERMS'
    | 'FIRST_TERM_MUST_BE_ADD'
    | 'FIRST_TERM_MUST_BE_UNCONDITIONAL'
    | 'FIRST_TERM_MUST_BE_CONST'
    | 'DUPLICATE_TERM_ID'
    | 'TERM_NEEDS_EXACTLY_ONE_SOURCE'
    | 'ZERO_DIVISOR'
    | 'MALFORMED_TERM'
    | 'MALFORMED_PROPERTY'
    | 'MALFORMED_SCHEMA'
    | 'MISSING_X_UI'
    | 'CHOICE_CONTROL_NEEDS_ENUM'
    | 'RANGE_CONTROL_NEEDS_BOUNDS'
    | 'SWITCH_NEEDS_BOOLEAN'
    | 'PRICING_REFERENCES_UNKNOWN_PARAM';
  message: string;
  termId?: string;
}

const CHOICE_CONTROLS: XUiControl[] = ['chips', 'select'];
const RANGE_CONTROLS: XUiControl[] = ['slider', 'stepper'];

function sourceCount(term: Term): number {
  return (['const', 'table', 'perUnit'] as const).filter((key) => key in term).length;
}

function isMalformedTerm(term: unknown): boolean {
  return term === null || term === undefined || typeof term !== 'object';
}

function isMalformedValue(value: unknown): boolean {
  return value === null || value === undefined || typeof value !== 'object';
}

/**
 * 顶层 schema 本身的健全性检查。model_configs.paramsSchema / pricingSchema
 * 在数据库里是可空的 Json? 列——NULL 是"尚未配置"的合法状态，不是异常。
 * 校验器的职责就是拒绝垃圾输入，绝不能在解引用垃圾时抛出。
 */
function isMalformedSchema(schema: unknown): boolean {
  return schema === null || schema === undefined || typeof schema !== 'object' || Array.isArray(schema);
}

/**
 * 唯一的 MALFORMED_SCHEMA 违规发射点，三处调用方共用（pricingSchema 主参数、
 * paramsSchema 主参数、paramsSchema 的可选 pricingSchema 交叉校验参数），
 * 避免同一违规码的字面量在文件中重复出现。
 */
function malformedSchemaViolation(subject: string): SchemaViolation {
  return { code: 'MALFORMED_SCHEMA', message: `${subject} 不是有效的对象` };
}

/**
 * 保存 pricingSchema 前的结构校验。返回空数组表示合法。
 *
 * 首项的三条约束共同保证累加器一定拿到非零初值——累加器从 0 起步，
 * mul 作用在 0 上恒为 0。table / perUnit 型 term 可能因查表未命中或参数
 * 缺失而被跳过，只有 const 是无条件的。
 */
export function validatePricingSchema(schema: PricingSchema): SchemaViolation[] {
  if (isMalformedSchema(schema)) {
    return [malformedSchemaViolation('pricingSchema')];
  }

  const violations: SchemaViolation[] = [];

  if (!schema.terms || schema.terms.length === 0) {
    violations.push({ code: 'EMPTY_TERMS', message: 'pricingSchema 至少需要一个 term' });
    return violations;
  }

  const seen = new Set<string>();
  for (let i = 0; i < schema.terms.length; i++) {
    const term = schema.terms[i];

    // Malformed term detection - single point of emission
    if (isMalformedTerm(term)) {
      violations.push({ code: 'MALFORMED_TERM', message: `terms[${i}] 不是有效的对象` });
      continue;
    }

    // First-term specific checks - only if first term and not malformed
    if (i === 0) {
      if (term.op !== 'add') {
        violations.push({
          code: 'FIRST_TERM_MUST_BE_ADD',
          message: '首项必须是 add —— 累加器从 0 起步，mul 会把整单算成 0',
          termId: term.id,
        });
      }

      if (term.when) {
        violations.push({
          code: 'FIRST_TERM_MUST_BE_UNCONDITIONAL',
          message: '首项不能带 when —— 断言不成立时累加器会停在 0',
          termId: term.id,
        });
      }

      if (!('const' in term)) {
        violations.push({
          code: 'FIRST_TERM_MUST_BE_CONST',
          message: '首项取值源必须是 const —— table 查表未命中、perUnit 参数缺失时该项会被跳过',
          termId: term.id,
        });
      }
    }

    // Common checks for all terms
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

/**
 * 校验 paramsSchema 的控件契约。传入 pricingSchema 时额外校验跨 schema 引用完整性。
 *
 * 跨 schema 校验是必需的：pricingSchema 引用一个不存在的参数时，
 * 该 term 会因查表/取参失败而被静默跳过——价格不变，没有报错，
 * 管理员以为改价生效了。
 */
export function validateParamsSchema(
  paramsSchema: ParamsSchema,
  pricingSchema?: PricingSchema,
): SchemaViolation[] {
  if (isMalformedSchema(paramsSchema)) {
    return [malformedSchemaViolation('paramsSchema')];
  }

  const violations: SchemaViolation[] = [];

  for (const [name, property] of Object.entries(paramsSchema.properties ?? {})) {
    // Malformed property detection - single point of emission
    if (isMalformedValue(property)) {
      violations.push({
        code: 'MALFORMED_PROPERTY',
        message: `properties[${name}] 不是有效的对象`,
        termId: name,
      });
      continue;
    }

    const ui = property['x-ui'];
    if (!ui) {
      violations.push({ code: 'MISSING_X_UI', message: `参数 ${name} 缺少 x-ui`, termId: name });
      continue;
    }
    if (ui.control === 'hidden') continue;

    if (CHOICE_CONTROLS.includes(ui.control) && !property.enum) {
      violations.push({
        code: 'CHOICE_CONTROL_NEEDS_ENUM',
        message: `参数 ${name} 的 ${ui.control} 控件需要 enum`,
        termId: name,
      });
    }
    if (
      RANGE_CONTROLS.includes(ui.control) &&
      (property.minimum === undefined || property.maximum === undefined)
    ) {
      violations.push({
        code: 'RANGE_CONTROL_NEEDS_BOUNDS',
        message: `参数 ${name} 的 ${ui.control} 控件需要 minimum 与 maximum`,
        termId: name,
      });
    }
    if (ui.control === 'switch' && property.type !== 'boolean') {
      violations.push({
        code: 'SWITCH_NEEDS_BOOLEAN',
        message: `参数 ${name} 的 switch 控件要求 type 为 boolean`,
        termId: name,
      });
    }
  }

  if (pricingSchema !== undefined) {
    if (isMalformedSchema(pricingSchema)) {
      violations.push(malformedSchemaViolation('pricingSchema'));
      return violations;
    }

    for (const name of affectedParams(pricingSchema)) {
      if (!(name in (paramsSchema.properties ?? {}))) {
        violations.push({
          code: 'PRICING_REFERENCES_UNKNOWN_PARAM',
          message: `pricingSchema 引用了 paramsSchema 中不存在的参数：${name}`,
          termId: name,
        });
      }
    }
  }

  return violations;
}
