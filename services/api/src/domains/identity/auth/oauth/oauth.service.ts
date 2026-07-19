import { Injectable, HttpStatus, ConflictException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { OAuthProviderRegistry } from './oauth-provider.registry';
import { AccountResolutionService } from './account-resolution.service';
import { AuthService, LoginResult } from '../auth.service';
import { AuthIdentityRepository } from '../auth-identity.repository';
import { AuthSessionRepository } from '../auth-session.repository';
import { SocialLoginRepository } from './social-login.repository';
import { InviteService } from '../../../billing/invite/invite.service';
import { CampaignRewardService } from '../../../billing/campaign/campaign-reward.service';
import { TokenCipher } from './token-cipher';
import { NormalizedProfile } from './provider.types';
import { encryptProviderTokens } from './encrypt-tokens';
import { OAuthConfigService } from './oauth-config.service';
import { StepUpService, PURPOSE_TO_EMAIL_OTP_ENUM } from '../step-up/step-up.service';
import { I18nHttpException } from '../../../platform/i18n/i18n-http.exception';
import type { StepUpPurpose, StartStepUpResult } from '@autix/domain';

const DEFAULT_ROLE_CODE = 'USER';
const STATE_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 60 * 1000;

type AuthorizeInput = {
  provider: string; systemCode: string; clientType: string; redirectUri: string;
  inviteCode?: string; deviceId?: string; linkUserId?: string;
  flow?: 'LOGIN' | 'LINK' | 'REAUTH'; purpose?: StepUpPurpose; sessionId?: string;
};
type CallbackInput = { provider: string; code?: string; state: string; error?: string; ip: string; userAgent: string; extraParams?: unknown };
type CallbackResult = {
  redirectUri: string;
  loginCode?: string;
  errorCode?: string;
  linked?: string;
  proof?: string;
  purpose?: StepUpPurpose;
};

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  constructor(
    private readonly registry: OAuthProviderRegistry,
    private readonly resolution: AccountResolutionService,
    private readonly authService: AuthService,
    private readonly identity: AuthIdentityRepository,
    private readonly sessionRepo: AuthSessionRepository,
    private readonly social: SocialLoginRepository,
    private readonly invite: InviteService,
    private readonly campaignRewardService: CampaignRewardService,
    private readonly cipher: TokenCipher,
    private readonly config: OAuthConfigService,
    private readonly stepUp: StepUpService,
  ) { }

  private encTokensFor(p: NormalizedProfile) {
    return encryptProviderTokens(this.cipher, p);
  }

  private pkce() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  private async assertRedirectAllowed(redirectUri: string, clientType: string) {
    let target: URL;
    try { target = new URL(redirectUri); } catch { throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'oauth.redirect_not_allowed'); }

    if (clientType === 'desktop') {
      const isLoopback = target.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(target.hostname);
      const isStepUpPath = /^\/step-up\/[0-9a-f]{32}$/.test(target.pathname);
      if (isLoopback && (target.pathname === '/callback' || isStepUpPath)) return;
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'oauth.redirect_not_allowed');
    }

    // 防开放重定向：解析 URL 后做严格 origin + pathname 精确匹配（不是 startsWith，
    // 否则 http://web/callback-evil 也会被放行）。query 由服务端自己追加。
    const allow = await this.config.getWebRedirectAllowlist();
    const ok = allow.some((entry) => {
      let a: URL;
      try { a = new URL(entry); } catch { return false; }
      return a.origin === target.origin && a.pathname === target.pathname;
    });
    if (!ok) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'oauth.redirect_not_allowed');
  }

  async createAuthorization(input: AuthorizeInput): Promise<{ authorizeUrl: string; state: string; expiresAt: string }> {
    if (!(await this.registry.isLaunched(input.provider))) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'oauth.provider_not_launched');
    if (!(await this.registry.isEnabled(input.provider))) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'oauth.provider_disabled');
    const provider = this.registry.getInstance(input.provider);
    await this.assertRedirectAllowed(input.redirectUri, input.clientType);
    const state = crypto.randomBytes(24).toString('base64url');
    const nonce = crypto.randomBytes(24).toString('base64url');
    const { verifier, challenge } = this.pkce();
    const flow = input.flow ?? (input.linkUserId ? 'LINK' : 'LOGIN');
    const expiresAt = new Date(Date.now() + STATE_TTL_MS);
    await this.social.createState({
      state, nonce, codeVerifier: verifier, provider: input.provider, systemCode: input.systemCode,
      clientType: input.clientType, redirectUri: input.redirectUri,
      inviteCode: input.inviteCode, deviceId: input.deviceId, linkUserId: input.linkUserId,
      flow,
      purpose: input.purpose ? PURPOSE_TO_EMAIL_OTP_ENUM[input.purpose] : undefined,
      sessionId: input.sessionId,
      expiresAt,
    });
    // input.redirectUri 已存入 state（客户端最终落点）；不传给三方 authorize
    return {
      authorizeUrl: await provider.buildAuthorizeUrl({
        state,
        codeChallenge: challenge,
        nonce,
        reauth: flow === 'REAUTH',
      }),
      state,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async startReauth(input: {
    userId: string;
    sessionId: string;
    purpose: StepUpPurpose;
    clientType: 'web' | 'desktop';
    redirectUri: string;
    provider?: string;
  }): Promise<Extract<StartStepUpResult, { kind: 'redirect' }> | null> {
    const linked = await this.identity.findUserAccountsByUserId(input.userId);
    const candidates = input.provider
      ? linked.filter((account) => account.provider === input.provider)
      : linked;
    // spec §3.2 D' step 2：显式指定但未绑定的 provider 必须硬失败为 409 STEP_UP_UNAVAILABLE，
    // 不得借 REAUTH 创建绑定，也不得静默改走 OTP（用户可另行显式选择邮箱 OTP）。
    if (input.provider && candidates.length === 0) {
      throw new ConflictException({
        code: 'STEP_UP_UNAVAILABLE',
        message: '该账户未绑定所选登录方式，无法用于身份复核',
      });
    }
    const selected = candidates.find((account) => {
      try { return this.registry.getInstance(account.provider).supportsReauth; }
      catch { return false; }
    });
    // 已绑定但该 provider 不支持强 REAUTH（GitHub 永久 / Google/Apple 未验证前）→ 返回 null，
    // 由 controller 自动降级为邮箱 OTP。
    if (!selected) return null;
    const authorization = await this.createAuthorization({
      provider: selected.provider,
      systemCode: 'chat',
      clientType: input.clientType,
      redirectUri: input.redirectUri,
      linkUserId: input.userId,
      flow: 'REAUTH',
      purpose: input.purpose,
      sessionId: input.sessionId,
    });
    return {
      kind: 'redirect',
      provider: selected.provider,
      ...authorization,
    };
  }

  async handleCallback(input: CallbackInput): Promise<CallbackResult> {
    const st = await this.social.consumeState(input.state);
    if (!st || st.provider !== input.provider) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'oauth.state_invalid');

    if (input.error || !input.code) {
      return { redirectUri: st.redirectUri, errorCode: 'OAUTH_PROVIDER_DENIED' };
    }

    const provider = this.registry.getInstance(input.provider);
    const tokens = await provider.exchangeCode({ code: input.code, codeVerifier: st.codeVerifier ?? '' });
    const profile = await provider.fetchProfile(tokens, { nonce: st.nonce ?? undefined, extra: input.extraParams });

    if (st.flow === 'REAUTH') {
      if (!st.linkUserId || !st.sessionId || !st.purpose) {
        return { redirectUri: st.redirectUri, errorCode: 'STEP_UP_INVALID_OR_EXPIRED' };
      }
      const existing = await this.identity.findUserAccount(profile.provider, profile.providerAccountId);
      const purpose = this.fromOtpPurpose(st.purpose);
      const authTimeMs = profile.authTime ? profile.authTime * 1000 : 0;
      const stateCreatedAt = st.createdAt.getTime();
      if (
        !existing ||
        existing.userId !== st.linkUserId ||
        !purpose ||
        authTimeMs < stateCreatedAt - 60_000 ||
        authTimeMs > Date.now() + 60_000
      ) {
        return { redirectUri: st.redirectUri, errorCode: 'STEP_UP_INVALID_OR_EXPIRED' };
      }
      const { proof } = await this.stepUp.signOAuthProof(st.linkUserId, purpose, st.sessionId);
      return { redirectUri: st.redirectUri, proof, purpose };
    }

    // 绑定分支（§6.5）：linkUserId 非空时不走登录流程
    if (st.linkUserId) {
      const existing = await this.identity.findUserAccount(profile.provider, profile.providerAccountId);
      if (existing && existing.userId !== st.linkUserId) {
        return { redirectUri: st.redirectUri, errorCode: 'OAUTH_ACCOUNT_ALREADY_LINKED' };
      }
      if (!existing) {
        await this.identity.createUserAccount({ userId: st.linkUserId, ...this.encTokensFor(profile) });
      }
      return { redirectUri: st.redirectUri, linked: profile.provider };
    }

    const system = await this.identity.findSystemByCode(st.systemCode);
    if (!system) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'auth.system.not_found');

    const outcome = await this.resolution.resolve(profile, {
      systemId: system.id, defaultRoleCode: DEFAULT_ROLE_CODE,
      signupIp: input.ip, signupDeviceId: st.deviceId ?? undefined, inviteCode: st.inviteCode ?? undefined,
    });
    if (outcome.kind === 'conflict') {
      return { redirectUri: st.redirectUri, errorCode: outcome.code };
    }

    // best-effort 邀请奖励（与现有流程一致，失败不影响登录）
    if (st.inviteCode) {
      try { await this.invite.recordInvitation?.(st.inviteCode, outcome.userId); }
      catch (e) { this.logger.warn(`invite record failed: ${String(e)}`); }
    }

    if (outcome.created === true) {
      try {
        await this.campaignRewardService.grantRegistrationBonus(outcome.userId, 'oauth_first_login');
      } catch (e) {
        this.logger.warn(`registration bonus grant failed: ${String(e)}`);
      }
    }

    const user = await this.identity.findLoginUserById(outcome.userId);
    if (!user) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'auth.user.not_found');
    const { sessionId } = await this.authService.issueSessionForUser(user, {
      ip: input.ip,
      userAgent: input.userAgent,
    });

    const loginCode = crypto.randomBytes(24).toString('base64url');
    await this.social.createLoginCode({
      code: loginCode, userId: outcome.userId, sessionId,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
    return { redirectUri: st.redirectUri, loginCode };
  }

  async exchangeLoginCode(code: string): Promise<LoginResult> {
    const row = await this.social.consumeLoginCode(code);
    if (!row) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'oauth.exchange_expired');
    return this.authService.buildLoginResultFromSession(row.sessionId);
  }

  listLinkedAccounts(userId: string): Promise<string[]> {
    return this.identity.findUserAccountsByUserId(userId).then((rows) => rows.map((r) => r.provider));
  }

  /**
   * 安全（#3）：绑定新登录凭据可成为账户的**永久后门**（改密也删不掉），因此 link 也必须先完成 step-up 复核。
   * 复用 `unlink-provider` 作为"管理登录方式"这一类高危操作的 step-up 用途；proof 一次性、绑用户/会话。
   */
  async createLinkAuthorization(input: {
    provider: string;
    systemCode: string;
    clientType: 'web' | 'desktop';
    redirectUri: string;
    userId: string;
    proof: string;
    sessionId?: string;
  }): Promise<{ authorizeUrl: string; state: string; expiresAt: string }> {
    await this.stepUp.verifyAndConsumeProof(input.proof, input.userId, 'unlink-provider', input.sessionId);
    return this.createAuthorization({
      provider: input.provider,
      systemCode: input.systemCode,
      clientType: input.clientType,
      redirectUri: input.redirectUri,
      linkUserId: input.userId,
    });
  }

  async unlink(userId: string, provider: string, proof: string, sessionId?: string): Promise<void> {
    // 安全（#3）：解绑登录凭据属高危账户安全操作，必须先完成 step-up 复核，
    // 防止仅持有被劫持会话者删除受害者的登录方式。
    await this.stepUp.verifyAndConsumeProof(proof, userId, 'unlink-provider', sessionId);
    const ok = await this.identity.hasOtherCredential(userId, provider);
    if (!ok) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'oauth.cannot_unlink_last_credential');
    await this.identity.deleteUserAccount(userId, provider);
  }

  private fromOtpPurpose(value: string): StepUpPurpose | null {
    const entry = Object.entries(PURPOSE_TO_EMAIL_OTP_ENUM).find(([, mapped]) => mapped === value);
    return (entry?.[0] as StepUpPurpose | undefined) ?? null;
  }
}
