import { GitHubProvider } from './github.provider';

function makeProvider(over: any = {}) {
  return new GitHubProvider(
    { getGitHubConfig: async () => ({ clientId: 'cid', clientSecret: 'sec', redirectUri: 'http://localhost:3100/api/auth/callback/github' }) } as any,
    over.exchange ?? (async () => ({ accessToken: 'gho_x', scope: 'read:user,user:email', tokenType: 'bearer' })),
    over.httpGet ?? (async (path: string) => {
      if (path === '/user') return { id: 42, login: 'alice', name: 'Alice', avatar_url: 'http://a' };
      if (path === '/user/emails') return [
        { email: 'sec@x.com', primary: false, verified: true },
        { email: 'a@x.com', primary: true, verified: true },
      ];
      throw new Error('unexpected ' + path);
    }),
  );
}

describe('GitHubProvider', () => {
  it('buildAuthorizeUrl 含 scope、state 与 PKCE(S256)', async () => {
    const url = new URL(await makeProvider().buildAuthorizeUrl({ state: 'st', codeChallenge: 'cc' }));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('scope')).toContain('user:email');
    expect(url.searchParams.get('code_challenge')).toBe('cc');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('exchangeCode 透传 code_verifier 给 token 交换', async () => {
    const exchange = jest.fn(async () => ({ accessToken: 'gho_x' }));
    await makeProvider({ exchange }).exchangeCode({ code: 'c', codeVerifier: 'v1' });
    expect(exchange).toHaveBeenCalledWith('c', 'v1', expect.objectContaining({ clientId: 'cid' }));
  });

  it('fetchProfile 取 primary+verified 邮箱并规范化', async () => {
    const profile = await makeProvider().fetchProfile({ accessToken: 'gho_x' });
    expect(profile).toEqual(expect.objectContaining({
      provider: 'github', providerAccountId: '42', email: 'a@x.com',
      emailVerified: true, displayName: 'Alice', avatar: 'http://a',
    }));
  });

  it('fetchProfile 无 primary 已验证邮箱时 emailVerified=false', async () => {
    const p = makeProvider({ httpGet: async (path: string) =>
      path === '/user' ? { id: 7, login: 'bob' } : [{ email: 'b@x.com', primary: true, verified: false }] });
    const profile = await p.fetchProfile({ accessToken: 'gho_x' });
    expect(profile).toEqual(expect.objectContaining({ providerAccountId: '7', emailVerified: false, displayName: 'bob' }));
  });
});
