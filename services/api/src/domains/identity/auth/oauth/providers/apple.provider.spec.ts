import { AppleProvider } from './apple.provider';

function makeProvider(claims: any) {
  return new AppleProvider(
    { getAppleConfig: async () => ({ clientId: 'com.x.svc', teamId: 'T', keyId: 'K', privateKey: 'pem', redirectUri: 'http://localhost:3100/api/auth/callback/apple' }) } as any,
    { create: async () => 'SECRET' } as any,        // secretFactory
    async () => claims,                               // verifyIdToken
  );
}

describe('AppleProvider', () => {
  it('buildAuthorizeUrl 用 form_post + scope name email + nonce', async () => {
    const p = makeProvider({});
    const url = new URL(await p.buildAuthorizeUrl({ state: 'st', codeChallenge: 'cc', nonce: 'nn' }));
    expect(url.origin + url.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('scope')).toBe('name email');
    expect(url.searchParams.get('nonce')).toBe('nn');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3100/api/auth/callback/apple');
    expect(url.searchParams.get('code_challenge')).toBeNull(); // Apple 不走 PKCE
  });

  it('fetchProfile 校验 nonce，relay 邮箱视为已验证，姓名取自首次 extra.user', async () => {
    const p = makeProvider({ sub: 'apple-1', email: 'abc@privaterelay.appleid.com', nonce: 'nn' });
    const profile = await p.fetchProfile(
      { idToken: 'jwt' },
      { nonce: 'nn', extra: { user: { name: { firstName: 'Tim', lastName: 'C' }, email: 'abc@privaterelay.appleid.com' } } },
    );
    expect(profile).toEqual(expect.objectContaining({
      provider: 'apple', providerAccountId: 'apple-1',
      email: 'abc@privaterelay.appleid.com', emailVerified: true, displayName: 'Tim C',
    }));
    expect((profile.raw as any).isPrivateRelay).toBe(true);
  });

  it('fetchProfile nonce 不匹配抛错', async () => {
    const p = makeProvider({ sub: 'apple-1', nonce: 'other' });
    await expect(p.fetchProfile({ idToken: 'jwt' }, { nonce: 'nn' })).rejects.toThrow('nonce mismatch');
  });

  it('fetchProfile: id_token has nonce claim but ctx has no nonce → throws nonce mismatch', async () => {
    const p = makeProvider({ sub: 'apple-1', nonce: 'some-nonce' });
    await expect(p.fetchProfile({ idToken: 'jwt' })).rejects.toThrow('nonce mismatch');
  });
});
