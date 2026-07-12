import { buildAuthorizeRequestUrl, parseCallbackResult, loopbackRedirectUri } from './oauth-loopback';

describe('oauth-loopback helpers', () => {
  it('loopbackRedirectUri 拼 127.0.0.1 + 端口 + /callback', () => {
    expect(loopbackRedirectUri(51789)).toBe('http://127.0.0.1:51789/callback');
  });
  it('loopbackRedirectUri 带 state token（安全 #5）', () => {
    expect(loopbackRedirectUri(51789, 'abc123')).toBe('http://127.0.0.1:51789/callback?state=abc123');
  });
  it('buildAuthorizeRequestUrl 含 clientType=desktop 与编码后的 redirectUri', () => {
    const u = new URL(buildAuthorizeRequestUrl('http://localhost:4000', 'google', {
      systemCode: 'sys', redirectUri: 'http://127.0.0.1:51789/callback',
    }));
    expect(u.pathname).toBe('/api/auth/authorize/google');
    expect(u.searchParams.get('clientType')).toBe('desktop');
    expect(u.searchParams.get('systemCode')).toBe('sys');
    expect(u.searchParams.get('redirectUri')).toBe('http://127.0.0.1:51789/callback');
  });
  it('parseCallbackResult 取 code / error', () => {
    expect(parseCallbackResult('/callback?code=LC')).toEqual({ code: 'LC' });
    expect(parseCallbackResult('/callback?error=OAUTH_STATE_INVALID')).toEqual({ error: 'OAUTH_STATE_INVALID' });
    expect(parseCallbackResult('/favicon.ico')).toEqual({});
  });
  it('parseCallbackResult 校验 state token（安全 #5）', () => {
    // 提供 expectedState 时，state 必须严格相等
    expect(parseCallbackResult('/callback?code=LC&state=good', 'good')).toEqual({ code: 'LC' });
    // state 不匹配（本机进程抢注）→ 视为无效，返回空
    expect(parseCallbackResult('/callback?code=ATTACKER', 'good')).toEqual({});
    expect(parseCallbackResult('/callback?code=ATTACKER&state=wrong', 'good')).toEqual({});
  });
});
