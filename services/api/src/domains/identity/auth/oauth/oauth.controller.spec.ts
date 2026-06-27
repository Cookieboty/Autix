import { OAuthController } from './oauth.controller';

function resMock() {
  const res: any = { redirectedTo: '', redirect: (url: string) => { res.redirectedTo = url; } };
  return res;
}
function reqMock() {
  return { ip: '2.2.2.2', socket: { remoteAddress: '2.2.2.2' }, headers: { 'user-agent': 'UA' } } as any;
}

describe('OAuthController', () => {
  it('providers 返回 availability 对象（providers + comingSoon）', async () => {
    const registry = { getAvailability: jest.fn().mockResolvedValue({ providers: ['google'], comingSoon: ['apple', 'github'] }) } as any;
    const ctrl = new OAuthController({} as any, registry);
    expect(await ctrl.providers()).toEqual({ providers: ['google'], comingSoon: ['apple', 'github'] });
  });

  it('authorize 返回授权 URL', async () => {
    const service = { createAuthorization: jest.fn().mockResolvedValue({ authorizeUrl: 'https://u' }) } as any;
    const ctrl = new OAuthController(service, {} as any);
    const r = await ctrl.authorize('google', { systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback' } as any);
    expect(r).toEqual({ authorizeUrl: 'https://u' });
  });

  it('callback 成功 → 302 到 redirectUri?code=...', async () => {
    const service = { handleCallback: jest.fn().mockResolvedValue({ redirectUri: 'http://web/oauth/callback', loginCode: 'LC' }) } as any;
    const ctrl = new OAuthController(service, {} as any);
    const res = resMock();
    await ctrl.callbackGet('google', { code: 'c', state: 's' } as any, reqMock(), res);
    expect(res.redirectedTo).toBe('http://web/oauth/callback?code=LC');
  });

  it('callback 冲突 → 302 带 error', async () => {
    const service = { handleCallback: jest.fn().mockResolvedValue({ redirectUri: 'http://web/oauth/callback', errorCode: 'OAUTH_EMAIL_UNVERIFIED_CONFLICT' }) } as any;
    const ctrl = new OAuthController(service, {} as any);
    const res = resMock();
    await ctrl.callbackGet('google', { code: 'c', state: 's' } as any, reqMock(), res);
    expect(res.redirectedTo).toBe('http://web/oauth/callback?error=OAUTH_EMAIL_UNVERIFIED_CONFLICT');
  });

  it('callback 用户拒绝授权 → 302 到 redirectUri?error=OAUTH_PROVIDER_DENIED', async () => {
    const service = { handleCallback: jest.fn().mockResolvedValue({ redirectUri: 'http://web/oauth/callback', errorCode: 'OAUTH_PROVIDER_DENIED' }) } as any;
    const ctrl = new OAuthController(service, {} as any);
    const res = resMock();
    await ctrl.callbackGet('google', { error: 'access_denied', state: 's' } as any, reqMock(), res);
    expect(res.redirectedTo).toBe('http://web/oauth/callback?error=OAUTH_PROVIDER_DENIED');
  });

  it('exchange 返回 LoginResult', async () => {
    const service = { exchangeLoginCode: jest.fn().mockResolvedValue({ accessToken: 'AT' }) } as any;
    const ctrl = new OAuthController(service, {} as any);
    expect(await ctrl.exchange({ code: 'LC' } as any)).toEqual({ accessToken: 'AT' });
  });

  it('callbackPost Apple form_post error → 302 到 redirectUri?error=OAUTH_PROVIDER_DENIED', async () => {
    const service = { handleCallback: jest.fn().mockResolvedValue({ redirectUri: 'http://web/oauth/callback', errorCode: 'OAUTH_PROVIDER_DENIED' }) } as any;
    const ctrl = new OAuthController(service, {} as any);
    const res = resMock();
    await ctrl.callbackPost('apple', { error: 'user_cancelled_authorize', state: 's' } as any, reqMock(), res);
    expect(service.handleCallback).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'apple', error: 'user_cancelled_authorize', state: 's',
    }));
    expect(res.redirectedTo).toBe('http://web/oauth/callback?error=OAUTH_PROVIDER_DENIED');
  });

  it('callbackPost 解析 user 字段并 302 回 redirectUri?code=', async () => {
    const service = { handleCallback: jest.fn().mockResolvedValue({ redirectUri: 'http://127.0.0.1:5/callback', loginCode: 'LC' }) } as any;
    const ctrl = new OAuthController(service, {} as any);
    const res = resMock();
    await ctrl.callbackPost('apple', { code: 'c', state: 's', user: '{"name":{"firstName":"Tim"}}' } as any, reqMock(), res);
    expect(service.handleCallback).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'apple', code: 'c', state: 's',
      extraParams: { user: { name: { firstName: 'Tim' } } },
    }));
    expect(res.redirectedTo).toBe('http://127.0.0.1:5/callback?code=LC');
  });

  const user = { id: 'u1' } as any;

  it('linkedAccounts 返回当前用户绑定列表', async () => {
    const service = { listLinkedAccounts: jest.fn().mockResolvedValue(['google']) } as any;
    const ctrl = new OAuthController(service, {} as any);
    expect(await ctrl.linkedAccounts(user)).toEqual({ providers: ['google'] });
    expect(service.listLinkedAccounts).toHaveBeenCalledWith('u1');
  });

  it('link 带 linkUserId 发起授权', async () => {
    const service = { createAuthorization: jest.fn().mockResolvedValue({ authorizeUrl: 'https://u' }) } as any;
    const ctrl = new OAuthController(service, {} as any);
    const r = await ctrl.link('github', { systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback' } as any, user);
    expect(service.createAuthorization).toHaveBeenCalledWith(expect.objectContaining({ provider: 'github', linkUserId: 'u1' }));
    expect(r).toEqual({ authorizeUrl: 'https://u' });
  });

  it('unlink 调 service.unlink', async () => {
    const service = { unlink: jest.fn().mockResolvedValue(undefined) } as any;
    const ctrl = new OAuthController(service, {} as any);
    expect(await ctrl.unlink('github', user)).toEqual({ success: true });
    expect(service.unlink).toHaveBeenCalledWith('u1', 'github');
  });
});
