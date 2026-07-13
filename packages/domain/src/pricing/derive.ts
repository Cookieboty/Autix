import { resolveImagePricingResolution } from '../image/size-selection';
import type { DeriveFn, ParamsSchema } from './types';

/**
 * 派生函数注册表。**必须与 types.ts 的 `DeriveFn` 联合、以及 validate-schema.ts
 * 的 `DERIVE_FNS` 白名单三者同步** —— 新增一个派生函数要改三处。
 * （`Record<DeriveFn, ...>` 的标注是承重的：往 `DeriveFn` 加一个值而不在这里
 * 登记，tsc 就会报缺少属性。）
 *
 * 每个函数接收源参数的值（untyped，来自 HTTP body），返回派生值；
 * 无法派生时返回 `undefined`，此时该属性**缺席**（不是 null、不是空串）。
 */
const DERIVE_FNS: Record<DeriveFn, (sourceValue: unknown) => unknown> = {
  imagePricingResolution: (sourceValue) =>
    resolveImagePricingResolution(typeof sourceValue === 'string' ? sourceValue : undefined),
};

/**
 * 按每个属性自己的 `x-ui.derivedFrom` 算出派生参数，**覆盖调用方传来的任何值**。
 *
 * 必须在 `validateParams` **之前**跑（spec §6.2 的执行顺序）：
 *
 *     applyParamDefaults → deriveParams → validateParams → 投影
 *
 * 否则 `required: ['resolution']` 与「调用方不传 resolution」自相矛盾 —— 校验会先
 * 报缺少 resolution，派生根本没机会执行。
 *
 * 服务端扣费与前端 quote 预览两侧的顺序必须一致，否则前后端价格分裂。
 *
 * 覆盖是有意的（spec §6.3）：此前调用方直接把 resolution 传给 quote 接口，后端不
 * 校验它与 size 是否自洽 —— 传 size 4K + resolution 1K 就按 1K 收费。
 *
 * 派生函数**按属性声明选择，不按 modelFamily**（spec 口径 1、2）。
 */
export function deriveParams(
  schema: ParamsSchema,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const derived: Record<string, unknown> = { ...params };

  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    const ui = property['x-ui'];
    if (ui?.role !== 'derived') continue;

    const derivedFrom = ui.derivedFrom;
    // role: derived 但没有 derivedFrom 是 validateParamsSchema 该拦的事
    // （DERIVED_NEEDS_DERIVED_FROM）。这里只做防御：跳过，不抛。
    if (!derivedFrom) continue;

    const fn = DERIVE_FNS[derivedFrom.via];
    if (!fn) continue;

    const value = fn(derived[derivedFrom.param]);
    if (value === undefined) {
      // 源缺失或无法解析 → 派生值缺席，交给 validateParams 的 required 去报 400。
      // 绝不凭空造一个默认档位 —— 那会把一个本该 400 的请求变成静默按最低档收费。
      delete derived[name];
      continue;
    }
    derived[name] = value;
  }

  return derived;
}
