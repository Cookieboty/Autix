import { Injectable, BadRequestException } from '@nestjs/common';
import { GoogleProvider } from './providers/google.provider';
import { AppleProvider } from './providers/apple.provider';
import { GitHubProvider } from './providers/github.provider';
import { OAuthProvider } from './provider.types';

export type OAuthEnabledConfig = {
  googleClientId: string; googleClientSecret: string;
  appleClientId: string; appleTeamId: string; appleKeyId: string; applePrivateKey: string;
  githubClientId: string; githubClientSecret: string;
};

@Injectable()
export class OAuthProviderRegistry {
  private readonly providers: Record<string, { provider: OAuthProvider; enabled: boolean }>;
  constructor(
    google: GoogleProvider,
    apple: AppleProvider,
    github: GitHubProvider,
    config: OAuthEnabledConfig = {
      googleClientId: process.env.OAUTH_GOOGLE_CLIENT_ID ?? '',
      googleClientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET ?? '',
      appleClientId: process.env.OAUTH_APPLE_CLIENT_ID ?? '',
      appleTeamId: process.env.OAUTH_APPLE_TEAM_ID ?? '',
      appleKeyId: process.env.OAUTH_APPLE_KEY_ID ?? '',
      applePrivateKey: process.env.OAUTH_APPLE_PRIVATE_KEY ?? '',
      githubClientId: process.env.OAUTH_GITHUB_CLIENT_ID ?? '',
      githubClientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET ?? '',
    },
  ) {
    this.providers = {
      // 启用要求 clientId 与 clientSecret 均非空（code 交换需要 secret）
      google: { provider: google, enabled: Boolean(config.googleClientId && config.googleClientSecret) },
      apple: { provider: apple, enabled: Boolean(config.appleClientId && config.appleTeamId && config.appleKeyId && config.applePrivateKey) },
      github: { provider: github, enabled: Boolean(config.githubClientId && config.githubClientSecret) },
    };
  }
  isEnabled(name: string): boolean {
    return Boolean(this.providers[name]?.enabled);
  }
  listEnabled(): string[] {
    return Object.keys(this.providers).filter((n) => this.providers[n].enabled);
  }
  get(name: string): OAuthProvider {
    const entry = this.providers[name];
    if (!entry?.enabled) throw new BadRequestException('OAUTH_PROVIDER_DISABLED');
    return entry.provider;
  }

  private getLaunchedSet(): Set<string> {
    const raw = process.env.OAUTH_LAUNCHED_PROVIDERS;
    if (!raw || !raw.trim()) return new Set(['google']);
    return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  }

  isLaunched(name: string): boolean {
    return this.getLaunchedSet().has(name);
  }

  getAvailability(): { providers: string[]; comingSoon: string[] } {
    const launched = this.getLaunchedSet();
    const providers = this.listEnabled().filter((n) => launched.has(n));
    const comingSoon = Object.keys(this.providers).filter((n) => !launched.has(n));
    return { providers, comingSoon };
  }
}
