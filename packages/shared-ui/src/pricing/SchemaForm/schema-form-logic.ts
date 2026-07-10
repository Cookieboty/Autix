import { resolveConstraints } from '@autix/domain/pricing';
import type { ParamsSchema } from '@autix/domain/pricing';

export function fillDefaults(schema: ParamsSchema): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (property.default !== undefined) params[name] = property.default;
  }
  return params;
}

export interface ClampMessage {
  field: string;
  text: string;
}

export interface ClampResult {
  params: Record<string, unknown>;
  message?: ClampMessage;
}

interface ConditionalBranch {
  if?: { properties?: Record<string, { const?: unknown }> };
  then?: { properties?: Record<string, { maximum?: number; minimum?: number; enum?: (string | number)[] }> };
}

function triggerLabelFor(schema: ParamsSchema, field: string, params: Record<string, unknown>): string | undefined {
  for (const branch of (schema.allOf ?? []) as ConditionalBranch[]) {
    const guards = branch.if?.properties;
    if (!guards || !(field in (branch.then?.properties ?? {}))) continue;
    const matches = Object.entries(guards).every(([name, guard]) => params[name] === guard.const);
    if (matches) {
      const [, guard] = Object.entries(guards)[0];
      return String(guard.const);
    }
  }
  return undefined;
}

// 已知限制：单位硬编码为"秒"，因为 ParamsSchema 没有 unit 字段。当前唯一用到
// allOf 收窄的场景是视频时长，这个限制不影响现有 9 个任务。见 phase-3 计划 Task 3b。
function clampMessageText(
  schema: ParamsSchema,
  field: string,
  bound: number,
  params: Record<string, unknown>,
  kind: 'max' | 'min' = 'max',
): string {
  const trigger = triggerLabelFor(schema, field, params);
  const prefix = trigger ? `${trigger} ` : '';
  return kind === 'max' ? `${prefix}最长 ${bound} 秒` : `${prefix}最少 ${bound} 秒`;
}

/**
 * 同步钳制——必须在 onChange 内调用，不能放进 useEffect。否则用户能看到一个
 * 已经越界的值（比如 4K 下的 12 秒）并按下生成，钳制要等下一帧才生效，
 * 产生"看到的值和实际提交的值不一致"的竞态。
 *
 * 数值型（minimum/maximum）：钳制到边界，附一条提示。
 * 枚举型：新值不在收窄后的候选集里 -> 回退 default；default 也不在 -> 取候选集第一个。
 */
export function clampOnChange(
  schema: ParamsSchema,
  currentParams: Record<string, unknown>,
  changedField: string,
  changedValue: unknown,
): ClampResult {
  const next = { ...currentParams, [changedField]: changedValue };
  const constraints = resolveConstraints(schema, next);
  let message: ClampMessage | undefined;

  for (const [field, constraint] of Object.entries(constraints)) {
    const value = next[field];

    if (constraint.enum) {
      if (value !== undefined && !constraint.enum.includes(value as string | number)) {
        const fallback = schema.properties[field]?.default;
        next[field] = constraint.enum.includes(fallback as string | number)
          ? fallback
          : constraint.enum[0];
      }
      continue;
    }

    if (typeof value !== 'number') continue;

    if (constraint.maximum !== undefined && value > constraint.maximum) {
      next[field] = constraint.maximum;
      message = { field, text: clampMessageText(schema, field, constraint.maximum, next) };
    } else if (constraint.minimum !== undefined && value < constraint.minimum) {
      next[field] = constraint.minimum;
      message = { field, text: clampMessageText(schema, field, constraint.minimum, next, 'min') };
    }
  }

  return { params: next, message };
}

/**
 * 切换模型时的参数迁移。规则（spec §6.5）：
 * 1. 新 schema 的每个属性，若旧 params 有同名键且值通过新 schema 的
 *    resolveConstraints 校验，保留
 * 2. 否则用新 schema 的 default
 * 3. 旧 params 中新 schema 没有的键，丢弃
 *
 * 不做跨模型语义映射（不把 1024x1024 翻译成 1K）——那是 capabilities.ts
 * 时代的复杂度来源，YAGNI。
 */
export function migrateParams(
  oldSchema: ParamsSchema | undefined,
  newSchema: ParamsSchema,
  oldParams: Record<string, unknown>,
): Record<string, unknown> {
  void oldSchema; // 保留参数是为了让调用方语义清晰（"从哪个 schema 迁移"），迁移规则本身不需要旧 schema 的结构。
  const constraints = resolveConstraints(newSchema, oldParams);
  const result: Record<string, unknown> = {};

  for (const [name, property] of Object.entries(newSchema.properties ?? {})) {
    const oldValue = oldParams[name];
    const constraint = constraints[name];
    const stillValid =
      oldValue !== undefined &&
      (constraint?.enum ? constraint.enum.includes(oldValue as string | number) : true) &&
      (typeof oldValue !== 'number' ||
        ((constraint?.minimum === undefined || oldValue >= constraint.minimum) &&
          (constraint?.maximum === undefined || oldValue <= constraint.maximum)));

    result[name] = stillValid ? oldValue : property.default;
  }

  return result;
}
