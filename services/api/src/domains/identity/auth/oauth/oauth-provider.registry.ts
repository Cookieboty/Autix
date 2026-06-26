import { Injectable, BadRequestException } from '@nestjs/common';
import { GoogleProvider } from './providers/google.provider';
import { OAuthProvider } from './provider.types';

export type OAuthEnabledConfig = { googleClientId: string; googleClientSecret: string };

@Injectable()
export class OAuthProviderRegistry {
  private readonly providers: Record<string, { provider: OAuthProvider; enabled: boolean }>;
  constructor(
    google: GoogleProvider,
    config: OAuthEnabledConfig = {
      googleClientId: process.env.OAUTH_GOOGLE_CLIENT_ID ?? '',
      googleClientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET ?? '',
    },
  ) {
    this.providers = {
      // 启用要求 clientId 与 clientSecret 均非空（code 交换需要 secret）
      google: { provider: google, enabled: Boolean(config.googleClientId && config.googleClientSecret) },
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
}
