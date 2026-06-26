import { OAuthService } from './oauth.service';

function deps() {
  const provider = {
    name: 'google',
    buildAuthorizeUrl: jest.fn().mockReturnValue('https://auth/url'),
    exchangeCode: jest.fn().mockResolvedValue({ accessToken: 'at', idToken: 'jwt' }),
    fetchProfile: jest.fn().mockResolvedValue({ provider: 'google', providerAccountId: 'sub1', email: 'a@x.com', emailVerified: true, displayName: 'A', avatar: null, raw: {}, tokens: { accessToken: 'at' } }),
  };
  const registry = {
    isEnabled: () => true,
    isLaunched: () => true,
    get: (name: string) => {
      if (name === 'google') return provider;
      // For other providers (e.g. github), return a dynamic mock with matching provider name
      return {
        name,
        buildAuthorizeUrl: jest.fn().mockReturnValue('https://auth/url'),
        exchangeCode: jest.fn().mockResolvedValue({ accessToken: 'at' }),
        fetchProfile: jest.fn().mockResolvedValue({ provider: name, providerAccountId: 'sub1', email: 'a@x.com', emailVerified: true, displayName: 'A', avatar: null, raw: {}, tokens: { accessToken: 'at' } }),
      };
    },
    listEnabled: () => ['google'],
  };
  const resolution = { resolve: jest.fn().mockResolvedValue({ kind: 'login', userId: 'u1' }) };
  const authService = {
    issueSessionForUser: jest.fn().mockResolvedValue({ loginResult: { accessToken: 'AT', refreshToken: 'RT', expiresIn: 3600, status: 'ACTIVE', language: 'zh-CN', systems: [], currentSystemId: 's1' }, sessionId: 'sess1' }),
    buildLoginResultFromSession: jest.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT', expiresIn: 3600, status: 'ACTIVE', language: 'zh-CN', systems: [], currentSystemId: 's1' }),
  };
  const identity = {
    findSystemByCode: jest.fn().mockResolvedValue({ id: 's1' }),
    findLoginUserById: jest.fn().mockResolvedValue({ id: 'u1', username: 'a', status: 'ACTIVE', language: 'zh-CN', isSuperAdmin: false, roles: [] }),
    findUserAccount: jest.fn().mockResolvedValue(null),
    createUserAccount: jest.fn().mockResolvedValue(undefined),
    findUserAccountsByUserId: jest.fn().mockResolvedValue([]),
    hasOtherCredential: jest.fn().mockResolvedValue(true),
    deleteUserAccount: jest.fn().mockResolvedValue(undefined),
  };
  const sessionRepo = { create: jest.fn().mockResolvedValue({ id: 'sess1', refreshToken: 'RT' }) };
  const social = {
    createState: jest.fn().mockResolvedValue({}),
    consumeState: jest.fn().mockResolvedValue({ provider: 'google', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback', codeVerifier: 'cv', nonce: 'nn', inviteCode: null, deviceId: null, linkUserId: null }),
    createLoginCode: jest.fn().mockResolvedValue({}),
    consumeLoginCode: jest.fn().mockResolvedValue({ sessionId: 'sess1' }),
  };
  const invite = { recordInvitation: jest.fn() };
  const cipher = { encrypt: (s: string) => `enc(${s})`, decrypt: (s: string) => s };
  const svc = new OAuthService(registry as any, resolution as any, authService as any, identity as any, sessionRepo as any, social as any, invite as any, cipher as any);
  return { svc, provider, resolution, authService, social, sessionRepo, identity };
}

describe('OAuthService', () => {
  it('createAuthorization 落 state 并返回授权 URL（redirectUri 精确命中白名单）', async () => {
    process.env.OAUTH_WEB_REDIRECT_ALLOWLIST = 'http://web/oauth/callback';
    const { svc, social } = deps();
    const r = await svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback' });
    expect(social.createState).toHaveBeenCalledWith(expect.objectContaining({ nonce: expect.any(String) }));
    expect(r.authorizeUrl).toBe('https://auth/url');
  });

  it('createAuthorization 拒绝白名单外的 redirectUri（含同前缀的伪造路径）', async () => {
    process.env.OAUTH_WEB_REDIRECT_ALLOWLIST = 'http://web/oauth/callback';
    const { svc } = deps();
    await expect(
      svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback-evil' }),
    ).rejects.toThrow('OAUTH_REDIRECT_NOT_ALLOWED');
    await expect(
      svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'web', redirectUri: 'http://evil.com/oauth/callback' }),
    ).rejects.toThrow('OAUTH_REDIRECT_NOT_ALLOWED');
  });

  it('createAuthorization 对未 launched provider 抛 OAUTH_PROVIDER_NOT_LAUNCHED', async () => {
    process.env.OAUTH_WEB_REDIRECT_ALLOWLIST = 'http://web/oauth/callback';
    const { svc, social } = deps();
    // Override registry.isLaunched to return false for apple
    (svc as any).registry.isLaunched = (name: string) => name !== 'apple';
    await expect(
      svc.createAuthorization({ provider: 'apple', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback' }),
    ).rejects.toThrow('OAUTH_PROVIDER_NOT_LAUNCHED');
    expect(social.createState).not.toHaveBeenCalled();
  });

  it('handleCallback 成功 → 建会话 + 一次性码 + 回跳 redirectUri', async () => {
    const { svc, social, sessionRepo } = deps();
    const r = await svc.handleCallback({ provider: 'google', code: 'c', state: 'st', ip: '1.1.1.1', userAgent: 'UA' });
    expect(sessionRepo.create).not.toHaveBeenCalled(); // session created via authService.issueSessionForUser
    expect(social.createLoginCode).toHaveBeenCalled();
    expect(r.redirectUri).toBe('http://web/oauth/callback');
    expect(typeof r.loginCode).toBe('string');
  });

  it('handleCallback 邮箱冲突 → 回跳带 errorCode，不建码', async () => {
    const { svc, resolution, social } = deps();
    resolution.resolve.mockResolvedValueOnce({ kind: 'conflict', code: 'OAUTH_EMAIL_UNVERIFIED_CONFLICT' });
    const r = await svc.handleCallback({ provider: 'google', code: 'c', state: 'st', ip: '', userAgent: '' });
    expect(r.errorCode).toBe('OAUTH_EMAIL_UNVERIFIED_CONFLICT');
    expect(social.createLoginCode).not.toHaveBeenCalled();
  });

  it('handleCallback 用户拒绝授权 → 返回 OAUTH_PROVIDER_DENIED，不调用 exchangeCode', async () => {
    const { svc, provider } = deps();
    const r = await svc.handleCallback({ provider: 'google', error: 'access_denied', state: 'st', ip: '', userAgent: '' });
    expect(r.errorCode).toBe('OAUTH_PROVIDER_DENIED');
    expect(r.redirectUri).toBe('http://web/oauth/callback');
    expect(provider.exchangeCode).not.toHaveBeenCalled();
  });

  it('handleCallback 把 extraParams 透传给 provider.fetchProfile', async () => {
    const { svc, provider } = deps();
    await svc.handleCallback({ provider: 'google', code: 'c', state: 'st', ip: '', userAgent: '', extraParams: { user: 'X' } });
    expect(provider.fetchProfile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ extra: { user: 'X' } }));
  });

  it('exchangeLoginCode 有效码 → 返回 LoginResult', async () => {
    const { svc } = deps();
    const r = await svc.exchangeLoginCode('code1');
    expect(r).toEqual(expect.objectContaining({ accessToken: 'AT', currentSystemId: 's1' }));
  });

  it('exchangeLoginCode 无效码 → 抛错', async () => {
    const { svc, social } = deps();
    social.consumeLoginCode.mockResolvedValueOnce(null);
    await expect(svc.exchangeLoginCode('bad')).rejects.toThrow('OAUTH_EXCHANGE_EXPIRED');
  });
});

describe('redirect 放行（desktop loopback）', () => {
  it('desktop 放行 127.0.0.1 任意端口 /callback', async () => {
    const { svc, social } = deps();
    await svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'desktop', redirectUri: 'http://127.0.0.1:51789/callback' });
    expect(social.createState).toHaveBeenCalled();
  });
  it('desktop 拒绝非 loopback / 非 /callback', async () => {
    const { svc } = deps();
    await expect(
      svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'desktop', redirectUri: 'http://evil.com:51789/callback' }),
    ).rejects.toThrow('OAUTH_REDIRECT_NOT_ALLOWED');
    await expect(
      svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'desktop', redirectUri: 'http://127.0.0.1:51789/steal' }),
    ).rejects.toThrow('OAUTH_REDIRECT_NOT_ALLOWED');
  });
  it('desktop 拒绝子域名劫持（subdomain hijack）', async () => {
    const { svc } = deps();
    await expect(
      svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'desktop', redirectUri: 'http://127.0.0.1.evil.com/callback' }),
    ).rejects.toThrow('OAUTH_REDIRECT_NOT_ALLOWED');
  });
  it('desktop 拒绝非 http scheme（ftp）', async () => {
    const { svc } = deps();
    await expect(
      svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'desktop', redirectUri: 'ftp://127.0.0.1:51789/callback' }),
    ).rejects.toThrow('OAUTH_REDIRECT_NOT_ALLOWED');
  });
});

describe('OAuthService 绑定/解绑', () => {
  it('handleCallback 绑定分支：账号未被占用 → 关联到 linkUserId', async () => {
    const { svc, social, identity } = deps();
    social.consumeState.mockResolvedValueOnce({ provider: 'github', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback', codeVerifier: 'cv', nonce: 'nn', linkUserId: 'u1' });
    identity.findUserAccount = jest.fn().mockResolvedValue(null);
    identity.createUserAccount = jest.fn().mockResolvedValue(undefined);
    const r = await svc.handleCallback({ provider: 'github', code: 'c', state: 'st', ip: '', userAgent: '' });
    expect(identity.createUserAccount).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', provider: 'github' }));
    expect(r.linked).toBe('github');
    expect(r.loginCode).toBeUndefined();
  });

  it('handleCallback 绑定分支：账号已属他人 → 冲突', async () => {
    const { svc, social, identity } = deps();
    social.consumeState.mockResolvedValueOnce({ provider: 'github', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback', codeVerifier: 'cv', nonce: 'nn', linkUserId: 'u1' });
    identity.findUserAccount = jest.fn().mockResolvedValue({ userId: 'someone-else' });
    const r = await svc.handleCallback({ provider: 'github', code: 'c', state: 'st', ip: '', userAgent: '' });
    expect(r.errorCode).toBe('OAUTH_ACCOUNT_ALREADY_LINKED');
  });

  it('unlink 保留最后凭证 → 抛错', async () => {
    const { svc, identity } = deps();
    identity.hasOtherCredential = jest.fn().mockResolvedValue(false);
    await expect(svc.unlink('u1', 'github')).rejects.toThrow('OAUTH_CANNOT_UNLINK_LAST_CREDENTIAL');
  });

  it('unlink 仍有其它凭证 → 删除', async () => {
    const { svc, identity } = deps();
    identity.hasOtherCredential = jest.fn().mockResolvedValue(true);
    identity.deleteUserAccount = jest.fn().mockResolvedValue(undefined);
    await svc.unlink('u1', 'github');
    expect(identity.deleteUserAccount).toHaveBeenCalledWith('u1', 'github');
  });
});
