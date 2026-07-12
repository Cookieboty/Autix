import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuthProvider, RawTokenSet, NormalizedProfile } from '../provider.types';
import { OAuthConfigService } from '../oauth-config.service';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

type IdTokenClaims = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string; nonce?: string; auth_time?: number };

@Injectable()
export class GoogleProvider implements OAuthProvider {
  readonly name = 'google' as const;
  readonly supportsReauth = process.env.GOOGLE_OAUTH_REAUTH_ENABLED === 'true';
  constructor(
    private readonly config: OAuthConfigService,
    private readonly verifyIdToken: (idToken: string, audience: string) => Promise<IdTokenClaims> =
      async (idToken, audience) => {
        const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUERS, audience });
        return payload as IdTokenClaims;
      },
  ) {}

  async buildAuthorizeUrl(i: { state: string; codeChallenge: string; nonce?: string; scope?: string; reauth?: boolean }): Promise<string> {
    const { clientId, redirectUri } = await this.config.getGoogleConfig();
    const url = new URL(AUTH_URL);
    const params: Record<string, string> = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: i.scope ?? 'openid email profile',
      state: i.state,
      code_challenge: i.codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: i.reauth ? 'login' : 'consent',
    };
    if (i.nonce) params.nonce = i.nonce;
    if (i.reauth) params.max_age = '0';
    url.search = new URLSearchParams(params).toString();
    return url.toString();
  }

  async exchangeCode(i: { code: string; codeVerifier: string }): Promise<RawTokenSet> {
    const { clientId, clientSecret, redirectUri } = await this.config.getGoogleConfig();
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: i.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
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

  async fetchProfile(tokens: RawTokenSet, ctx?: { nonce?: string; extra?: unknown }): Promise<NormalizedProfile> {
    if (!tokens.idToken) throw new Error('google profile: missing id_token');
    const { clientId } = await this.config.getGoogleConfig();
    const claims = await this.verifyIdToken(tokens.idToken, clientId);
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
      authTime: claims.auth_time,
    };
  }
}
