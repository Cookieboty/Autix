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
  if (pathname.startsWith('/api/')) {
    return { type: 'rewrite', url: `${apiOrigin}${pathname}${search}` };
  }

  // as-needed：默认 locale 不应出现在 URL 中
  const defaultPrefixed = pathname.match(DEFAULT_PREFIXED_HANDLE_RE);
  if (defaultPrefixed) {
    return { type: 'redirect', url: `/@${defaultPrefixed[1]}${search}`, status: 301 };
  }

  // 物理路由是 app/[locale]/u/[handle]，rewrite 目标必须带 locale 段
  const handle = pathname.match(HANDLE_RE);
  if (handle) {
    const locale = handle[1] ?? routing.defaultLocale;
    return { type: 'rewrite', url: `/${locale}/u/${handle[2]}${search}` };
  }

  return { type: 'intl' };
}
