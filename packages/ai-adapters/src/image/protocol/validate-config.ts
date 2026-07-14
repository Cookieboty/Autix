import { resolveImagePricingResolution } from '@autix/domain/image';
import { readImageModelMetadata, type ImageOperation } from '@autix/domain/model';
import type { ParamsSchema, XUiRole } from '@autix/domain/pricing';
import { TRANSFORMS } from './transforms';
import type { BindingSpec, ParamStrategy, ProtocolPreset } from './types';

export interface ConfigViolation { code: string; message: string; param?: string }

const WIRE_ROLES: ReadonlySet<XUiRole> = new Set(['wire', 'both']);

/** 派生函数名 → 能否解析一个 token。规则 7 用它逐个校验源属性的 enum。 */
const CAN_PARSE: Record<string, (token: string) => boolean> = {
  imagePricingResolution: (token) => resolveImagePricingResolution(token) !== undefined,
};

function isStrategy(b: unknown): b is ParamStrategy {
  return typeof b === 'object' && b !== null && 'strategy' in b;
}

export function validateModelProtocolConfig(input: {
  paramsSchema: ParamsSchema;
  metadata: unknown;
  preset: ProtocolPreset | undefined;
}): ConfigViolation[] {
  const violations: ConfigViolation[] = [];
  const { paramsSchema, preset } = input;
  const meta = readImageModelMetadata(input.metadata);
  const properties = paramsSchema.properties ?? {};

  // 规则 5：协议存在性
  if (!preset) {
    violations.push({
      code: 'UNKNOWN_PROTOCOL_KEY',
      message: `metadata.protocolKey "${meta.protocolKey ?? '(missing)'}" resolves to no registered preset`,
    });
    return violations;   // 没有 preset，后面 6 条都无从谈起
  }

  const operations: ImageOperation[] = meta.operations ?? [];

  // 规则 1a：正向闭合
  for (const [name, property] of Object.entries(properties)) {
    const role = property['x-ui']?.role ?? 'both';
    if (!WIRE_ROLES.has(role)) continue;
    if (preset.paramBindings[name] === undefined) {
      violations.push({
        code: 'WIRE_PARAM_NOT_BOUND', param: name,
        message: `param "${name}" (role: ${role}) has no binding in preset "${preset.key}" — it would be silently dropped`,
      });
    }
  }

  // 规则 1b + 规则 4
  for (const [name, binding] of Object.entries(preset.paramBindings)) {
    const property = properties[name];
    if (!property) {
      violations.push({
        code: 'BINDING_TARGETS_UNKNOWN_PARAM', param: name,
        message: `preset "${preset.key}" binds "${name}", which does not exist in this model's paramsSchema — the binding never fires`,
      });
      continue;
    }
    if ((property['x-ui']?.role ?? 'both') === 'derived') {
      violations.push({
        code: 'BINDING_TARGETS_DERIVED_PARAM', param: name,
        message: `preset "${preset.key}" binds derived param "${name}" — derived params are priced, never sent upstream`,
      });
    }
    if (isStrategy(binding)) continue;
    for (const spec of (Array.isArray(binding) ? binding : [binding]) as BindingSpec[]) {
      if (spec.transform && !(spec.transform in TRANSFORMS)) {
        violations.push({
          code: 'UNKNOWN_TRANSFORM', param: name,
          message: `binding for "${name}" uses unknown transform "${spec.transform}"`,
        });
      }
    }
  }

  // 规则 2 + 规则 6
  for (const op of operations) {
    if (!preset.endpoints[op]) {
      violations.push({
        code: 'OPERATION_NOT_IMPLEMENTED',
        message: `metadata.operations declares "${op}" but preset "${preset.key}" has no endpoints.${op}`,
      });
    }
    const core = preset.coreBindings[op];
    if (!core) {
      violations.push({
        code: 'MISSING_CORE_BINDING',
        message: `preset "${preset.key}" has no coreBindings.${op}`,
      });
      continue;
    }
    if (op === 'edit' && !core.inputImages) {
      violations.push({
        code: 'MISSING_CORE_BINDING',
        message: `preset "${preset.key}" coreBindings.edit is missing the inputImages binding`,
      });
    }
  }
  if (operations.includes('edit') && !properties.referenceImages) {
    violations.push({
      code: 'EDIT_NEEDS_REFERENCE_IMAGES',
      message: 'metadata.operations includes "edit" but paramsSchema has no referenceImages property',
    });
  }

  // 规则 7：token 可解析性 —— 每一个，不是「大多数」
  for (const [name, property] of Object.entries(properties)) {
    const derivedFrom = property['x-ui']?.derivedFrom;
    if (!derivedFrom) continue;
    const canParse = CAN_PARSE[derivedFrom.via];
    if (!canParse) continue;   // 未知 via 由 validateParamsSchema 拦（UNKNOWN_DERIVE_FN）
    const source = properties[derivedFrom.param];
    for (const token of source?.enum ?? []) {
      if (!canParse(String(token))) {
        violations.push({
          code: 'UNPARSEABLE_SOURCE_TOKEN', param: derivedFrom.param,
          message: `"${name}" derives from "${derivedFrom.param}" via ${derivedFrom.via}, but token "${token}" is unparseable — it would silently fall back to a default tier`,
        });
      }
    }
  }

  return violations;
}
