import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuthProvider, RawTokenSet, NormalizedProfile } from '../provider.types';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };
type IdTokenClaims = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string; nonce?: string };

@Injectable()
export class GoogleProvider implements OAuthProvider {
  readonly name = 'google' as const;
  constructor(
    private readonly config: GoogleConfig = {
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET ?? '',
      // 向 Google 控制台注册的固定后端回调；authorize 与 code 交换都用它
      redirectUri: process.env.OAUTH_GOOGLE_REDIRECT_URI ?? '',
    },
    private readonly verifyIdToken: (idToken: string, audience: string) => Promise<IdTokenClaims> =
      async (idToken, audience) => {
        const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUERS, audience });
        return payload as IdTokenClaims;
      },
  ) {}

  buildAuthorizeUrl(i: { state: string; codeChallenge: string; nonce?: string; scope?: string }): string {
    const url = new URL(AUTH_URL);
    const params: Record<string, string> = {
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: i.scope ?? 'openid email profile',
      state: i.state,
      code_challenge: i.codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    };
    if (i.nonce) params.nonce = i.nonce;
    url.search = new URLSearchParams(params).toString();
    return url.toString();
  }

  async exchangeCode(i: { code: string; codeVerifier: string }): Promise<RawTokenSet> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: i.code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: i.codeVerifier,
      }),
    });
    if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
    const json = (await res.json()) as any;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      idToken: json.id_token,
      scope: json.scope,
      tokenType: json.token_type,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
    };
  }

  async fetchProfile(tokens: RawTokenSet, ctx?: { nonce?: string }): Promise<NormalizedProfile> {
    if (!tokens.idToken) throw new Error('google profile: missing id_token');
    const claims = await this.verifyIdToken(tokens.idToken, this.config.clientId);
    if (claims.nonce !== ctx?.nonce) {
      throw new Error('google profile: nonce mismatch');
    }
    return {
      provider: 'google',
      providerAccountId: claims.sub,
      email: claims.email ?? null,
      emailVerified: Boolean(claims.email_verified),
      displayName: claims.name ?? null,
      avatar: claims.picture ?? null,
      raw: claims,
      tokens,
    };
  }
}
