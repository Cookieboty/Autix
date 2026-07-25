import { affectedParams } from './introspect';
import type { DeriveFn, ParamsSchema, PricingSchema, Term, XUiControl, XUiRole } from './types';

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
    | 'PRICING_REFERENCES_UNKNOWN_PARAM'
    | 'UNKNOWN_X_UI_ROLE'
    | 'UNKNOWN_DERIVE_FN'
    | 'DERIVED_NEEDS_DERIVED_FROM'
    | 'DERIVED_FROM_UNKNOWN_PARAM'
    | 'DERIVED_FROM_SELF';
  message: string;
  termId?: string;
}

const CHOICE_CONTROLS: XUiControl[] = ['chips', 'select', 'size-grid'];
const RANGE_CONTROLS: XUiControl[] = ['slider', 'stepper'];

/** ajv 对 x-ui 内部零校验（validate-params.ts:26 的 addKeyword valid:true），
 *  这两张表是唯一拦得住取值拼错的地方。新增 role / 派生函数必须同步这里。 */
const X_UI_ROLES: XUiRole[] = ['pricing', 'wire', 'both', 'derived'];
const DERIVE_FNS: DeriveFn[] = ['imagePricingResolution'];

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
  return { code: 'MALFORMED_SCHEMA', message: `${subject} is not a valid object` };
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
    violations.push({ code: 'EMPTY_TERMS', message: 'pricingSchema requires at least one term' });
    return violations;
  }

  const seen = new Set<string>();
  for (let i = 0; i < schema.terms.length; i++) {
    const term = schema.terms[i];

    // Malformed term detection - single point of emission
    if (isMalformedTerm(term)) {
      violations.push({ code: 'MALFORMED_TERM', message: `terms[${i}] is not a valid object` });
      continue;
    }

    // First-term specific checks - only if first term and not malformed
    if (i === 0) {
      if (term.op !== 'add') {
        violations.push({
          code: 'FIRST_TERM_MUST_BE_ADD',
          message: 'The first term must be add — the accumulator starts from 0, and mul would make the entire total 0',
          termId: term.id,
        });
      }

      if (term.when) {
        violations.push({
          code: 'FIRST_TERM_MUST_BE_UNCONDITIONAL',
          message: 'The first term cannot have when — if the condition does not hold the accumulator stays at 0',
          termId: term.id,
        });
      }

      if (!('const' in term)) {
        violations.push({
          code: 'FIRST_TERM_MUST_BE_CONST',
          message: 'The first term value source must be const — a table lookup miss or a missing perUnit parameter would cause the term to be skipped',
          termId: term.id,
        });
      }
    }

    // Common checks for all terms
    if (seen.has(term.id)) {
      violations.push({ code: 'DUPLICATE_TERM_ID', message: `Duplicate term id: ${term.id}`, termId: term.id });
    }
    seen.add(term.id);

    if (sourceCount(term) !== 1) {
      violations.push({
        code: 'TERM_NEEDS_EXACTLY_ONE_SOURCE',
        message: 'A term must have exactly one value source: const / table / perUnit',
        termId: term.id,
      });
    }

    if ('perUnit' in term && term.perUnit.divisor === 0) {
      violations.push({ code: 'ZERO_DIVISOR', message: 'perUnit.divisor cannot be 0', termId: term.id });
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
        message: `properties[${name}] is not a valid object`,
        termId: name,
      });
      continue;
    }

    const ui = property['x-ui'];
    if (!ui) {
      violations.push({ code: 'MISSING_X_UI', message: `Parameter ${name} is missing x-ui`, termId: name });
      continue;
    }

    // ⚠ 这一段必须在下面 hidden 的 early-continue **之前**：derived 参数的 control
    // 恰恰就是 hidden（用户不选它，服务端算），放在后面这些校验永远跑不到。
    if (ui.role !== undefined && !X_UI_ROLES.includes(ui.role)) {
      violations.push({
        code: 'UNKNOWN_X_UI_ROLE',
        message: `Parameter ${name} has an invalid x-ui.role value: ${String(ui.role)}`,
        termId: name,
      });
    }

    if (ui.role === 'derived') {
      const derivedFrom = ui.derivedFrom;
      if (!derivedFrom) {
        violations.push({
          code: 'DERIVED_NEEDS_DERIVED_FROM',
          message: `Parameter ${name} declares role: derived but is missing derivedFrom`,
          termId: name,
        });
      } else {
        if (!DERIVE_FNS.includes(derivedFrom.via)) {
          violations.push({
            code: 'UNKNOWN_DERIVE_FN',
            message: `Parameter ${name} references a nonexistent derive function: ${String(derivedFrom.via)}`,
            termId: name,
          });
        }
        if (derivedFrom.param === name) {
          violations.push({
            code: 'DERIVED_FROM_SELF',
            message: `Parameter ${name}'s derivedFrom points to itself`,
            termId: name,
          });
        } else if (!(derivedFrom.param in (paramsSchema.properties ?? {}))) {
          violations.push({
            code: 'DERIVED_FROM_UNKNOWN_PARAM',
            message: `Parameter ${name}'s derivedFrom points to a nonexistent parameter: ${derivedFrom.param}`,
            termId: name,
          });
        }
      }
    }

    if (ui.control === 'hidden') continue;

    if (CHOICE_CONTROLS.includes(ui.control) && !property.enum) {
      violations.push({
        code: 'CHOICE_CONTROL_NEEDS_ENUM',
        message: `Parameter ${name}'s ${ui.control} control requires enum`,
        termId: name,
      });
    }
    if (
      RANGE_CONTROLS.includes(ui.control) &&
      (property.minimum === undefined || property.maximum === undefined)
    ) {
      violations.push({
        code: 'RANGE_CONTROL_NEEDS_BOUNDS',
        message: `Parameter ${name}'s ${ui.control} control requires minimum and maximum`,
        termId: name,
      });
    }
    if (ui.control === 'switch' && property.type !== 'boolean') {
      violations.push({
        code: 'SWITCH_NEEDS_BOOLEAN',
        message: `Parameter ${name}'s switch control requires type to be boolean`,
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
          message: `pricingSchema references a parameter that does not exist in paramsSchema: ${name}`,
          termId: name,
        });
      }
    }
  }

  return violations;
}
