import { routing, PREFIXED_LOCALES } from '@/i18n/routing';

export type ProxyAction =
  | { type: 'rewrite'; url: string }
  | { type: 'redirect'; url: string; status: 301 | 302 }
  | { type: 'intl' };

const PREFIX_GROUP = PREFIXED_LOCALES.join('|');
// 裸 `/@handle` 或带非默认 locale 前缀 `/en/@handle`（默认 locale 前缀先被下面 301 去掉）。
const HANDLE_RE = new RegExp(`^(?:/(${PREFIX_GROUP}))?/@([^/]+)$`);
const DEFAULT_PREFIXED_HANDLE_RE = new RegExp(`^/${routing.defaultLocale}/@([^/]+)$`);

/**
 * 决定一个请求该被反代、重定向，还是交给 next-intl。
 * 纯字符串运算，无 Next 依赖，便于单测。
 */
export function resolveProxyAction(
  pathname: string,
  search: string,
  apiOrigin: string,
  localeCookie?: string,
): ProxyAction {
  // 反代整个 /api：matcher 里的 `/api/:path*` 会同时放行裸 `/api`（`:path*` 匹配零段），
  // 若只测 `startsWith('/api/')`，裸 `/api` 会漏到 intl 并 404。此处让 handler 与 matcher
  // 对齐——两者都覆盖裸 `/api` 与 `/api/*`，统一反代到 BFF。
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return { type: 'rewrite', url: `${apiOrigin}${pathname}${search}` };
  }

  // `.` / `..` 不是合法 handle：`User.username` 是未校验的字符串，`/@..` 会 rewrite
  // 成 `/en/u/..`，被 `new URL()` 规范化为 `/en/`（首页），而非 profile 或 404。一律拒绝，
  // 交给 intl（最终 404）。
  const isDotHandle = (name: string) => name === '.' || name === '..';

  // as-needed：默认 locale 不应出现在 URL 中
  const defaultPrefixed = pathname.match(DEFAULT_PREFIXED_HANDLE_RE);
  if (defaultPrefixed && !isDotHandle(defaultPrefixed[1])) {
    return { type: 'redirect', url: `/@${defaultPrefixed[1]}${search}`, status: 301 };
  }

  // `/@handle` 虚荣链接 → 物理路由 app/[locale]/u/[handle]，rewrite 目标必须带 locale 段。
  const handle = pathname.match(HANDLE_RE);
  if (handle && !isDotHandle(handle[2])) {
    const locale = handle[1] ?? routing.defaultLocale;
    return { type: 'rewrite', url: `/${locale}/u/${handle[2]}${search}` };
  }

  // 根路径按 NEXT_LOCALE cookie 跳转到用户已知语言的首页。仅对裸根路径生效——
  // `/pricing` 等裸深链接必须保持可分享，`/zh-CN` 等已带 locale 的 URL 必须优先于
  // cookie（否则 `/zh-CN` + cookie=ja 会跳走，形成循环或劫持显式选择）。
  // cookie 必须校验落在 routing.locales 内（不可信输入），且不能是默认 locale
  // （否则裸路径会被无意义地跳到自身）。302（非 301！）——决策依赖请求 cookie，
  // 不能被浏览器/CDN 永久缓存，否则下一个访客（如 Googlebot，无 cookie）会被错误地
  // 301 命中缓存的旧跳转。是否附加 `Cache-Control: private, no-store` 由 proxy.ts
  // 在包装 NextResponse 时处理（此处是纯字符串运算，无 Response 对象）。
  if (
    pathname === '/' &&
    localeCookie &&
    localeCookie !== routing.defaultLocale &&
    (routing.locales as readonly string[]).includes(localeCookie)
  ) {
    return { type: 'redirect', url: `/${localeCookie}${search}`, status: 302 };
  }

  return { type: 'intl' };
}
