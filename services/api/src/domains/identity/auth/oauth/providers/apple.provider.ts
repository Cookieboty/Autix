import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuthProvider, RawTokenSet, NormalizedProfile } from '../provider.types';
import { AppleClientSecretFactory } from '../apple-client-secret';

const AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const ISSUER = 'https://appleid.apple.com';
const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

type AppleConfig = { clientId: string; redirectUri: string };
type AppleClaims = { sub: string; email?: string; nonce?: string };
type AppleUserField = { name?: { firstName?: string; lastName?: string }; email?: string };

@Injectable()
export class AppleProvider implements OAuthProvider {
  readonly name = 'apple' as const;
  constructor(
    private readonly config: AppleConfig = {
      clientId: process.env.OAUTH_APPLE_CLIENT_ID ?? '',
      redirectUri: process.env.OAUTH_APPLE_REDIRECT_URI ?? '',
    },
    private readonly secretFactory: AppleClientSecretFactory = new AppleClientSecretFactory({
      teamId: process.env.OAUTH_APPLE_TEAM_ID ?? '',
      keyId: process.env.OAUTH_APPLE_KEY_ID ?? '',
      clientId: process.env.OAUTH_APPLE_CLIENT_ID ?? '',
      privateKeyPem: (process.env.OAUTH_APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    }),
    private readonly verifyIdToken: (idToken: string, audience: string) => Promise<AppleClaims> =
      async (idToken, audience) => {
        const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUER, audience });
        return payload as AppleClaims;
      },
  ) {}

  buildAuthorizeUrl(i: { state: string; codeChallenge: string; nonce?: string; scope?: string }): string {
    // Apple 不走 PKCE（见本计划 capability 说明）：用 nonce + state + 机密 client_secret 保证安全，
    // 故不附带 code_challenge（Apple token endpoint 对 code_verifier 无官方保证）。
    const url = new URL(AUTH_URL);
    const params: Record<string, string> = {
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      response_mode: 'form_post', // 申请 name/email 时 Apple 要求 form_post
      scope: i.scope ?? 'name email',
      state: i.state,
    };
    if (i.nonce) params.nonce = i.nonce;
    url.search = new URLSearchParams(params).toString();
    return url.toString();
  }

  async exchangeCode(i: { code: string; codeVerifier: string }): Promise<RawTokenSet> {
    // codeVerifier 不传给 Apple（无 PKCE）；用动态 client_secret（ES256 JWT）作机密凭证
    void i.codeVerifier;
    const clientSecret = await this.secretFactory.create();
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: i.code,
        client_id: this.config.clientId,
        client_secret: clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`apple token exchange failed: ${res.status}`);
    const json = (await res.json()) as any;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      idToken: json.id_token,
      tokenType: json.token_type,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
    };
  }

  async fetchProfile(tokens: RawTokenSet, ctx?: { nonce?: string; extra?: unknown }): Promise<NormalizedProfile> {
    if (!tokens.idToken) throw new Error('apple profile: missing id_token');
    const claims = await this.verifyIdToken(tokens.idToken, this.config.clientId);
    if (claims.nonce !== ctx?.nonce) throw new Error('apple profile: nonce mismatch');

    const user = (ctx?.extra as { user?: AppleUserField } | undefined)?.user;
    const displayName = user?.name
      ? [user.name.firstName, user.name.lastName].filter(Boolean).join(' ') || null
      : null;
    const email = claims.email ?? user?.email ?? null;
    const isPrivateRelay = Boolean(email && email.endsWith('@privaterelay.appleid.com'));

    return {
      provider: 'apple',
      providerAccountId: claims.sub,
      email,
      emailVerified: true, // Apple 已验证
      displayName,
      avatar: null, // Apple 不提供头像
      raw: { claims, isPrivateRelay },
      tokens,
    };
  }
}
