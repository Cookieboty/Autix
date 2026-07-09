import type { ParamsSchema } from './types';

export interface ResolvedConstraint {
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
}

interface ConditionalBranch {
  if?: { properties?: Record<string, { const?: unknown }> };
  then?: { properties?: Record<string, ResolvedConstraint> };
}

function baseConstraints(schema: ParamsSchema): Record<string, ResolvedConstraint> {
  const result: Record<string, ResolvedConstraint> = {};
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    const constraint: ResolvedConstraint = {};
    if (property.enum) constraint.enum = property.enum;
    if (property.minimum !== undefined) constraint.minimum = property.minimum;
    if (property.maximum !== undefined) constraint.maximum = property.maximum;
    result[name] = constraint;
  }
  return result;
}

function branchMatches(
  branch: ConditionalBranch,
  params: Record<string, unknown>,
): boolean {
  const guards = branch.if?.properties;
  if (!guards) return false;
  return Object.entries(guards).every(([name, guard]) => params[name] === guard.const);
}

/**
 * 求解「依赖当前取值的约束」。UI 用它钳制控件边界（滑块/步进器的上下界）。
 *
 * 不用 ajv：ajv 只回答合不合法，不回答现在的上界是多少；且它压缩后约 120KB，
 * 而本函数要进前端包。服务端仍跑完整 ajv（validate-params.ts），
 * 本函数是 UI 辅助，不是校验，不能替代服务端校验。
 *
 * 支持的子集：allOf 数组，每项形如
 *   { if: { properties: { <param>: { const: <value> } } },
 *     then: { properties: { <param>: { maximum: ... } } } }
 * if 的守卫用严格相等匹配 params[param]；守卫参数缺失则不命中。
 * 一个 if 内多个守卫参数为合取（全部匹配才算命中）。
 * 命中的 then 覆盖对应参数的基础约束；按数组顺序，后面的条目覆盖前面的。
 * then 分支中可能出现的 `type` 字段（因为 ajv 在别处以严格模式运行）会被忽略，
 * 只取 enum / minimum / maximum。
 * 不支持 else、嵌套、跨参数比较。
 */
export function resolveConstraints(
  schema: ParamsSchema,
  params: Record<string, unknown>,
): Record<string, ResolvedConstraint> {
  const resolved = baseConstraints(schema);

  for (const branch of (schema.allOf ?? []) as ConditionalBranch[]) {
    if (!branchMatches(branch, params)) continue;

    for (const [name, override] of Object.entries(branch.then?.properties ?? {})) {
      const { enum: enumOverride, minimum: minimumOverride, maximum: maximumOverride } = override;
      const next: ResolvedConstraint = { ...resolved[name] };
      if (enumOverride !== undefined) next.enum = enumOverride;
      if (minimumOverride !== undefined) next.minimum = minimumOverride;
      if (maximumOverride !== undefined) next.maximum = maximumOverride;
      resolved[name] = next;
    }
  }

  return resolved;
}
