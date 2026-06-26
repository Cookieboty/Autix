export type RawTokenSet = { accessToken?: string; refreshToken?: string; idToken?: string;
  expiresAt?: Date; scope?: string; tokenType?: string };
export type NormalizedProfile = {
  provider: 'google' | 'apple' | 'github';
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatar: string | null;
  raw: unknown;
  tokens: RawTokenSet;
};
export interface OAuthProvider {
  readonly name: 'google' | 'apple' | 'github';
  // 注意：provider 用自己配置的、向三方注册的固定 callback（如 /api/auth/callback/google）作为
  // OAuth redirect_uri；它与"客户端 redirectUri"（后端最终 302 一次性码的去处）是两个不同 URL。
  buildAuthorizeUrl(i: { state: string; codeChallenge: string; nonce?: string; scope?: string }): Promise<string>;
  exchangeCode(i: { code: string; codeVerifier: string }): Promise<RawTokenSet>;
  fetchProfile(tokens: RawTokenSet, ctx?: { nonce?: string; extra?: unknown }): Promise<NormalizedProfile>;
}
