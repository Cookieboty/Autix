import { SYSTEM_SETTING_DEFINITIONS, findSystemSettingDefinition } from './system-settings.registry';

const OAUTH_KEYS = [
  'oauth.launchedProviders','oauth.webRedirectAllowlist',
  'oauth.googleClientId','oauth.googleClientSecret','oauth.googleRedirectUri',
  'oauth.githubClientId','oauth.githubClientSecret','oauth.githubRedirectUri',
  'oauth.appleClientId','oauth.appleTeamId','oauth.appleKeyId','oauth.applePrivateKey','oauth.appleRedirectUri',
];

describe('oauth system settings', () => {
  it('注册全部 13 个 oauth.* key,category=oauth', () => {
    for (const k of OAUTH_KEYS) {
      const d = findSystemSettingDefinition(k);
      expect(d).toBeTruthy();
      expect(d!.category).toBe('oauth');
    }
  });
  it('secret 字段标记 sensitive', () => {
    for (const k of ['oauth.googleClientSecret','oauth.githubClientSecret','oauth.applePrivateKey']) {
      expect(findSystemSettingDefinition(k)!.sensitive).toBe(true);
    }
  });
  it('envKeys 指向现有 OAUTH_*(向后兼容)', () => {
    expect(findSystemSettingDefinition('oauth.googleClientId')!.envKeys).toEqual(['OAUTH_GOOGLE_CLIENT_ID']);
    expect(findSystemSettingDefinition('oauth.launchedProviders')!.envKeys).toEqual(['OAUTH_LAUNCHED_PROVIDERS']);
  });
});
