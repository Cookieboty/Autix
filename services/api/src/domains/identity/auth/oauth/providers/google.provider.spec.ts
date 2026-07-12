import { GoogleProvider } from './google.provider';

function cfg(over: any = {}) {
  return {
    getGoogleConfig: async () => ({
      clientId: 'cid',
      clientSecret: 'sec',
      redirectUri: 'http://localhost:3100/api/auth/callback/google',
      ...over,
    }),
  } as any;
}

describe('GoogleProvider', () => {
  const previousReauthFlag = process.env.GOOGLE_OAUTH_REAUTH_ENABLED;

  afterEach(() => {
    if (previousReauthFlag === undefined) delete process.env.GOOGLE_OAUTH_REAUTH_ENABLED;
    else process.env.GOOGLE_OAUTH_REAUTH_ENABLED = previousReauthFlag;
  });

  it('strong re-auth capability is disabled by default and requires an explicit rollout flag', () => {
    delete process.env.GOOGLE_OAUTH_REAUTH_ENABLED;
    expect(new GoogleProvider(cfg()).supportsReauth).toBe(false);
    process.env.GOOGLE_OAUTH_REAUTH_ENABLED = 'true';
    expect(new GoogleProvider(cfg()).supportsReauth).toBe(true);
  });

  it('buildAuthorizeUrl 用固定后端 callback 作 redirect_uri，含 S256 与 nonce', async () => {
    const p = new GoogleProvider(cfg());
    const url = new URL(await p.buildAuthorizeUrl({ state: 'st', codeChallenge: 'cc', nonce: 'nn' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3100/api/auth/callback/google');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge')).toBe('cc');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('nonce')).toBe('nn');
    expect(url.searchParams.get('scope')).toContain('email');
    expect(url.searchParams.get('max_age')).toBeNull();
  });

  it('reauth authorize URL adds the strong-auth parameters only for REAUTH', async () => {
    const p = new GoogleProvider(cfg());
    const url = new URL(await p.buildAuthorizeUrl({ state: 'st', codeChallenge: 'cc', nonce: 'nn', reauth: true }));
    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.get('max_age')).toBe('0');
  });

  it('fetchProfile 校验 nonce 后把 id_token claims 规范化', async () => {
    const p = new GoogleProvider(
      cfg(),
      async () => ({ sub: '123', email: 'a@x.com', email_verified: true, name: 'Alice', picture: 'http://p', nonce: 'nn' }),
    );
    const profile = await p.fetchProfile({ idToken: 'jwt', accessToken: 'at' }, { nonce: 'nn' });
    expect(profile).toEqual(expect.objectContaining({
      provider: 'google', providerAccountId: '123', email: 'a@x.com',
      emailVerified: true, displayName: 'Alice', avatar: 'http://p',
    }));
  });

  it('fetchProfile 在 nonce 不匹配时抛错', async () => {
    const p = new GoogleProvider(cfg(), async () => ({ sub: '123', nonce: 'other' }));
    await expect(p.fetchProfile({ idToken: 'jwt' }, { nonce: 'nn' })).rejects.toThrow('nonce mismatch');
  });

  it('fetchProfile 在 id_token 含 nonce 但未传 ctx 时抛 nonce mismatch', async () => {
    const p = new GoogleProvider(cfg(), async () => ({ sub: '123', nonce: 'nn' }));
    await expect(p.fetchProfile({ idToken: 'jwt' })).rejects.toThrow('nonce mismatch');
  });

  it('fetchProfile 无 id_token 抛错', async () => {
    const p = new GoogleProvider(cfg());
    await expect(p.fetchProfile({ accessToken: 'at' })).rejects.toThrow('missing id_token');
  });
});
