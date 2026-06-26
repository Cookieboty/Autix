import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { OAuthProviderRegistry } from './oauth-provider.registry';
import { AccountResolutionService } from './account-resolution.service';
import { AuthService, LoginResult } from '../auth.service';
import { AuthIdentityRepository } from '../auth-identity.repository';
import { AuthSessionRepository } from '../auth-session.repository';
import { SocialLoginRepository } from './social-login.repository';
import { InviteService } from '../../../billing/invite/invite.service';

const DEFAULT_ROLE_CODE = 'USER';
const STATE_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 60 * 1000;

type AuthorizeInput = {
  provider: string; systemCode: string; clientType: string; redirectUri: string;
  inviteCode?: string; deviceId?: string; linkUserId?: string;
};
type CallbackInput = { provider: string; code: string; state: string; ip: string; userAgent: string };
// linked 为后续 Plan 5 绑定分支预留；Plan 1 始终为 undefined（前向兼容，控制器统一处理）
type CallbackResult = { redirectUri: string; loginCode?: string; errorCode?: string; linked?: string };

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
  ) {}

  private pkce() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  private assertRedirectAllowed(redirectUri: string) {
    // 防开放重定向：解析 URL 后做严格 origin + pathname 精确匹配（不是 startsWith，
    // 否则 http://web/callback-evil 也会被放行）。query 由服务端自己追加。
    // 桌面 loopback（127.0.0.1 动态端口）留待 Plan 3 单独放行。
    let target: URL;
    try { target = new URL(redirectUri); } catch { throw new BadRequestException('OAUTH_REDIRECT_NOT_ALLOWED'); }
    const allow = (process.env.OAUTH_WEB_REDIRECT_ALLOWLIST ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    const ok = allow.some((entry) => {
      let a: URL;
      try { a = new URL(entry); } catch { return false; }
      return a.origin === target.origin && a.pathname === target.pathname;
    });
    if (!ok) throw new BadRequestException('OAUTH_REDIRECT_NOT_ALLOWED');
  }

  async createAuthorization(input: AuthorizeInput): Promise<{ authorizeUrl: string }> {
    const provider = this.registry.get(input.provider);
    this.assertRedirectAllowed(input.redirectUri);
    const state = crypto.randomBytes(24).toString('base64url');
    const nonce = crypto.randomBytes(24).toString('base64url');
    const { verifier, challenge } = this.pkce();
    await this.social.createState({
      state, nonce, codeVerifier: verifier, provider: input.provider, systemCode: input.systemCode,
      clientType: input.clientType, redirectUri: input.redirectUri,
      inviteCode: input.inviteCode, deviceId: input.deviceId, linkUserId: input.linkUserId,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    });
    // input.redirectUri 已存入 state（客户端最终落点）；不传给三方 authorize
    return { authorizeUrl: provider.buildAuthorizeUrl({ state, codeChallenge: challenge, nonce }) };
  }

  async handleCallback(input: CallbackInput): Promise<CallbackResult> {
    const st = await this.social.consumeState(input.state);
    if (!st || st.provider !== input.provider) throw new BadRequestException('OAUTH_STATE_INVALID');

    const provider = this.registry.get(input.provider);
    const tokens = await provider.exchangeCode({ code: input.code, codeVerifier: st.codeVerifier ?? '' });
    const profile = await provider.fetchProfile(tokens, { nonce: st.nonce ?? undefined });

    const system = await this.identity.findSystemByCode(st.systemCode);
    if (!system) throw new BadRequestException('系统不存在');

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

    const user = await this.identity.findLoginUserById(outcome.userId);
    if (!user) throw new BadRequestException('用户不存在');
    const { sessionId } = await this.authService.issueSessionForUser(user, { ip: input.ip, userAgent: input.userAgent });

    const loginCode = crypto.randomBytes(24).toString('base64url');
    await this.social.createLoginCode({
      code: loginCode, userId: outcome.userId, sessionId,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
    return { redirectUri: st.redirectUri, loginCode };
  }

  async exchangeLoginCode(code: string): Promise<LoginResult> {
    const row = await this.social.consumeLoginCode(code);
    if (!row) throw new BadRequestException('OAUTH_EXCHANGE_EXPIRED');
    return this.authService.buildLoginResultFromSession(row.sessionId);
  }
}
