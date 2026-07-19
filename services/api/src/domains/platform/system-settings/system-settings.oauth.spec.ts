import { SYSTEM_SETTING_DEFINITIONS, findSystemSettingDefinition } from './system-settings.registry';

// 从注册表派生而非手抄：手抄清单在新增 key 时不会红，新 key 静默漏测。
const OAUTH_KEYS = SYSTEM_SETTING_DEFINITIONS
  .filter((d) => d.key.startsWith('oauth.'))
  .map((d) => d.key);

describe('oauth system settings', () => {
  it('oauth.* key 与 category=oauth 一一对应', () => {
    expect(OAUTH_KEYS.length).toBeGreaterThan(0);
    // 双向：前缀是 oauth. 的必须归类 oauth，归类 oauth 的必须以 oauth. 开头。
    for (const k of OAUTH_KEYS) {
      expect(findSystemSettingDefinition(k)!.category).toBe('oauth');
    }
    const byCategory = SYSTEM_SETTING_DEFINITIONS
      .filter((d) => d.category === 'oauth')
      .map((d) => d.key)
      .sort();
    expect(byCategory).toEqual([...OAUTH_KEYS].sort());
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
