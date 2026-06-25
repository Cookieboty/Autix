import { randomBytes } from 'crypto';

/**
 * FIX-2: 邀请码增强。
 * 旧实现 `randomBytes(4).toString('hex')` 只有 32 位熵，且 `.slice(0,8)` 是空操作。
 * 改为 8 字节（64 位熵）十六进制，显著提升枚举成本。
 */
export function generateInviteCode(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}
