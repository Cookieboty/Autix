import { buildAuthorizeRequestUrl, parseCallbackResult, loopbackRedirectUri } from './oauth-loopback';

describe('oauth-loopback helpers', () => {
  it('loopbackRedirectUri 拼 127.0.0.1 + 端口 + /callback', () => {
    expect(loopbackRedirectUri(51789)).toBe('http://127.0.0.1:51789/callback');
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
});
