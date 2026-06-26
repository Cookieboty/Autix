import { encryptProviderTokens } from './encrypt-tokens';
import { TokenCipher } from './token-cipher';
import { NormalizedProfile } from './provider.types';

describe('encryptProviderTokens', () => {
  const HEX_KEY = '0'.repeat(64);
  let cipher: TokenCipher;

  beforeEach(() => {
    cipher = new TokenCipher(HEX_KEY);
  });

  const makeProfile = (overrides: Partial<NormalizedProfile['tokens']> = {}): NormalizedProfile => ({
    provider: 'google',
    providerAccountId: 'uid-123',
    email: 'user@example.com',
    emailVerified: true,
    displayName: 'Test User',
    avatar: null,
    raw: { sub: 'uid-123' },
    tokens: {
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
      idToken: 'id-tok',
      expiresAt: new Date('2030-01-01'),
      scope: 'openid email',
      tokenType: 'Bearer',
      ...overrides,
    },
  });

  it('encrypts accessToken, refreshToken, and idToken', () => {
    const encryptSpy = jest.spyOn(cipher, 'encrypt');
    const profile = makeProfile();
    const result = encryptProviderTokens(cipher, profile);

    expect(encryptSpy).toHaveBeenCalledWith('access-tok');
    expect(encryptSpy).toHaveBeenCalledWith('refresh-tok');
    expect(encryptSpy).toHaveBeenCalledWith('id-tok');
    expect(result.accessToken).not.toBe('access-tok');
    expect(result.refreshToken).not.toBe('refresh-tok');
    expect(result.idToken).not.toBe('id-tok');
  });

  it('passes through provider identity and passthrough fields unchanged', () => {
    const profile = makeProfile();
    const result = encryptProviderTokens(cipher, profile);

    expect(result.provider).toBe('google');
    expect(result.providerAccountId).toBe('uid-123');
    expect(result.expiresAt).toEqual(new Date('2030-01-01'));
    expect(result.scope).toBe('openid email');
    expect(result.tokenType).toBe('Bearer');
    expect(result.metadata).toEqual({ sub: 'uid-123' });
  });

  it('omits encrypted fields when token values are absent', () => {
    const profile = makeProfile({ accessToken: undefined, refreshToken: undefined, idToken: undefined });
    const result = encryptProviderTokens(cipher, profile);

    expect(result.accessToken).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
    expect(result.idToken).toBeUndefined();
  });
});
