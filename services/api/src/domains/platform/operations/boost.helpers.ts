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

/** 单条生效加热记录，用于按资源分组做衰减求和所需字段。 */
export interface ActiveBoostRow {
  resourceType: string;
  resourceId: string;
  boostScore: number;
  startsAt: Date;
  endsAt: Date;
}

/** 按资源分组衰减求和后的汇总。 */
export interface DecayedBoostSum {
  resourceType: string;
  resourceId: string;
  boostScore: number;
  expiresAt: Date;
}

/** 加热自身的半衰期（小时），与 `@autix/domain` 的 `HOT_WEIGHTS.boostHalfLifeHours` 保持一致。 */
export const BOOST_HALF_LIFE_HOURS = 24;

/**
 * P2：加热的时间衰减系数——`exp(-ln2 * ageHours / halfLifeHours)`，ageHours 是加热
 * 自身生效以来的时长（而非资源年龄，这点与 hot-score.ts#decayFactor 作用对象不同）。
 * 负的 ageHours（理论上不该出现，防御性处理）夹到 0，即刚生效时衰减系数为 1。
 */
export function boostDecayFactor(
  ageHours: number,
  halfLifeHours: number = BOOST_HALF_LIFE_HOURS,
): number {
  return Math.exp((-Math.LN2 * Math.max(ageHours, 0)) / halfLifeHours);
}

/**
 * P2：把"当前生效加热"按资源分组求和时，每条记录先按自身 age 做半衰期衰减再求和，
 * 而不是常量强度直到过期才骤然归零——cron（boost.cron.ts）每 ~10min 重跑一次
 * `aggregateActiveBoosts`，所以 resource_metrics.boostScore 会随时间平滑回落。
 * 分组内 expiresAt 取该组所有加热记录 endsAt 的最大值。
 */
export function decayedBoostSum(
  boosts: ActiveBoostRow[],
  now: Date,
): DecayedBoostSum[] {
  const groups = new Map<string, DecayedBoostSum>();
  for (const boost of boosts) {
    const ageHours = (now.getTime() - boost.startsAt.getTime()) / 3_600_000;
    const contribution = boost.boostScore * boostDecayFactor(ageHours);
    const key = `${boost.resourceType}:${boost.resourceId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.boostScore += contribution;
      if (boost.endsAt > existing.expiresAt) {
        existing.expiresAt = boost.endsAt;
      }
    } else {
      groups.set(key, {
        resourceType: boost.resourceType,
        resourceId: boost.resourceId,
        boostScore: contribution,
        expiresAt: boost.endsAt,
      });
    }
  }
  return [...groups.values()];
}
