import { Injectable, BadRequestException, ConflictException, ForbiddenException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthIdentityRepository } from './auth-identity.repository';
import { MailService } from '../../platform/mail/mail.service';
import { StepUpService } from './step-up/step-up.service';
import { RateLimitService } from '../../platform/common/rate-limit.service';
import { EmailHashService } from './step-up/email-hash.service';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type UserRow = { id: string; status?: string; email?: string | null; pendingEmail?: string | null };

/**
 * 邮箱变更 / 补邮箱闭环（T5.1 分拆）：
 * - requestSupplement：**首次绑定**（OAuth 首次登录后 email 为空的场景）
 *   → 无需 step-up proof；仅当 user.email 目前为空/null 时允许；限流较宽（防刷）
 * - requestChange：**变更**（已有邮箱要换）
 *   → 必须消费 step-up proof（purpose='change-email'）；多维限流；账户 status 校验
 * - confirm：公开端点，仅校验邮件 JWT token；两条路径共用
 *
 * 保留 request(userId, email, proof?) 老签名作为路由：
 *   proof 存在 → 走 requestChange；否则走 requestSupplement
 */
@Injectable()
export class EmailChangeService {
  constructor(
    private readonly identity: AuthIdentityRepository,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    @Optional() private readonly stepUp?: StepUpService,
    @Optional() private readonly rateLimit?: RateLimitService,
    @Optional() private readonly emailHash?: EmailHashService,
  ) { }

  /** legacy 路由：按是否携带 proof 分派 */
  async request(userId: string, email: string, proof?: string, sessionId?: string): Promise<void> {
    if (proof) return this.requestChange(userId, email, proof, sessionId);
    return this.requestSupplement(userId, email);
  }

  /**
   * OAuth 首次登录后的邮箱补录。
   * 前置：user.email 为空/null；否则应走 requestChange。
   */
  async requestSupplement(userId: string, email: string): Promise<void> {
    if (!EMAIL_RE.test(email)) throw new BadRequestException('邮箱格式不正确');

    const currentUser = (await this.identity.findUserById(userId)) as UserRow | null;
    if (!currentUser) throw new ForbiddenException('账户不可用');
    if (
      currentUser.status === 'DELETED' ||
      currentUser.status === 'DISABLED' ||
      currentUser.status === 'LOCKED'
    ) {
      throw new ForbiddenException('账户不可用');
    }
    if (currentUser.email) {
      // spec §2 P0：无可信邮箱的纯 OAuth 用户（占位邮箱 @no-email.oauth.local）**不允许**通过自助通道
      // 建立"首个可信邮箱"——否则会话被劫持者可绑定并验证自己控制的邮箱，进而 bootstrap step-up
      // （改密/删账）而无需证明掌握原凭据。此类账户统一走人工支持（EMAIL_CHANGE_NOT_AVAILABLE）。
      if (currentUser.email.endsWith('@no-email.oauth.local')) {
        throw new ConflictException({
          code: 'EMAIL_CHANGE_NOT_AVAILABLE',
          message: '该账户暂不支持自助绑定邮箱，请联系客服',
          hint: { i18nKey: 'CONTACT_SUPPORT' },
        });
      }
      // 已有真实邮箱的用户改邮箱必须走需要 step-up proof 的变更通道。
      throw new BadRequestException('账户已绑定邮箱，请使用变更通道');
    }

    const existing = await this.identity.findUserByEmail(email);
    if (existing && existing.id !== userId) throw new ConflictException('该邮箱已被使用');

    await this.identity.setPendingEmail(userId, email);
    const token = this.jwt.sign({ sub: userId, email, purpose: 'email-verify' }, { expiresIn: '1h' });
    await this.mail.sendEmailVerification(email, token);
  }

  /**
   * 邮箱变更：必须携带 step-up proof。
   *
   * spec §3.2 [P0]：`sessionId` 用于让 step-up proof 与"发起变更请求的会话"绑定——
   * 攻击者即便在另一 session 拿到同用户的 proof（例如中间人抓到网络包），只要 sessionId 不同就无法 replay。
   * 兼容期允许 sessionId 缺省，但生产 controller 应始终传入。
   */
  async requestChange(userId: string, email: string, proof: string, sessionId?: string): Promise<void> {
    if (!EMAIL_RE.test(email)) throw new BadRequestException('邮箱格式不正确');
    if (!proof) throw new BadRequestException('缺少 step-up 凭证');

    if (!this.stepUp || !sessionId) {
      throw new BadRequestException({
        code: 'STEP_UP_INVALID_OR_EXPIRED',
        message: '当前会话不可用于身份复核',
      });
    }
    const proofPayload = this.stepUp.verifyProof(proof, userId, 'change-email', sessionId);

    if (this.rateLimit && this.emailHash) {
      const targetHash = this.emailHash.hash(email);
      await this.rateLimit.consume([
        { key: `email-change:user:${userId}`, windowMs: 60_000, limit: 1 },
        { key: `email-change:user:${userId}:daily`, windowMs: 24 * 3600_000, limit: 5 },
        { key: `email-change:targethash:${targetHash}:daily`, windowMs: 24 * 3600_000, limit: 20 },
      ]);
    }

    const existing = await this.identity.findUserByEmail(email);
    if (existing && existing.id !== userId) throw new ConflictException('该邮箱已被使用');

    const currentUser = (await this.identity.findUserById(userId)) as UserRow | null;
    if (!currentUser) throw new ForbiddenException('账户不可用');
    if (
      currentUser.status === 'DELETED' ||
      currentUser.status === 'DISABLED' ||
      currentUser.status === 'LOCKED'
    ) {
      throw new ForbiddenException('账户不可用');
    }

    await this.identity.setPendingEmailWithProof({
      userId,
      sessionId,
      proofJti: proofPayload.jti,
      email,
    });
    const token = this.jwt.sign({ sub: userId, email, purpose: 'email-verify' }, { expiresIn: '1h' });
    await this.mail.sendEmailVerification(email, token);
  }

  async confirm(token: string): Promise<void> {
    let payload: { sub: string; email: string; purpose: string };
    try { payload = this.jwt.verify(token); } catch { throw new BadRequestException('验证链接已过期或无效'); }
    if (payload.purpose !== 'email-verify') throw new BadRequestException('无效的验证链接');
    const user = await this.identity.findUserById(payload.sub);
    if (!user) throw new BadRequestException('验证链接已过期或无效');
    if ((user as any).pendingEmail !== payload.email) throw new BadRequestException('验证链接已过期或无效');
    // 账户 status 检查：DELETED/DISABLED/LOCKED 用户一律不允许 apply（与其余 PII 写入路径一致）。
    const st = (user as any).status;
    if (st === 'DELETED' || st === 'DISABLED' || st === 'LOCKED') {
      throw new BadRequestException('账户不可用');
    }
    const existing = await this.identity.findUserByEmail(payload.email);
    if (existing && existing.id !== payload.sub) throw new ConflictException('该邮箱已被使用');
    try {
      await this.identity.applyVerifiedEmail(payload.sub, payload.email);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('该邮箱已被使用');
      throw err;
    }
  }
}
