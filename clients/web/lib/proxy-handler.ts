import { routing, PREFIXED_LOCALES } from '@/i18n/routing';

export type ProxyAction =
  | { type: 'rewrite'; url: string; cookieDependent?: true }
  | { type: 'redirect'; url: string; status: 301 | 302; setLocaleCookie?: string }
  | { type: 'intl' };

const PREFIX_GROUP = PREFIXED_LOCALES.join('|');
// 裸 `/@handle` 或带非默认 locale 前缀 `/en/@handle`（默认 locale 前缀先被下面去掉）。
const HANDLE_RE = new RegExp(`^(?:/(${PREFIX_GROUP}))?/@([^/]+)$`);
const DEFAULT_PREFIX_RE = new RegExp(`^/${routing.defaultLocale}(?=/|$)`);

/**
 * locale 中立路由：URL 被第三方登记或以裸形式硬编码，必须始终在默认 locale 下渲染，
 * 绝不能被下面的 cookie 兜底加上前缀。
 *
 * OAuth 回调的 redirect URI 恒为 `${origin}/oauth/callback`（lib/oauth-popup-flow.ts:40），
 * 且回调页显式依赖「本页永远是默认 locale，故 intl router 是 passthrough」这一前提，
 * 才能把带前缀的 returnTo 原样交给 router（见 app/[locale]/oauth/callback/page.tsx:25-41）。
 * 一旦这里把它跳成 /zh-CN/oauth/callback，router 转为主动加前缀，returnTo 会被二次加前缀
 * 变成 /zh-CN/ja/community 之类的 404。
 */
const LOCALE_NEUTRAL_PREFIXES = ['/oauth/'] as const;

function isLocaleNeutral(pathname: string): boolean {
  return LOCALE_NEUTRAL_PREFIXES.some((p) => pathname === p.slice(0, -1) || pathname.startsWith(p));
}

/** cookie 是不可信输入：必须落在 routing.locales 内才采信。 */
function validLocale(cookie?: string): string | undefined {
  return cookie && (routing.locales as readonly string[]).includes(cookie) ? cookie : undefined;
}

/** 路径首段是否已经是一个 locale（含默认 locale）。 */
function hasLocalePrefix(pathname: string): boolean {
  const first = pathname.split('/').filter(Boolean)[0];
  return first !== undefined && (routing.locales as readonly string[]).includes(first);
}

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

  const cookieLocale = validLocale(localeCookie);

  // ── 显式英文出口 ─────────────────────────────────────────────────────────
  // as-needed 下默认 locale 不该出现在 URL 中，`/en/x` 一律去前缀。但它同时承担
  // 「我就是要英文」的语义：若用户已存了别的语言偏好，必须让 URL 覆盖 cookie，
  // 否则用户会被自己的旧偏好锁死——下面的裸路径兜底会立刻把他跳回中文，
  // 形成 `/en/x` → `/x` → `/zh-CN/x` 的错误闭环。这正是原实现把兜底限制在 `/`
  // 的真实原因；在此处放行显式意图后，兜底才能安全地覆盖全部路径。
  //
  // 有冲突时用 302 且必须改写 cookie：301 会被浏览器永久缓存，缓存命中时请求
  // 根本不到服务端，cookie 就永远改不过来，闭环重新出现。无冲突时维持 301
  // 纯路径规范化（可缓存，Googlebot 友好）。
  const defaultPrefixed = pathname.match(DEFAULT_PREFIX_RE);
  if (defaultPrefixed) {
    const stripped = pathname.slice(routing.defaultLocale.length + 1) || '/';
    // `/en/@..` 这类非法 handle 不做路径改写，交给 intl 走 404
    const handleAfterStrip = stripped.match(/^\/@([^/]+)$/);
    if (handleAfterStrip && isDotHandle(handleAfterStrip[1])) {
      return { type: 'intl' };
    }
    // 只有「cookie 已经就是 en」时才无需写。cookie **缺失**同样要写：冲突可能藏在
    // 代理看不见的 localStorage 里（旧的中文偏好），不写 cookie 的话客户端 hydrate
    // 会回落到 localStorage，把用户又拽回中文，显式英文意图丢失。
    const conflicts = cookieLocale !== routing.defaultLocale;
    return conflicts
      ? {
          type: 'redirect',
          url: `${stripped}${search}`,
          status: 302,
          setLocaleCookie: routing.defaultLocale,
        }
      : { type: 'redirect', url: `${stripped}${search}`, status: 301 };
  }

  // `/@handle` 虚荣链接 → 物理路由 app/[locale]/u/[handle]，rewrite 目标必须带 locale 段。
  // 裸形式（`/@alice` 是可分享的规范形式，不做跳转）按 cookie 选语言，与下面的裸路径
  // 兜底保持一致：选了中文的用户点开 profile 不应看到英文界面。
  const handle = pathname.match(HANDLE_RE);
  if (handle && !isDotHandle(handle[2])) {
    if (handle[1]) {
      return { type: 'rewrite', url: `/${handle[1]}/u/${handle[2]}${search}` };
    }
    const locale = cookieLocale ?? routing.defaultLocale;
    return locale === routing.defaultLocale
      ? { type: 'rewrite', url: `/${locale}/u/${handle[2]}${search}` }
      : { type: 'rewrite', url: `/${locale}/u/${handle[2]}${search}`, cookieDependent: true };
  }

  // ── 裸路径兜底：locale 粘性的唯一强制点 ──────────────────────────────────
  // as-needed 下裸路径 == 英文，所以「掉了前缀」和「切成英文」是同一件事。丢失来源
  // 无法在调用点穷举（router 未绑定时的硬跳、window.location.assign、OAuth 回跳、
  // 以及以后新写的代码），只有在边缘统一兜底才能覆盖未来的 bug。
  //
  // 302 而非 301：决策依赖请求 cookie，不能被浏览器/CDN 永久缓存，否则下一个访客
  // （如无 cookie 的 Googlebot）会命中缓存的错误跳转。`Cache-Control: private, no-store`
  // 由 proxy.ts 在包装 NextResponse 时附加（此处是纯字符串运算，无 Response 对象）。
  if (
    !hasLocalePrefix(pathname) &&
    !isLocaleNeutral(pathname) &&
    cookieLocale !== undefined &&
    cookieLocale !== routing.defaultLocale
  ) {
    const base = pathname === '/' ? '' : pathname;
    return { type: 'redirect', url: `/${cookieLocale}${base}${search}`, status: 302 };
  }

  return { type: 'intl' };
}
