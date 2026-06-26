import { describe, expect, it } from 'bun:test';
import { mapOAuthErrorKey } from '../src/auth/oauth-error';

describe('mapOAuthErrorKey', () => {
  it('已知码映射到专属文案 key', () => {
    expect(mapOAuthErrorKey('OAUTH_EMAIL_UNVERIFIED_CONFLICT')).toBe('oauthEmailConflict');
    expect(mapOAuthErrorKey('OAUTH_EXCHANGE_EXPIRED')).toBe('oauthExpired');
    expect(mapOAuthErrorKey('OAUTH_PROVIDER_DISABLED')).toBe('oauthProviderDisabled');
  });
  it('未知/空码回退通用文案', () => {
    expect(mapOAuthErrorKey('SOMETHING_ELSE')).toBe('oauthGenericError');
    expect(mapOAuthErrorKey(null)).toBe('oauthGenericError');
  });
});
