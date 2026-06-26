import { OAuthProviderRegistry } from './oauth-provider.registry';

const fakeGoogle = { name: 'google' } as any;

describe('OAuthProviderRegistry', () => {
  it('缺 clientId 或缺 clientSecret 时 google 不启用', () => {
    const noId = new OAuthProviderRegistry(fakeGoogle, { googleClientId: '', googleClientSecret: 'sec' } as any);
    expect(noId.isEnabled('google')).toBe(false);
    const noSecret = new OAuthProviderRegistry(fakeGoogle, { googleClientId: 'cid', googleClientSecret: '' } as any);
    expect(noSecret.isEnabled('google')).toBe(false);
    expect(noSecret.listEnabled()).toEqual([]);
    expect(() => noSecret.get('google')).toThrow('OAUTH_PROVIDER_DISABLED');
  });
  it('clientId + clientSecret 都齐时 google 启用', () => {
    const reg = new OAuthProviderRegistry(fakeGoogle, { googleClientId: 'cid', googleClientSecret: 'sec' } as any);
    expect(reg.isEnabled('google')).toBe(true);
    expect(reg.listEnabled()).toEqual(['google']);
    expect(reg.get('google')).toBe(fakeGoogle);
  });
});
