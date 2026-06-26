import { Injectable } from '@nestjs/common';
import { OAuthProvider, RawTokenSet, NormalizedProfile } from '../provider.types';

const AUTH_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const API = 'https://api.github.com';

type GitHubConfig = { clientId: string; clientSecret: string; redirectUri: string };
type GitHubUser = { id: number; login: string; name?: string | null; avatar_url?: string };
type GitHubEmail = { email: string; primary: boolean; verified: boolean };

@Injectable()
export class GitHubProvider implements OAuthProvider {
  readonly name = 'github' as const;
  constructor(
    private readonly config: GitHubConfig = {
      clientId: process.env.OAUTH_GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET ?? '',
      redirectUri: process.env.OAUTH_GITHUB_REDIRECT_URI ?? '',
    },
    private readonly exchange: (code: string, codeVerifier: string) => Promise<RawTokenSet> = async (code, codeVerifier) => {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          client_id: this.config.clientId, client_secret: this.config.clientSecret,
          code, redirect_uri: this.config.redirectUri, code_verifier: codeVerifier,
        }),
      });
      if (!res.ok) throw new Error(`github token exchange failed: ${res.status}`);
      const json = (await res.json()) as any;
      if (json.error) throw new Error(`github token exchange error: ${json.error}`);
      return { accessToken: json.access_token, scope: json.scope, tokenType: json.token_type };
    },
    private readonly httpGet: (path: string, accessToken: string) => Promise<any> = async (path, token) => {
      const res = await fetch(`${API}${path}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'autix' },
      });
      if (!res.ok) throw new Error(`github GET ${path} failed: ${res.status}`);
      return res.json();
    },
  ) {}

  buildAuthorizeUrl(i: { state: string; codeChallenge: string; nonce?: string; scope?: string }): string {
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: i.scope ?? 'read:user user:email',
      state: i.state,
      code_challenge: i.codeChallenge,
      code_challenge_method: 'S256',
      allow_signup: 'true',
    }).toString();
    return url.toString();
  }

  async exchangeCode(i: { code: string; codeVerifier: string }): Promise<RawTokenSet> {
    return this.exchange(i.code, i.codeVerifier);
  }

  async fetchProfile(tokens: RawTokenSet): Promise<NormalizedProfile> {
    if (!tokens.accessToken) throw new Error('github profile: missing access token');
    const user = (await this.httpGet('/user', tokens.accessToken)) as GitHubUser;
    const emails = (await this.httpGet('/user/emails', tokens.accessToken)) as GitHubEmail[];
    const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
    return {
      provider: 'github',
      providerAccountId: String(user.id),
      email: primary?.email ?? null,
      emailVerified: Boolean(primary?.verified),
      displayName: user.name ?? user.login ?? null,
      avatar: user.avatar_url ?? null,
      raw: { user, emails },
      tokens,
    };
  }
}
