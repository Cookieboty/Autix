import { Injectable, HttpStatus } from '@nestjs/common';
import { GoogleProvider } from './providers/google.provider';
import { AppleProvider } from './providers/apple.provider';
import { GitHubProvider } from './providers/github.provider';
import { OAuthProvider } from './provider.types';
import { OAuthConfigService } from './oauth-config.service';
import { I18nHttpException } from '../../../platform/i18n/i18n-http.exception';

@Injectable()
export class OAuthProviderRegistry {
  private readonly known = ['google', 'apple', 'github'] as const;
  private readonly map: Record<string, OAuthProvider>;
  constructor(google: GoogleProvider, apple: AppleProvider, github: GitHubProvider, private readonly config: OAuthConfigService) {
    this.map = { google, apple, github };
  }
  getInstance(name: string): OAuthProvider {
    const p = this.map[name];
    if (!p) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'oauth.provider_disabled');
    return p;
  }
  async isEnabled(name: string): Promise<boolean> {
    if (name === 'google') { const c = await this.config.getGoogleConfig(); return Boolean(c.clientId && c.clientSecret && c.redirectUri); }
    if (name === 'github') { const c = await this.config.getGitHubConfig(); return Boolean(c.clientId && c.clientSecret && c.redirectUri); }
    if (name === 'apple')  { const c = await this.config.getAppleConfig();  return Boolean(c.clientId && c.teamId && c.keyId && c.privateKey && c.redirectUri); }
    return false;
  }
  async isLaunched(name: string): Promise<boolean> {
    return (await this.config.getLaunchedProviders()).includes(name);
  }
  async getAvailability(): Promise<{ providers: string[]; comingSoon: string[] }> {
    const launched = await this.config.getLaunchedProviders();
    const enabled = await Promise.all(this.known.map(async (n) => ({ n, en: await this.isEnabled(n) })));
    const providers = enabled.filter((x) => x.en && launched.includes(x.n)).map((x) => x.n);
    const comingSoon = this.known.filter((n) => !launched.includes(n));
    return { providers, comingSoon };
  }
}
