/** 判断某条加热记录窗口所需字段（resource_boosts 行的子集）。 */
export interface BoostWindow {
  isActive: boolean;
  startsAt: Date;
  endsAt: Date;
}

/**
 * 判断一条加热记录在时刻 t 是否生效（gallery-design.md §十一）：
 * `isActive && startsAt <= t <= endsAt`。与 `boost.repository.ts#sumActiveByResource`
 * 的 DB where 子句语义保持一致，供 service 计算展示态 `isCurrentlyActive` 等纯逻辑复用。
 */
export function isBoostActiveAt(boost: BoostWindow, t: Date): boolean {
  return boost.isActive && boost.startsAt <= t && t <= boost.endsAt;
}
