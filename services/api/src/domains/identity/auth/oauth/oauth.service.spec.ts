import { OAuthService } from './oauth.service';

function deps() {
  const provider = {
    name: 'google',
    buildAuthorizeUrl: jest.fn().mockReturnValue('https://auth/url'),
    exchangeCode: jest.fn().mockResolvedValue({ accessToken: 'at', idToken: 'jwt' }),
    fetchProfile: jest.fn().mockResolvedValue({ provider: 'google', providerAccountId: 'sub1', email: 'a@x.com', emailVerified: true, displayName: 'A', avatar: null, raw: {}, tokens: { accessToken: 'at' } }),
  };
  const registry = { isEnabled: () => true, get: () => provider, listEnabled: () => ['google'] };
  const resolution = { resolve: jest.fn().mockResolvedValue({ kind: 'login', userId: 'u1' }) };
  const authService = {
    issueSessionForUser: jest.fn().mockResolvedValue({ loginResult: { accessToken: 'AT', refreshToken: 'RT', expiresIn: 3600, status: 'ACTIVE', language: 'zh-CN', systems: [], currentSystemId: 's1' }, sessionId: 'sess1' }),
    buildLoginResultFromSession: jest.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT', expiresIn: 3600, status: 'ACTIVE', language: 'zh-CN', systems: [], currentSystemId: 's1' }),
  };
  const identity = {
    findSystemByCode: jest.fn().mockResolvedValue({ id: 's1' }),
    findLoginUserById: jest.fn().mockResolvedValue({ id: 'u1', username: 'a', status: 'ACTIVE', language: 'zh-CN', isSuperAdmin: false, roles: [] }),
  };
  const sessionRepo = { create: jest.fn().mockResolvedValue({ id: 'sess1', refreshToken: 'RT' }) };
  const social = {
    createState: jest.fn().mockResolvedValue({}),
    consumeState: jest.fn().mockResolvedValue({ provider: 'google', systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback', codeVerifier: 'cv', nonce: 'nn', inviteCode: null, deviceId: null, linkUserId: null }),
    createLoginCode: jest.fn().mockResolvedValue({}),
    consumeLoginCode: jest.fn().mockResolvedValue({ sessionId: 'sess1' }),
  };
  const invite = { recordInvitation: jest.fn() };
  const svc = new OAuthService(registry as any, resolution as any, authService as any, identity as any, sessionRepo as any, social as any, invite as any);
  return { svc, provider, resolution, authService, social, sessionRepo };
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
