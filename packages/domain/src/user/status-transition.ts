/**
 * 用户状态迁移白名单（domain 单一事实源，spec §3.2 D''）。
 *
 * `DELETED` 是终态：任何 `DELETED -> *` 迁出都必须被拒绝；`* -> DELETED` 也不允许通过普通状态接口进入，
 * 只能由 `AccountDeletionService` 的专用删除事务写入。非 DELETED 状态之间保留现有管理接口已接受的迁移。
 *
 * 后端唯一状态写入口 `UserStatusService.transitionUserStatus` 会：
 * 1. `canTransitionUserStatus(from, to)` 校验；
 * 2. `updateMany({ where: { id, status: from }, data: { status: to } })` 条件更新，`count === 0` 抛错。
 */
export type UserStatus = 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'PENDING' | 'DELETED';

export const ALL_USER_STATUSES: readonly UserStatus[] = [
  'ACTIVE',
  'DISABLED',
  'LOCKED',
  'PENDING',
  'DELETED',
] as const;

/** 管理员状态接口可下发的目标状态（显式不含 DELETED）。 */
export const ADMIN_ASSIGNABLE_USER_STATUSES: readonly Exclude<UserStatus, 'DELETED'>[] = [
  'ACTIVE',
  'DISABLED',
  'LOCKED',
  'PENDING',
] as const;

export const USER_STATUS_TRANSITIONS: Readonly<
  Record<UserStatus, ReadonlyArray<UserStatus>>
> = {
  PENDING: ['ACTIVE', 'DISABLED', 'LOCKED'],
  ACTIVE: ['PENDING', 'DISABLED', 'LOCKED'],
  DISABLED: ['PENDING', 'ACTIVE', 'LOCKED'],
  LOCKED: ['PENDING', 'ACTIVE', 'DISABLED'],
  DELETED: [], // 终态，任何迁出都必须拒绝
} as const;

export function isUserStatus(x: unknown): x is UserStatus {
  return typeof x === 'string' && (ALL_USER_STATUSES as readonly string[]).includes(x);
}

/**
 * 是否允许从 `from` 迁移到 `to`。
 * - `from === to` 视为幂等成功（保留现有管理接口的幂等语义）。
 * - 其余按白名单判定；`DELETED` 无任何合法迁出。
 */
export function canTransitionUserStatus(from: UserStatus, to: UserStatus): boolean {
  if (from === to) return true;
  return USER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
