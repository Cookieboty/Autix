import { NormalizedProfile } from './provider.types';
import { TokenCipher } from './token-cipher';

export function encryptProviderTokens(
  cipher: TokenCipher,
  profile: NormalizedProfile,
): {
  provider: NormalizedProfile['provider'];
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: Date;
  scope?: string;
  tokenType?: string;
  metadata?: unknown;
} {
  const t = profile.tokens;
  const enc = (v?: string) => (v ? cipher.encrypt(v) : undefined);
  return {
    provider: profile.provider,
    providerAccountId: profile.providerAccountId,
    accessToken: enc(t.accessToken),
    refreshToken: enc(t.refreshToken),
    idToken: enc(t.idToken),
    expiresAt: t.expiresAt,
    scope: t.scope,
    tokenType: t.tokenType,
    metadata: profile.raw,
  };
}
