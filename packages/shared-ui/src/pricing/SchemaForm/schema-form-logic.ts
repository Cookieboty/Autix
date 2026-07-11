import { applyParamDefaults, resolveConstraints } from '@autix/domain/pricing';
import type { ParamsSchema } from '@autix/domain/pricing';

/**
 * 委托给 domain 的 `applyParamDefaults`（zero-dep，前端可用）而不是自己重新实现
 * 一遍"哪些属性该被填默认值"的判断——尤其是 `x-ui.valueSource === 'usage'`
 * 的跳过规则（spec §3.1.1.65）：token 类参数只在结算时由 usage 注入，下单时
 * 填入 `inputTokens: 0` 会把这个 0 冻进 PricingSnapshot.params，导致每次结算
 * 都按 0 token 计价（真实生产事故）。见
 * packages/domain/src/pricing/apply-param-defaults.ts 的文档注释。
 */
export function fillDefaults(schema: ParamsSchema): Record<string, unknown> {
  return applyParamDefaults(schema, {});
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

// `constraint.enum` 是 `(string | number)[]`，而 params 里的值类型是 `unknown`——
// 用类型守卫而不是 `as string | number` 断言，避免"断言撒谎"（值实际是别的
// 类型时断言不报错，只是 `.includes` 静默返回 false，但至少类型层面不撒谎）。
function isEnumMember(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

// 必须和 resolveConstraints 的"后面的条目覆盖前面的"语义一致（见 constraints.ts
// 的文档注释）——否则钳制信息可能引用一个根本没有生效的边界（比如两个 allOf
// 条目都收窄同一个字段时，提示文案引用了第一个而不是实际生效的最后一个）。
// 因此这里不能在第一个匹配分支上 return，要遍历完所有分支，让最后一个匹配、
// 且确实覆盖了该字段的分支胜出。
function triggerLabelFor(schema: ParamsSchema, field: string, params: Record<string, unknown>): string | undefined {
  let trigger: string | undefined;
  for (const branch of (schema.allOf ?? []) as ConditionalBranch[]) {
    const guards = branch.if?.properties;
    if (!guards || !(field in (branch.then?.properties ?? {}))) continue;
    const matches = Object.entries(guards).every(([name, guard]) => params[name] === guard.const);
    if (matches) {
      const [, guard] = Object.entries(guards)[0];
      trigger = String(guard.const);
    }
  }
  return trigger;
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
  // 只保留单条 message：如果同一次调用里有两个字段同时被钳制（比如把
  // resolution 切到 4K 同时 seconds 和某个别的字段都越界），后一个覆盖前一个，
  // 调用方只会看到最后一条提示。目前的 UI 一次交互只钳制一个真正相关的字段
  // （被动连锁触发的场景很少见），这里不做多条消息聚合——如果未来出现真实的
  // "两个字段同时越界都需要提示"的场景，需要把 message 改成数组。
  let message: ClampMessage | undefined;

  for (const [field, constraint] of Object.entries(constraints)) {
    const value = next[field];

    if (constraint.enum) {
      if (value !== undefined && !(isEnumMember(value) && constraint.enum.includes(value))) {
        const fallback = schema.properties[field]?.default;
        next[field] = isEnumMember(fallback) && constraint.enum.includes(fallback)
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
    // x-ui.valueSource === 'usage'：和 applyParamDefaults 同样的跳过规则
    // （spec §3.1.1.65）。迁移绝不能把这类字段带进新 params——无论是保留旧值
    // 还是填新默认值——因为它们只在结算时由 usage 注入；带进 params 的任何
    // 值（哪怕是"沿用旧模型的 inputTokens"）都会被冻进快照，把这次结算的
    // token 计价锁死成一个陈旧/错误的数字。
    if (property['x-ui']?.valueSource === 'usage') continue;

    const oldValue = oldParams[name];
    const constraint = constraints[name];
    const stillValid =
      oldValue !== undefined &&
      (constraint?.enum ? isEnumMember(oldValue) && constraint.enum.includes(oldValue) : true) &&
      (typeof oldValue !== 'number' ||
        ((constraint?.minimum === undefined || oldValue >= constraint.minimum) &&
          (constraint?.maximum === undefined || oldValue <= constraint.maximum)));

    result[name] = stillValid ? oldValue : property.default;
  }

  return result;
}
