export interface DiscountScope {
  /**
   * 会员等级序号，对应 membership_levels.level（Int）。非会员为 0。
   * 不是 model_config_membership_levels.levelId 那个 cuid——两者是完全不同的标识，
   * 命名带 Numbers 后缀就是为了在 code review 阶段暴露这个混淆。
   */
  membershipLevelNumbers?: number[];
  taskTypes?: string[];
  modelConfigIds?: string[];
}

export interface DiscountRow {
  id: string;
  code: string;
  factor: number;
  scope: DiscountScope;
  stackable: boolean;
  priority: number;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  isActive: boolean;
}

export interface DiscountContext {
  membershipLevel: number;
  taskType: string;
  modelConfigId: string;
}

/**
 * 某个 scope 维度是否限制了给定值。
 *
 * 字段缺失（undefined）＝该维度无限制，任意值都算命中；
 * 字段为空数组（[]）＝该维度限制为空集合，任何值都不命中。
 * 这两者语义完全不同，绝不能混淆——调用方传一个漏填的 scope（undefined）
 * 不应等价于故意传一个空数组（拒绝所有）。
 */
function matchesDimension<T>(allowed: T[] | undefined, value: T): boolean {
  if (allowed === undefined) return true;
  return allowed.includes(value);
}

/**
 * 判断某条折扣在给定上下文和时间点是否适用。
 *
 * 日期过滤：调用方（TaskPricingRepository.findActiveDiscounts）已经在数据库层面
 * 按 effectiveFrom/effectiveTo 过滤了候选行，这里的时间校验是防御性的二次校验
 * （保证本函数在任意输入下都是自洽的纯函数，不依赖调用方总是正确过滤），
 * 不是本函数的主要职责，也不重复实现仓储层的查询逻辑。
 */
export function discountApplies(discount: DiscountRow, ctx: DiscountContext, now: Date): boolean {
  if (!discount.isActive) return false;
  if (discount.effectiveFrom && discount.effectiveFrom > now) return false;
  if (discount.effectiveTo && discount.effectiveTo <= now) return false;

  const scope = discount.scope ?? {};
  if (!matchesDimension(scope.membershipLevelNumbers, ctx.membershipLevel)) return false;
  if (!matchesDimension(scope.taskTypes, ctx.taskType)) return false;
  if (!matchesDimension(scope.modelConfigIds, ctx.modelConfigId)) return false;

  return true;
}

/**
 * 折扣叠加规则（spec §2.1，§3.4）：
 * 1. 命中的折扣中，stackable: false 的取 factor 最小的一个（对用户最优）——
 *    按 factor 挑选，而非按 priority 或数组顺序。
 * 2. stackable: true 的折扣在第 1 步的结果基础上连乘。
 * 3. 都没有命中时，factor 为 1（无折扣）。
 */
export function resolveDiscountFactor(
  discounts: DiscountRow[],
  ctx: DiscountContext,
  now: Date = new Date(),
): { factor: number; code: string | null } {
  const matched = discounts.filter((discount) => discountApplies(discount, ctx, now));
  const nonStackable = matched.filter((discount) => !discount.stackable);
  const stackable = matched.filter((discount) => discount.stackable);

  let factor = 1;
  let code: string | null = null;

  if (nonStackable.length > 0) {
    const best = nonStackable.reduce((min, discount) =>
      discount.factor < min.factor ? discount : min,
    );
    factor = best.factor;
    code = best.code;
  }

  for (const discount of stackable) {
    factor *= discount.factor;
    code = code ? `${code}+${discount.code}` : discount.code;
  }

  return { factor, code };
}

/**
 * 把 Prisma 查出的行（factor 是 Decimal，scope 是 JsonValue）转成本模块的纯类型。
 *
 * `Prisma.Decimal` 没有算术重载：`number * Decimal` 会得到 NaN，`Math.ceil(NaN)`
 * 还是 NaN，写回 Int 列会直接炸。转换点只有这一处，调用方必须经过 toDiscountRow
 * 才能拿到 DiscountRow——resolveDiscountFactor/discountApplies 的输入类型是
 * number，TypeScript 会在编译期拒绝任何未经转换、直接传 Decimal 的调用。
 * 这里额外校验转换结果不是 NaN，转换失败时直接抛错，而不是把 NaN 悄悄传下去。
 */
export function toDiscountRow(row: {
  id: string;
  code: string;
  factor: unknown;
  scope: unknown;
  stackable: boolean;
  priority: number;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  isActive: boolean;
}): DiscountRow {
  const factor = Number(row.factor);
  if (!Number.isFinite(factor)) {
    throw new Error(
      `toDiscountRow: discount ${row.id} has a non-numeric factor (${String(row.factor)})`,
    );
  }

  return {
    id: row.id,
    code: row.code,
    factor,
    scope: (row.scope ?? {}) as DiscountScope,
    stackable: row.stackable,
    priority: row.priority,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    isActive: row.isActive,
  };
}
