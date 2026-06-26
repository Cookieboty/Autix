import { Injectable } from '@nestjs/common';
import { SystemSettingsService } from '../../../platform/system-settings/system-settings.service';

@Injectable()
export class OAuthConfigService {
  constructor(private readonly settings: SystemSettingsService) {}

  private get(key: string): Promise<string> {
    return this.settings.getString(key).catch(() => '');
  }
  private list(raw: string): string[] {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  async getGoogleConfig() {
    const [clientId, clientSecret, redirectUri] = await Promise.all([
      this.get('oauth.googleClientId'), this.get('oauth.googleClientSecret'), this.get('oauth.googleRedirectUri'),
    ]);
    return { clientId, clientSecret, redirectUri };
  }
  async getGitHubConfig() {
    const [clientId, clientSecret, redirectUri] = await Promise.all([
      this.get('oauth.githubClientId'), this.get('oauth.githubClientSecret'), this.get('oauth.githubRedirectUri'),
    ]);
    return { clientId, clientSecret, redirectUri };
  }
  async getAppleConfig() {
    const [clientId, teamId, keyId, privateKeyRaw, redirectUri] = await Promise.all([
      this.get('oauth.appleClientId'), this.get('oauth.appleTeamId'), this.get('oauth.appleKeyId'),
      this.get('oauth.applePrivateKey'), this.get('oauth.appleRedirectUri'),
    ]);
    return { clientId, teamId, keyId, privateKey: privateKeyRaw.replace(/\\n/g, '\n'), redirectUri };
  }
  async getLaunchedProviders(): Promise<string[]> {
    const list = this.list(await this.get('oauth.launchedProviders'));
    return list.length ? list : ['google'];
  }
  async getWebRedirectAllowlist(): Promise<string[]> {
    return this.list(await this.get('oauth.webRedirectAllowlist'));
  }
}
