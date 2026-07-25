/**
 * Plan C Task 7：作者信息 presenter（纯函数，可脱离 Prisma / Nest 单测）。
 *
 * 输入 AuthorSource 刻意与 Prisma `User` 解耦：
 * - `status` 类型为 string（非 UserStatus 枚举），保持纯函数可脱离 Prisma 单测。
 * - `displayName` 是"人类可读名"的抽象槽位，由 getDetail 映射自 nickname ?? realName。
 */
export interface AuthorSource {
  id: string;
  status: string;
  displayName: string | null;
  username: string;
  avatar: string | null;
}

export interface PresentedAuthor {
  userId: string;
  nickname: string;
  avatar: string | null;
}

/** 空串/纯空白视同缺失 —— ?? 只挡 null/undefined，挡不住数据库里的 ''。 */
export function firstNonBlank(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

/**
 * 已注销用户的隐私铁律：绝不回传 username（含 deleted_<id> 前缀）或任何 PII / 旧头像，
 * 仅保留 userId（本就是帖子的 authorId，调用方已知），昵称固定为占位文案、头像置空。
 */
export function presentAuthor(u: AuthorSource): PresentedAuthor {
  if (u.status === 'DELETED') {
    return { userId: u.id, nickname: 'Deactivated user', avatar: null };
  }
  return { userId: u.id, nickname: firstNonBlank(u.displayName, u.username) ?? u.username, avatar: u.avatar };
}
