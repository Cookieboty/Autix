import type { ParamsSchema, XUiRole } from './types';

const WIRE_ROLES: ReadonlySet<XUiRole> = new Set<XUiRole>(['wire', 'both']);

/**
 * 上游投影：只保留会发给上游的参数（role ∈ {wire, both}）。
 *
 * 与计价投影（`stripNonPricingParams`，保留 pricing/both/derived）是**对偶**：
 *   - `derived` 只计价、绝不上线 —— 前端传什么都被服务端覆盖（spec §6.3）
 *   - `pricing` 只计价（referenceImages：上游要的是图本身，不是「几张」这个数）
 *   - schema 没声明的 key 一律丢弃 —— 否则 settings 袋里的任何脏字段
 *     （promptTuning / stylePreset / skipPromptTuning…）都会漏到上游
 *
 * **这是白名单，不是黑名单**：遍历的是 schema 的属性，不是 params 的键。
 * 缺省 role（未写 `x-ui.role`）= 'both'，向后兼容存量 schema。
 */
export function pickWireParams(
  schema: ParamsSchema,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (!(name in params)) continue;
    if (!WIRE_ROLES.has(property['x-ui']?.role ?? 'both')) continue;
    picked[name] = params[name];
  }
  return picked;
}
