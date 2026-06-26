import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuthProvider, RawTokenSet, NormalizedProfile } from '../provider.types';
import { AppleClientSecretFactory } from '../apple-client-secret';
import { OAuthConfigService } from '../oauth-config.service';

const AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const ISSUER = 'https://appleid.apple.com';
const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

type AppleClaims = { sub: string; email?: string; nonce?: string };
type AppleUserField = { name?: { firstName?: string; lastName?: string }; email?: string };

@Injectable()
export class AppleProvider implements OAuthProvider {
  readonly name = 'apple' as const;
  constructor(
    private readonly config: OAuthConfigService,
    private readonly secretFactory?: { create(): Promise<string> },
    private readonly verifyIdToken: (idToken: string, audience: string) => Promise<AppleClaims> =
      async (idToken, audience) => {
        const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUER, audience });
        return payload as AppleClaims;
      },
  ) {}

  async buildAuthorizeUrl(i: { state: string; codeChallenge: string; nonce?: string; scope?: string }): Promise<string> {
    const { clientId, redirectUri } = await this.config.getAppleConfig();
    // Apple 不走 PKCE（见本计划 capability 说明）：用 nonce + state + 机密 client_secret 保证安全，
    // 故不附带 code_challenge（Apple token endpoint 对 code_verifier 无官方保证）。
    const url = new URL(AUTH_URL);
    const params: Record<string, string> = {
      client_id: clientId,
      redirect_uri: redirectUri,
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
    const c = await this.config.getAppleConfig();
    const factory = this.secretFactory ?? new AppleClientSecretFactory({
      teamId: c.teamId,
      keyId: c.keyId,
      clientId: c.clientId,
      privateKeyPem: c.privateKey,
    });
    const clientSecret = await factory.create();
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: i.code,
        client_id: c.clientId,
        client_secret: clientSecret,
        redirect_uri: c.redirectUri,
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
    const { clientId } = await this.config.getAppleConfig();
    const claims = await this.verifyIdToken(tokens.idToken, clientId);
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
