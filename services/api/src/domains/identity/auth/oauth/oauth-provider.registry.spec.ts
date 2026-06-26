import { OAuthProviderRegistry } from './oauth-provider.registry';

const fakeGoogle = { name: 'google' } as any;
const fakeApple = { name: 'apple' } as any;
const fakeGitHub = { name: 'github' } as any;

function makeConfig(overrides: {
  google?: { clientId: string; clientSecret: string };
  github?: { clientId: string; clientSecret: string };
  apple?: { clientId: string; teamId: string; keyId: string; privateKey: string };
  launched?: string[];
} = {}) {
  return {
    getGoogleConfig: async () => ({ clientId: overrides.google?.clientId ?? '', clientSecret: overrides.google?.clientSecret ?? '', redirectUri: '' }),
    getGitHubConfig: async () => ({ clientId: overrides.github?.clientId ?? '', clientSecret: overrides.github?.clientSecret ?? '', redirectUri: '' }),
    getAppleConfig: async () => ({ clientId: overrides.apple?.clientId ?? '', teamId: overrides.apple?.teamId ?? '', keyId: overrides.apple?.keyId ?? '', privateKey: overrides.apple?.privateKey ?? '', redirectUri: '' }),
    getLaunchedProviders: async () => overrides.launched ?? ['google'],
    getWebRedirectAllowlist: async () => [],
  } as any;
}

describe('OAuthProviderRegistry', () => {
  it('getInstance 未知名称抛 OAUTH_PROVIDER_DISABLED', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, makeConfig());
    expect(() => reg.getInstance('unknown')).toThrow('OAUTH_PROVIDER_DISABLED');
  });

  it('getInstance 已知名称返回实例', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, makeConfig());
    expect(reg.getInstance('google')).toBe(fakeGoogle);
    expect(reg.getInstance('apple')).toBe(fakeApple);
    expect(reg.getInstance('github')).toBe(fakeGitHub);
  });

  it('isEnabled: google clientId + clientSecret 齐全 → true', async () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, makeConfig({ google: { clientId: 'cid', clientSecret: 'sec' } }));
    expect(await reg.isEnabled('google')).toBe(true);
  });

  it('isEnabled: google 缺 clientSecret → false', async () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, makeConfig({ google: { clientId: 'cid', clientSecret: '' } }));
    expect(await reg.isEnabled('google')).toBe(false);
  });

  it('isEnabled: github clientId + clientSecret 齐全 → true', async () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, makeConfig({ github: { clientId: 'ghid', clientSecret: 'ghsec' } }));
    expect(await reg.isEnabled('github')).toBe(true);
  });

  it('isEnabled: apple 四字段齐全 → true', async () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, makeConfig({ apple: { clientId: 'cid', teamId: 'tid', keyId: 'kid', privateKey: 'pk' } }));
    expect(await reg.isEnabled('apple')).toBe(true);
  });

  it('isEnabled: apple 缺 privateKey → false', async () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, makeConfig({ apple: { clientId: 'cid', teamId: 'tid', keyId: 'kid', privateKey: '' } }));
    expect(await reg.isEnabled('apple')).toBe(false);
  });

  it('isEnabled: 未知 provider → false', async () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, makeConfig());
    expect(await reg.isEnabled('unknown')).toBe(false);
  });
});

describe('OAuthProviderRegistry getAvailability', () => {
  it('google 配齐 + launched=google → providers=[google], comingSoon 含 apple/github', async () => {
    const config = makeConfig({
      google: { clientId: 'gcid', clientSecret: 'gsec' },
      launched: ['google'],
    });
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, config);
    const avail = await reg.getAvailability();
    expect(avail.providers).toEqual(['google']);
    expect(avail.comingSoon).toEqual(expect.arrayContaining(['apple', 'github']));
    expect(avail.comingSoon).toHaveLength(2);
  });

  it('github 配齐且 launched 含 github → providers 含 github', async () => {
    const config = makeConfig({
      google: { clientId: 'gcid', clientSecret: 'gsec' },
      github: { clientId: 'ghid', clientSecret: 'ghsec' },
      launched: ['google', 'github'],
    });
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, config);
    const avail = await reg.getAvailability();
    expect(avail.providers).toContain('google');
    expect(avail.providers).toContain('github');
    expect(avail.comingSoon).toEqual(['apple']);
  });

  it('全空配置 → providers=[], comingSoon 只含未 launched 项', async () => {
    const config = makeConfig({ launched: ['google'] });
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, config);
    const avail = await reg.getAvailability();
    expect(avail.providers).toEqual([]);
    expect(avail.comingSoon).toEqual(expect.arrayContaining(['apple', 'github']));
  });

  it('isLaunched 异步返回 launched 状态', async () => {
    const config = makeConfig({ launched: ['google', 'github'] });
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, config);
    expect(await reg.isLaunched('google')).toBe(true);
    expect(await reg.isLaunched('github')).toBe(true);
    expect(await reg.isLaunched('apple')).toBe(false);
  });
});
