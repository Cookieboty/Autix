import { IsIn } from 'class-validator';
import { UserStatus } from '@autix/database';

/**
 * T15: 管理员可赋予的用户状态白名单（spec §7 步骤 2）。
 *
 * 排除 `DELETED`：
 * - `DELETED` 是用户自助注销的不可逆终态，由 `AccountDeletionService` 的匿名化事务独占管理。
 * - 管理员若直接把用户置为 `DELETED`，会绕过 PII 匿名化和对象清理。
 *   任何"清理账户"需求都应走 `AccountDeletionService`，而非管理员状态接口。
 *
 * 排除 `PENDING`：
 * - `PENDING` 是"注册未激活"的机器分配状态，由注册流程写入；管理员迁入 `PENDING` 没有业务含义。
 */
export const AdminAssignableUserStatuses = [
  UserStatus.ACTIVE,
  UserStatus.DISABLED,
  UserStatus.LOCKED,
] as const;

export type AdminAssignableUserStatus = (typeof AdminAssignableUserStatuses)[number];

export class UpdateStatusDto {
  @IsIn([...AdminAssignableUserStatuses])
  status: AdminAssignableUserStatus;
}
