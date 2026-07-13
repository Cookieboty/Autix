/**
 * Plan C Task 7：作者信息 presenter（纯函数，可脱离 Prisma / Nest 单测）。
 *
 * 输入 AuthorSource 刻意与 Prisma `User` 解耦：
 * - `status` 类型为 string（非 UserStatus 枚举）——当前分支的枚举还没有 DELETED
 *   （它在 account 分支 feat/creative-canvas 上），用 string 让 'DELETED' 分支今日即可
 *   编译并被单测覆盖，待枚举补上后自动生效，无需改本文件。
 * - `displayName` 是"人类可读名"的抽象槽位：现阶段由 getDetail 映射自 User.realName
 *   （当前唯一的人名字段）；account 分支合入后改为 nickname ?? realName。
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

/**
 * 已注销用户的隐私铁律：绝不回传 username（含 deleted_<id> 前缀）或任何 PII / 旧头像，
 * 仅保留 userId（本就是帖子的 authorId，调用方已知），昵称固定为占位文案、头像置空。
 */
export function presentAuthor(u: AuthorSource): PresentedAuthor {
  if (u.status === 'DELETED') {
    return { userId: u.id, nickname: '已注销用户', avatar: null };
  }
  return { userId: u.id, nickname: u.displayName ?? u.username, avatar: u.avatar };
}
