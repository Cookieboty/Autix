import { Injectable } from '@nestjs/common';
import { AuthIdentityRepository } from '../auth-identity.repository';
import { TokenCipher } from './token-cipher';
import { NormalizedProfile } from './provider.types';

export type ResolveContext = {
  systemId: string; defaultRoleCode: string;
  signupIp?: string; signupDeviceId?: string; inviteCode?: string;
};
export type ResolveOutcome =
  | { kind: 'login'; userId: string }
  | { kind: 'conflict'; code: 'OAUTH_EMAIL_UNVERIFIED_CONFLICT' };

@Injectable()
export class AccountResolutionService {
  constructor(
    private readonly repo: AuthIdentityRepository,
    private readonly cipher: TokenCipher,
  ) {}

  private encTokens(p: NormalizedProfile) {
    const t = p.tokens;
    const enc = (v?: string) => (v ? this.cipher.encrypt(v) : undefined);
    return {
      provider: p.provider, providerAccountId: p.providerAccountId,
      accessToken: enc(t.accessToken), refreshToken: enc(t.refreshToken), idToken: enc(t.idToken),
      expiresAt: t.expiresAt, scope: t.scope, tokenType: t.tokenType, metadata: p.raw,
    };
  }

  async resolve(profile: NormalizedProfile, ctx: ResolveContext): Promise<ResolveOutcome> {
    // §6.1 已绑定
    const linked = await this.repo.findUserAccount(profile.provider, profile.providerAccountId);
    if (linked) return { kind: 'login', userId: linked.userId };

    // 邮箱撞库判定
    const existing = profile.email ? await this.repo.findUserByEmail(profile.email) : null;
    if (existing) {
      if (profile.emailVerified) {
        // §6.2 自动关联
        await this.repo.createUserAccount({ userId: existing.id, ...this.encTokens(profile) });
        return { kind: 'login', userId: existing.id };
      }
      // §6.3 拒绝自动关联
      return { kind: 'conflict', code: 'OAUTH_EMAIL_UNVERIFIED_CONFLICT' };
    }

    // §6.4 全新用户
    const username = await this.generateUsername(profile);
    // 无邮箱占位（域名固定，便于回填/识别）；Plan 6 会据 emailVerified=false 引导补充真实邮箱
    const email = profile.email ?? `${profile.provider}_${profile.providerAccountId}@no-email.oauth.local`;
    const created = await this.repo.createOAuthUser({
      username, email, avatar: profile.avatar ?? undefined, realName: profile.displayName ?? undefined,
      systemId: ctx.systemId, defaultRoleCode: ctx.defaultRoleCode,
      account: this.encTokens(profile),
      signupIp: ctx.signupIp, signupDeviceId: ctx.signupDeviceId, inviteCode: ctx.inviteCode,
    });
    return { kind: 'login', userId: created.id };
  }

  private async generateUsername(profile: NormalizedProfile): Promise<string> {
    const base = (profile.email?.split('@')[0] ?? profile.displayName ?? profile.provider)
      .toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || profile.provider;
    for (let i = 0; i < 5; i++) {
      const candidate = i === 0 ? base : `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
      if (!(await this.repo.findUserByUsername(candidate))) return candidate;
    }
    return `${base}_${profile.providerAccountId.slice(-6)}`;
  }
}
