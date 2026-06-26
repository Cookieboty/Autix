import { OAuthConfigService } from './oauth-config.service';

function settingsMock(map: Record<string,string>) {
  return { getString: jest.fn(async (k: string) => map[k] ?? '') };
}

describe('OAuthConfigService', () => {
  it('getGoogleConfig 读三个 key', async () => {
    const s = settingsMock({ 'oauth.googleClientId':'cid','oauth.googleClientSecret':'sec','oauth.googleRedirectUri':'http://cb' });
    const svc = new OAuthConfigService(s as any);
    expect(await svc.getGoogleConfig()).toEqual({ clientId:'cid', clientSecret:'sec', redirectUri:'http://cb' });
  });
  it('getLaunchedProviders 空值默认 google', async () => {
    const svc = new OAuthConfigService(settingsMock({}) as any);
    expect(await svc.getLaunchedProviders()).toEqual(['google']);
  });
  it('getLaunchedProviders 解析逗号', async () => {
    const svc = new OAuthConfigService(settingsMock({ 'oauth.launchedProviders':'google, github' }) as any);
    expect(await svc.getLaunchedProviders()).toEqual(['google','github']);
  });
  it('getWebRedirectAllowlist 解析逗号、过滤空', async () => {
    const svc = new OAuthConfigService(settingsMock({ 'oauth.webRedirectAllowlist':'http://a, ,http://b' }) as any);
    expect(await svc.getWebRedirectAllowlist()).toEqual(['http://a','http://b']);
  });
  it('getAppleConfig 还原私钥换行', async () => {
    const svc = new OAuthConfigService(settingsMock({ 'oauth.applePrivateKey':'line1\\nline2' }) as any);
    expect((await svc.getAppleConfig()).privateKey).toBe('line1\nline2');
  });

  // env 回退由 SystemSettingsService.getString 负责(DB 无行→返回 registry defaultValue=启动时 env 值);
  // 这里验证 OAuthConfigService 如实透传该回退值(模拟 DB-miss 时 getString 返回 env 默认)。
  it('DB 无值时透传 env 默认(getString 返回 registry defaultValue)', async () => {
    const s = { getString: jest.fn(async (k: string) => (k === 'oauth.googleClientId' ? 'env-default-cid' : '')) };
    const svc = new OAuthConfigService(s as any);
    expect((await svc.getGoogleConfig()).clientId).toBe('env-default-cid');
  });
});
