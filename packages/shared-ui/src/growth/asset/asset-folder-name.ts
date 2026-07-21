/**
 * 新建文件夹的名字避让。
 *
 * 后端 MaterialFoldersService.create 对同名是硬拒绝（assertNameAvailable → 409，
 * 外加 (userId, lower(name)) 的唯一索引兜底），所以「加号」不能每次都递一个固定的
 * "New folder" —— 第一次能成，之后每次都撞名。这里先在本地避让出一个可用名。
 *
 * 比对用小写：后端 findActiveByName 是 mode:'insensitive'，本地若按大小写敏感去判，
 * 会挑出一个自以为可用、实际仍会 409 的名字。
 */
export function nextFolderName(baseName: string, existingNames: string[]): string {
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  if (!taken.has(baseName.trim().toLowerCase())) return baseName;
  // 从 2 开始：第一个重名的叫 "New folder 2"，符合「原名 + 序号」的直觉。
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${baseName} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${baseName} ${Date.now()}`;
}

/**
 * 取后端给的失败原因。
 *
 * 形状照 galleryErrorMessage：本仓库 API 的错误体是 `msg` 而**不是** `message`，
 * SDK 拦截器又把它挂到 error.msg 上。按 `response.data.message` 去读只会拿到 undefined，
 * 于是「已存在同名文件夹」这些真实原因全被退化成通用兜底文案。
 */
export function folderErrorMessage(error: unknown, fallback: string): string {
  const err = error as { msg?: string; response?: { data?: { msg?: string } } };
  if (typeof err?.msg === 'string' && err.msg) return err.msg;
  const body = err?.response?.data?.msg;
  if (typeof body === 'string' && body) return body;
  return fallback;
}
