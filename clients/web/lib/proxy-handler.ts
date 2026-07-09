import { routing, PREFIXED_LOCALES } from '@/i18n/routing';

export type ProxyAction =
  | { type: 'rewrite'; url: string }
  | { type: 'redirect'; url: string; status: 301 }
  | { type: 'intl' };

const PREFIX_GROUP = PREFIXED_LOCALES.join('|');
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
): ProxyAction {
  // 反代整个 /api：matcher 里的 `/api/:path*` 会同时放行裸 `/api`（`:path*` 匹配零段），
  // 若只测 `startsWith('/api/')`，裸 `/api` 会漏到 intl 并 404。此处让 handler 与 matcher
  // 对齐——两者都覆盖裸 `/api` 与 `/api/*`，统一反代到 BFF。
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return { type: 'rewrite', url: `${apiOrigin}${pathname}${search}` };
  }

  // `.` / `..` 不是合法 handle：`User.handle` 是未校验的 VarChar(80)，`/@..` 会 rewrite
  // 成 `/en/u/..`，被 `new URL()` 规范化为 `/en/`（首页），而非 profile 或 404。一律拒绝，
  // 交给 intl（最终 404）。
  const isDotHandle = (name: string) => name === '.' || name === '..';

  // as-needed：默认 locale 不应出现在 URL 中
  const defaultPrefixed = pathname.match(DEFAULT_PREFIXED_HANDLE_RE);
  if (defaultPrefixed && !isDotHandle(defaultPrefixed[1])) {
    return { type: 'redirect', url: `/@${defaultPrefixed[1]}${search}`, status: 301 };
  }

  // 物理路由是 app/[locale]/u/[handle]，rewrite 目标必须带 locale 段
  const handle = pathname.match(HANDLE_RE);
  if (handle && !isDotHandle(handle[2])) {
    const locale = handle[1] ?? routing.defaultLocale;
    return { type: 'rewrite', url: `/${locale}/u/${handle[2]}${search}` };
  }

  return { type: 'intl' };
}
