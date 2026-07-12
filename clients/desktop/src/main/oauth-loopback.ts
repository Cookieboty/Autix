/**
 * 安全（#5）：登录 loopback 携带一个不可猜测的 `state` token。
 * 否则本机其它进程只要扫到端口，抢先 `GET /callback?code=<攻击者的 code>` 即可注入 → 登录 CSRF/会话固定。
 * pathname 保持 `/callback`（后端 desktop 白名单按 pathname 精确匹配、忽略 query），因此无需改后端；
 * token 通过 query 传递，回调时严格校验相等，不匹配一律 404 并继续监听。
 */
export function loopbackRedirectUri(port: number, state?: string): string {
  const base = `http://127.0.0.1:${port}/callback`;
  return state ? `${base}?state=${state}` : base;
}

export function buildAuthorizeRequestUrl(
  apiBaseUrl: string,
  provider: string,
  params: { systemCode: string; redirectUri: string; inviteCode?: string },
): string {
  const url = new URL(`/api/auth/authorize/${provider}`, apiBaseUrl);
  url.searchParams.set('clientType', 'desktop');
  url.searchParams.set('systemCode', params.systemCode);
  url.searchParams.set('redirectUri', params.redirectUri);
  if (params.inviteCode) url.searchParams.set('inviteCode', params.inviteCode);
  return url.toString();
}

export function parseCallbackResult(
  reqUrl: string,
  expectedState?: string,
): { code?: string; error?: string } {
  const u = new URL(reqUrl, 'http://127.0.0.1');
  if (u.pathname !== '/callback') return {};
  // 安全（#5）：提供了 expectedState 时必须严格相等；不匹配视为无效请求（返回空 → 上层 404 并继续监听）。
  if (expectedState !== undefined && u.searchParams.get('state') !== expectedState) return {};
  const code = u.searchParams.get('code') ?? undefined;
  const error = u.searchParams.get('error') ?? undefined;
  return { ...(code ? { code } : {}), ...(error ? { error } : {}) };
}
