export function loopbackRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}/callback`;
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

export function parseCallbackResult(reqUrl: string): { code?: string; error?: string } {
  const u = new URL(reqUrl, 'http://127.0.0.1');
  if (u.pathname !== '/callback') return {};
  const code = u.searchParams.get('code') ?? undefined;
  const error = u.searchParams.get('error') ?? undefined;
  return { ...(code ? { code } : {}), ...(error ? { error } : {}) };
}
