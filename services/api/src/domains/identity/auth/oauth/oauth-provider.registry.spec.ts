import { OAuthProviderRegistry } from './oauth-provider.registry';

const fakeGoogle = { name: 'google' } as any;
const fakeApple = { name: 'apple' } as any;

const googleOnly = (overrides: Partial<{ googleClientId: string; googleClientSecret: string }> = {}) =>
  ({ googleClientId: '', googleClientSecret: '', appleClientId: '', appleTeamId: '', appleKeyId: '', applePrivateKey: '', ...overrides } as any);

const appleOnly = (overrides: Partial<{ appleClientId: string; appleTeamId: string; appleKeyId: string; applePrivateKey: string }> = {}) =>
  ({ googleClientId: '', googleClientSecret: '', appleClientId: '', appleTeamId: '', appleKeyId: '', applePrivateKey: '', ...overrides } as any);

describe('OAuthProviderRegistry', () => {
  it('缺 clientId 或缺 clientSecret 时 google 不启用', () => {
    const noId = new OAuthProviderRegistry(fakeGoogle, fakeApple, googleOnly({ googleClientId: '', googleClientSecret: 'sec' }));
    expect(noId.isEnabled('google')).toBe(false);
    const noSecret = new OAuthProviderRegistry(fakeGoogle, fakeApple, googleOnly({ googleClientId: 'cid', googleClientSecret: '' }));
    expect(noSecret.isEnabled('google')).toBe(false);
    expect(noSecret.listEnabled()).toEqual([]);
    expect(() => noSecret.get('google')).toThrow('OAUTH_PROVIDER_DISABLED');
  });
  it('clientId + clientSecret 都齐时 google 启用', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, googleOnly({ googleClientId: 'cid', googleClientSecret: 'sec' }));
    expect(reg.isEnabled('google')).toBe(true);
    expect(reg.listEnabled()).toEqual(['google']);
    expect(reg.get('google')).toBe(fakeGoogle);
  });
  it('apple 四个字段齐全时启用', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, appleOnly({ appleClientId: 'cid', appleTeamId: 'tid', appleKeyId: 'kid', applePrivateKey: 'pk' }));
    expect(reg.isEnabled('apple')).toBe(true);
    expect(reg.listEnabled()).toEqual(['apple']);
    expect(reg.get('apple')).toBe(fakeApple);
  });
  it('apple 任一字段缺失时不启用', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, fakeApple, appleOnly({ appleClientId: 'cid', appleTeamId: 'tid', appleKeyId: 'kid', applePrivateKey: '' }));
    expect(reg.isEnabled('apple')).toBe(false);
  });
});
