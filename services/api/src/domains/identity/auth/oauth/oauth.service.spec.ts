import { OAuthService } from './oauth.service';

function deps() {
  const provider = {
    name: 'google',
    supportsReauth: true,
    buildAuthorizeUrl: vi.fn().mockResolvedValue('https://auth/url'),
    exchangeCode: vi.fn().mockResolvedValue({ accessToken: 'at', idToken: 'jwt' }),
    fetchProfile: vi.fn().mockResolvedValue({ provider: 'google', providerAccountId: 'sub1', email: 'a@x.com', emailVerified: true, displayName: 'A', avatar: null, raw: {}, tokens: { accessToken: 'at' } }),
  };
  const registry = {
    isEnabled: vi.fn().mockResolvedValue(true),
    isLaunched: vi.fn().mockResolvedValue(true),
    getInstance: (name: string) => {
      if (name === 'google') return provider;
      // For other providers (e.g. github), return a dynamic mock with matching provider name
      return {
        name,
        supportsReauth: name !== 'github',
        buildAuthorizeUrl: vi.fn().mockResolvedValue('https://auth/url'),
        exchangeCode: vi.fn().mockResolvedValue({ accessToken: 'at' }),
        fetchProfile: vi.fn().mockResolvedValue({ provider: name, providerAccountId: 'sub1', email: 'a@x.com', emailVerified: true, displayName: 'A', avatar: null, raw: {}, tokens: { accessToken: 'at' } }),
      };
    },
    listEnabled: () => ['google'],
  };
  const resolution = { resolve: vi.fn().mockResolvedValue({ kind: 'login', userId: 'u1' }) };
  const authService = {
    issueSessionForUser: vi.fn().mockResolvedValue({ loginResult: { accessToken: 'AT', refreshToken: 'RT', expiresIn: 3600, status: 'ACTIVE', language: 'zh-CN', systems: [], currentSystemId: 's1' }, sessionId: 'sess1' }),
    buildLoginResultFromSession: vi.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT', expiresIn: 3600, status: 'ACTIVE', language: 'zh-CN', systems: [], currentSystemId: 's1' }),
  };
  const identity = {
    findSystemByCode: vi.fn().mockResolvedValue({ id: 's1' }),
    findLoginUserById: vi.fn().mockResolvedValue({ id: 'u1', username: 'a', status: 'ACTIVE', language: 'zh-CN', isSuperAdmin: false, roles: [] }),
    findUserAccount: vi.fn().mockResolvedValue(null),
    createUserAccount: vi.fn().mockResolvedValue(undefined),
    findUserAccountsByUserId: vi.fn().mockResolvedValue([]),
    hasOtherCredential: vi.fn().mockResolvedValue(true),
    deleteUserAccount: vi.fn().mockResolvedValue(undefined),
  };
  const sessionRepo = { create: vi.fn().mockResolvedValue({ id: 'sess1', refreshToken: 'RT' }) };
  const social = {
    createState: vi.fn().mockResolvedValue({}),
    consumeState: vi.fn().mockResolvedValue({ provider: 'google', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback', codeVerifier: 'cv', nonce: 'nn', inviteCode: null, deviceId: null, linkUserId: null }),
    createLoginCode: vi.fn().mockResolvedValue({}),
    consumeLoginCode: vi.fn().mockResolvedValue({ sessionId: 'sess1' }),
  };
  const invite = { recordInvitation: vi.fn() };
  const campaignRewards = { grantRegistrationBonus: vi.fn() };
  const cipher = { encrypt: (s: string) => `enc(${s})`, decrypt: (s: string) => s };
  const config = { getWebRedirectAllowlist: vi.fn().mockResolvedValue(['http://web/oauth/callback']) };
  const stepUp = {
    signOAuthProof: vi.fn().mockResolvedValue({ proof: 'proof', expiresAt: new Date().toISOString() }),
    verifyAndConsumeProof: vi.fn().mockResolvedValue(undefined),
  };
  const svc = new OAuthService(registry as any, resolution as any, authService as any, identity as any, sessionRepo as any, social as any, invite as any, campaignRewards as any, cipher as any, config as any, stepUp as any);
  return { svc, provider, resolution, authService, social, sessionRepo, identity, registry, config, campaignRewards, stepUp };
}

describe('OAuthService', () => {
  it('createAuthorization 落 state 并返回授权 URL（redirectUri 精确命中白名单）', async () => {
    const { svc, social } = deps();
    const r = await svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback' });
    expect(social.createState).toHaveBeenCalledWith(expect.objectContaining({ nonce: expect.any(String) }));
    expect(r.authorizeUrl).toBe('https://auth/url');
  });

  it('createAuthorization 拒绝白名单外的 redirectUri（含同前缀的伪造路径）', async () => {
    const { svc } = deps();
    await expect(
      svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback-evil' }),
    ).rejects.toThrow('OAUTH_REDIRECT_NOT_ALLOWED');
    await expect(
      svc.createAuthorization({ provider: 'google', systemCode: 'sys', clientType: 'web', redirectUri: 'http://evil.com/oauth/callback' }),
    ).rejects.toThrow('OAUTH_REDIRECT_NOT_ALLOWED');
  });

  it('createAuthorization 对未 launched provider 抛 OAUTH_PROVIDER_NOT_LAUNCHED', async () => {
    const { svc, social, registry } = deps();
    // Override registry.isLaunched to resolve false for apple
    registry.isLaunched.mockImplementation(async (name: string) => name !== 'apple');
    await expect(
      svc.createAuthorization({ provider: 'apple', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback' }),
    ).rejects.toThrow('OAUTH_PROVIDER_NOT_LAUNCHED');
    expect(social.createState).not.toHaveBeenCalled();
  });

  it('handleCallback 成功 → 建会话 + 一次性码 + 回跳 redirectUri', async () => {
    const { svc, social, sessionRepo, campaignRewards } = deps();
    const r = await svc.handleCallback({ provider: 'google', code: 'c', state: 'st', ip: '1.1.1.1', userAgent: 'UA' });
    expect(sessionRepo.create).not.toHaveBeenCalled(); // session created via authService.issueSessionForUser
    expect(social.createLoginCode).toHaveBeenCalled();
    expect(campaignRewards.grantRegistrationBonus).not.toHaveBeenCalled();
    expect(r.redirectUri).toBe('http://web/oauth/callback');
    expect(typeof r.loginCode).toBe('string');
  });

  it('handleCallback OAuth 新用户 → best-effort 发注册奖励', async () => {
    const { svc, resolution, campaignRewards } = deps();
    resolution.resolve.mockResolvedValueOnce({ kind: 'login', userId: 'u1', created: true });

    const r = await svc.handleCallback({ provider: 'google', code: 'c', state: 'st', ip: '', userAgent: '' });

    expect(r.loginCode).toEqual(expect.any(String));
    expect(campaignRewards.grantRegistrationBonus).toHaveBeenCalledWith('u1', 'oauth_first_login');
  });

  it('handleCallback 注册奖励失败不阻断 OAuth 登录', async () => {
    const { svc, resolution, campaignRewards } = deps();
    resolution.resolve.mockResolvedValueOnce({ kind: 'login', userId: 'u1', created: true });
    campaignRewards.grantRegistrationBonus.mockRejectedValueOnce(new Error('boom'));

    const r = await svc.handleCallback({ provider: 'google', code: 'c', state: 'st', ip: '', userAgent: '' });

    expect(r.loginCode).toEqual(expect.any(String));
    expect(campaignRewards.grantRegistrationBonus).toHaveBeenCalledTimes(1);
  });

  it('handleCallback 邮箱冲突 → 回跳带 errorCode，不建码', async () => {
    const { svc, resolution, social, campaignRewards } = deps();
    resolution.resolve.mockResolvedValueOnce({ kind: 'conflict', code: 'OAUTH_EMAIL_UNVERIFIED_CONFLICT' });
    const r = await svc.handleCallback({ provider: 'google', code: 'c', state: 'st', ip: '', userAgent: '' });
    expect(r.errorCode).toBe('OAUTH_EMAIL_UNVERIFIED_CONFLICT');
    expect(social.createLoginCode).not.toHaveBeenCalled();
    expect(campaignRewards.grantRegistrationBonus).not.toHaveBeenCalled();
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

  it('handleCallback 不吞会话签发失败', async () => {
    const { ForbiddenException } = await import('@nestjs/common');
    const { svc, authService } = deps();
    authService.issueSessionForUser.mockRejectedValueOnce(new ForbiddenException('其他禁用原因'));
    await expect(
      svc.handleCallback({ provider: 'google', code: 'c', state: 'st', ip: '', userAgent: '' }),
    ).rejects.toThrow('其他禁用原因');
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
    identity.findUserAccount = vi.fn().mockResolvedValue(null);
    identity.createUserAccount = vi.fn().mockResolvedValue(undefined);
    const r = await svc.handleCallback({ provider: 'github', code: 'c', state: 'st', ip: '', userAgent: '' });
    expect(identity.createUserAccount).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', provider: 'github' }));
    expect(r.linked).toBe('github');
    expect(r.loginCode).toBeUndefined();
  });

  it('handleCallback 绑定分支：账号已属他人 → 冲突', async () => {
    const { svc, social, identity } = deps();
    social.consumeState.mockResolvedValueOnce({ provider: 'github', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback', codeVerifier: 'cv', nonce: 'nn', linkUserId: 'u1' });
    identity.findUserAccount = vi.fn().mockResolvedValue({ userId: 'someone-else' });
    const r = await svc.handleCallback({ provider: 'github', code: 'c', state: 'st', ip: '', userAgent: '' });
    expect(r.errorCode).toBe('OAUTH_ACCOUNT_ALREADY_LINKED');
  });

  it('unlink 保留最后凭证 → 抛错', async () => {
    const { svc, identity } = deps();
    identity.hasOtherCredential = vi.fn().mockResolvedValue(false);
    await expect(svc.unlink('u1', 'github', 'proof-1', 'session-1')).rejects.toThrow('OAUTH_CANNOT_UNLINK_LAST_CREDENTIAL');
  });

  it('unlink 仍有其它凭证 → 删除', async () => {
    const { svc, identity, stepUp } = deps();
    identity.hasOtherCredential = vi.fn().mockResolvedValue(true);
    identity.deleteUserAccount = vi.fn().mockResolvedValue(undefined);
    await svc.unlink('u1', 'github', 'proof-1', 'session-1');
    // 安全（#3）：删除前必须先校验+消费 step-up proof
    expect(stepUp.verifyAndConsumeProof).toHaveBeenCalledWith('proof-1', 'u1', 'unlink-provider', 'session-1');
    expect(identity.deleteUserAccount).toHaveBeenCalledWith('u1', 'github');
  });
});

describe('OAuthService REAUTH', () => {
  it('startReauth 只选择明确支持强重认证的已绑定 provider', async () => {
    const { svc, identity, social, provider } = deps();
    identity.findUserAccountsByUserId.mockResolvedValueOnce([{ provider: 'google' }]);

    const result = await svc.startReauth({
      userId: 'u1',
      sessionId: 'session-1',
      purpose: 'delete-account',
      clientType: 'web',
      redirectUri: 'http://web/oauth/callback',
    });

    expect(result).toMatchObject({ kind: 'redirect', provider: 'google' });
    expect(social.createState).toHaveBeenCalledWith(expect.objectContaining({
      flow: 'REAUTH',
      linkUserId: 'u1',
      sessionId: 'session-1',
      purpose: 'STEP_UP_DELETE_ACCOUNT',
    }));
    expect(provider.buildAuthorizeUrl).toHaveBeenCalledWith(expect.objectContaining({ reauth: true }));
  });

  it('startReauth 对不支持强重认证的 provider 返回 null 以回退 OTP', async () => {
    const { svc, identity, social } = deps();
    identity.findUserAccountsByUserId.mockResolvedValueOnce([{ provider: 'github' }]);

    await expect(svc.startReauth({
      userId: 'u1',
      sessionId: 'session-1',
      purpose: 'change-password',
      clientType: 'web',
      redirectUri: 'http://web/oauth/callback',
    })).resolves.toBeNull();
    expect(social.createState).not.toHaveBeenCalled();
  });

  it('callback 为匹配账号和新鲜 auth_time 签发 session-bound proof', async () => {
    const { svc, social, provider, identity, stepUp, authService } = deps();
    const nowSeconds = Math.floor(Date.now() / 1000);
    social.consumeState.mockResolvedValueOnce({
      provider: 'google',
      flow: 'REAUTH',
      redirectUri: 'http://web/oauth/callback',
      codeVerifier: 'cv',
      nonce: 'nn',
      linkUserId: 'u1',
      sessionId: 'session-1',
      purpose: 'STEP_UP_DELETE_ACCOUNT',
      createdAt: new Date(Date.now() - 1_000),
    });
    provider.fetchProfile.mockResolvedValueOnce({
      provider: 'google',
      providerAccountId: 'sub1',
      authTime: nowSeconds,
      tokens: { accessToken: 'at' },
    });
    identity.findUserAccount.mockResolvedValueOnce({ userId: 'u1' });

    await expect(svc.handleCallback({
      provider: 'google', code: 'c', state: 'st', ip: '', userAgent: '',
    })).resolves.toEqual({
      redirectUri: 'http://web/oauth/callback',
      proof: 'proof',
      purpose: 'delete-account',
    });
    expect(stepUp.signOAuthProof).toHaveBeenCalledWith('u1', 'delete-account', 'session-1');
    expect(authService.issueSessionForUser).not.toHaveBeenCalled();
  });

  it.each([
    ['provider account mismatch', { userId: 'other' }, Math.floor(Date.now() / 1000)],
    ['stale auth_time', { userId: 'u1' }, Math.floor((Date.now() - 10 * 60_000) / 1000)],
  ])('callback rejects %s without signing a proof', async (_label, account, authTime) => {
    const { svc, social, provider, identity, stepUp } = deps();
    social.consumeState.mockResolvedValueOnce({
      provider: 'google',
      flow: 'REAUTH',
      redirectUri: 'http://web/oauth/callback',
      codeVerifier: 'cv',
      nonce: 'nn',
      linkUserId: 'u1',
      sessionId: 'session-1',
      purpose: 'STEP_UP_CHANGE_PASSWORD',
      createdAt: new Date(),
    });
    provider.fetchProfile.mockResolvedValueOnce({
      provider: 'google', providerAccountId: 'sub1', authTime, tokens: { accessToken: 'at' },
    });
    identity.findUserAccount.mockResolvedValueOnce(account);

    await expect(svc.handleCallback({
      provider: 'google', code: 'c', state: 'st', ip: '', userAgent: '',
    })).resolves.toEqual({
      redirectUri: 'http://web/oauth/callback',
      errorCode: 'STEP_UP_INVALID_OR_EXPIRED',
    });
    expect(stepUp.signOAuthProof).not.toHaveBeenCalled();
  });
});
