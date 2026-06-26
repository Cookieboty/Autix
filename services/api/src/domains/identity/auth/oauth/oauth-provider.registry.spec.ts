import { OAuthProviderRegistry } from './oauth-provider.registry';

const fakeGoogle = { name: 'google' } as any;
const fakeApple = { name: 'apple' } as any;
const fakeGitHub = { name: 'github' } as any;

const emptyConfig = { googleClientId: '', googleClientSecret: '', appleClientId: '', appleTeamId: '', appleKeyId: '', applePrivateKey: '', githubClientId: '', githubClientSecret: '' };

const googleOnly = (overrides: Partial<{ googleClientId: string; googleClientSecret: string }> = {}) =>
  ({ ...emptyConfig, ...overrides } as any);

const appleOnly = (overrides: Partial<{ appleClientId: string; appleTeamId: string; appleKeyId: string; applePrivateKey: string }> = {}) =>
  ({ ...emptyConfig, ...overrides } as any);

const githubOnly = (overrides: Partial<{ githubClientId: string; githubClientSecret: string }> = {}) =>
  ({ ...emptyConfig, ...overrides } as any);

describe('OAuthProviderRegistry', () => {
  it('缺 clientId 或缺 clientSecret 时 google 不启用', () => {
    const noId = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, googleOnly({ googleClientId: '', googleClientSecret: 'sec' }));
    expect(noId.isEnabled('google')).toBe(false);
    const noSecret = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, googleOnly({ googleClientId: 'cid', googleClientSecret: '' }));
    expect(noSecret.isEnabled('google')).toBe(false);
    expect(noSecret.listEnabled()).toEqual([]);
    expect(() => noSecret.get('google')).toThrow('OAUTH_PROVIDER_DISABLED');
  });
  it('clientId + clientSecret 都齐时 google 启用', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, googleOnly({ googleClientId: 'cid', googleClientSecret: 'sec' }));
    expect(reg.isEnabled('google')).toBe(true);
    expect(reg.listEnabled()).toEqual(['google']);
    expect(reg.get('google')).toBe(fakeGoogle);
  });
  it('apple 四个字段齐全时启用', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, appleOnly({ appleClientId: 'cid', appleTeamId: 'tid', appleKeyId: 'kid', applePrivateKey: 'pk' }));
    expect(reg.isEnabled('apple')).toBe(true);
    expect(reg.listEnabled()).toEqual(['apple']);
    expect(reg.get('apple')).toBe(fakeApple);
  });
  it('apple 任一字段缺失时不启用', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, appleOnly({ appleClientId: 'cid', appleTeamId: 'tid', appleKeyId: 'kid', applePrivateKey: '' }));
    expect(reg.isEnabled('apple')).toBe(false);
  });
  it('github clientId + clientSecret 都齐时启用', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, githubOnly({ githubClientId: 'ghid', githubClientSecret: 'ghsec' }));
    expect(reg.isEnabled('github')).toBe(true);
    expect(reg.listEnabled()).toEqual(['github']);
    expect(reg.get('github')).toBe(fakeGitHub);
  });
  it('github 缺 clientSecret 时不启用', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, githubOnly({ githubClientId: 'ghid', githubClientSecret: '' }));
    expect(reg.isEnabled('github')).toBe(false);
    expect(() => reg.get('github')).toThrow('OAUTH_PROVIDER_DISABLED');
  });
});

const allEnabledConfig: any = {
  googleClientId: 'gcid', googleClientSecret: 'gsec',
  appleClientId: 'acid', appleTeamId: 'atid', appleKeyId: 'akid', applePrivateKey: 'apk',
  githubClientId: 'ghid', githubClientSecret: 'ghsec',
};

describe('OAuthProviderRegistry launched gate', () => {
  afterEach(() => { delete process.env.OAUTH_LAUNCHED_PROVIDERS; });

  it('OAUTH_LAUNCHED_PROVIDERS 未设置时默认只有 google 是 launched', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, allEnabledConfig);
    expect(reg.isLaunched('google')).toBe(true);
    expect(reg.isLaunched('apple')).toBe(false);
    expect(reg.isLaunched('github')).toBe(false);
  });

  it('OAUTH_LAUNCHED_PROVIDERS 未设置，三个 provider 均 enabled → getAvailability 返回正确分组', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, allEnabledConfig);
    const avail = reg.getAvailability();
    expect(avail.providers).toEqual(['google']);
    expect(avail.comingSoon).toEqual(expect.arrayContaining(['apple', 'github']));
    expect(avail.comingSoon).toHaveLength(2);
  });

  it('OAUTH_LAUNCHED_PROVIDERS=google,github → github 也成为 launched，providers 含 github', () => {
    process.env.OAUTH_LAUNCHED_PROVIDERS = 'google,github';
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, allEnabledConfig);
    expect(reg.isLaunched('github')).toBe(true);
    expect(reg.isLaunched('apple')).toBe(false);
    const avail = reg.getAvailability();
    expect(avail.providers).toContain('google');
    expect(avail.providers).toContain('github');
    expect(avail.comingSoon).toEqual(['apple']);
  });

  it('OAUTH_LAUNCHED_PROVIDERS 空字符串时回退到默认 google', () => {
    process.env.OAUTH_LAUNCHED_PROVIDERS = '';
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, fakeGitHub, allEnabledConfig);
    expect(reg.isLaunched('google')).toBe(true);
    expect(reg.isLaunched('apple')).toBe(false);
  });
});
