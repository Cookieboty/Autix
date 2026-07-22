// 邮箱归一：trim + lowercase。users.email 是大小写敏感唯一索引，所有写/按邮箱查的
// 路径都走它，才能避免大小写变体重复账号 / OAuth 漏合并。
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** `@Transform` 包装：非字符串原样透传，交给 `@IsEmail` 报错。 */
export const normalizeEmailTransform = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizeEmail(value) : value;
