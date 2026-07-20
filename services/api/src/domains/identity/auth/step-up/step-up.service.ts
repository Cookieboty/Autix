import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AppLogger } from '../../../platform/common/app-logger';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt, timingSafeEqual } from 'crypto';
import type { StepUpPurpose, StartStepUpResult } from '@autix/domain';
import { MailService } from '../../../platform/mail/mail.service';
import { RateLimitService } from '../../../platform/common/rate-limit.service';
import { EmailHashService } from './email-hash.service';
import { StepUpRepository } from './step-up.repository';

/**
 * step-up proof：一次性 JWT，短 TTL，与 purpose 绑定。
 * - kind='reauth-password'：用户提交密码通过验证后签发
 * - kind='reauth-otp'：用户完成 OTP 验证后签发
 * - kind='reauth-oauth'：OAuth 重认证回调成功后签发（本轮先预留，Desktop 通道见 T8）
 *
 * 消费策略：签发后写入 step_up_proofs；业务方在同一事务内按 jti、session、purpose 原子消费。
 */
export type StepUpProofPayload = {
  sub: string;
  purpose: StepUpPurpose;
  kind: 'reauth-password' | 'reauth-otp' | 'reauth-oauth';
  jti: string;
  /**
   * T15.3 (spec §3.2 P0)：签发时所在 session id。用于防跨 session replay：
   * 用户在设备 A 完成 step-up 后拿到 proof，如果攻击者劫持设备 B 的 session（不同 sid），
   * 单靠 userId+purpose 是无法识破跨 session 使用的；带上 sid 后 consumer 侧校验
   * `payload.sid === currentSessionId` 即可拒绝跨设备 replay。
   * 兼容策略：字段可选 —— 老 proof（无 sid）在 verifyProof 中被 `expectedSessionId` 提供时
   * 会直接判定为 STEP_UP_INVALID_OR_EXPIRED。生产 consumer 必须传 sessionId。
   */
  sid?: string;
  iat?: number;
  exp?: number;
};

export class StepUpHttpException extends HttpException {
  constructor(code: string, message: string, status?: HttpStatus) {
    const resolvedStatus = status ?? (
      code === 'STEP_UP_UNAVAILABLE' || code === 'OTP_ALREADY_CONSUMED'
        ? HttpStatus.CONFLICT
        : HttpStatus.BAD_REQUEST
    );
    super({ code, message }, resolvedStatus);
  }
}

const STEP_UP_PROOF_TTL_SECONDS = 5 * 60;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

export const PURPOSE_TO_EMAIL_OTP_ENUM: Record<
  StepUpPurpose,
  'STEP_UP_CHANGE_PASSWORD' | 'STEP_UP_SET_PASSWORD' | 'STEP_UP_CHANGE_EMAIL' | 'STEP_UP_DELETE_ACCOUNT' | 'STEP_UP_UNLINK_PROVIDER'
> = {
  'change-password': 'STEP_UP_CHANGE_PASSWORD',
  'set-password': 'STEP_UP_SET_PASSWORD',
  'change-email': 'STEP_UP_CHANGE_EMAIL',
  'delete-account': 'STEP_UP_DELETE_ACCOUNT',
  'unlink-provider': 'STEP_UP_UNLINK_PROVIDER',
};

@Injectable()
export class StepUpService {
  private readonly logger = new AppLogger(StepUpService.name);

  constructor(
    private readonly repository: StepUpRepository,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly rateLimit: RateLimitService,
    private readonly emailHash: EmailHashService,
  ) { }

  /**
   * 密码校验签发 proof：用户重新输入当前密码，成功后返回一次性 proof。
   */
  async authorizeByPassword(
    userId: string,
    purpose: StepUpPurpose,
    plainPassword: string,
    sessionId?: string,
  ): Promise<{ proof: string; expiresAt: string }> {
    await this.rateLimit.consume([
      { key: `stepup-pwd:user:${userId}`, windowMs: 60_000, limit: 5 },
    ]);

    if (!sessionId) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '当前会话不可用于身份复核');
    }
    const user = await this.repository.findUser(userId);
    if (!user || (user.status !== 'ACTIVE' && user.status !== 'PENDING')) {
      throw new StepUpHttpException('STEP_UP_UNAVAILABLE', '账户当前不可用于身份复核');
    }
    if (!user.password) {
      throw new StepUpHttpException('STEP_UP_UNAVAILABLE', '账户未设置密码，请改用邮箱 OTP 或重新登录');
    }
    const ok = await bcrypt.compare(plainPassword, user.password);
    if (!ok) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '身份复核失败');
    }
    return this.signProof(userId, purpose, 'reauth-password', sessionId);
  }

  /**
   * 决定给客户端的启动方案：优先密码分支不在此，仅在 OAuth-only 时进入。
   * 本轮返回 unsupported / otp 两分支。redirect 分支待 T8。
   */
  startForOAuthOnly(_userId: string, _purpose: StepUpPurpose): StartStepUpResult {
    // 本轮 provider capability 假设：所有 provider 都不支持 silent reauth
    // 未来通过 FLAG PROVIDER_REAUTH_ENABLED=true 打开 redirect 分支
    if ((process.env.PROVIDER_REAUTH_ENABLED ?? '').toLowerCase() === 'true') {
      // 占位：真正的 authorize URL 构造在 T8 补充
      return { kind: 'unsupported', reason: 'CONTACT_SUPPORT' };
    }
    return { kind: 'unsupported', reason: 'PROVIDER_REAUTH_UNSUPPORTED' };
  }

  async assertPasswordlessUser(userId: string): Promise<void> {
    const user = await this.repository.findUser(userId);
    // spec §3.2 D'：账户状态异常统一用 STEP_UP_UNAVAILABLE(409)，不暴露软删（USER_DELETED/403 会泄露注销状态）。
    if (!user || (user.status !== 'ACTIVE' && user.status !== 'PENDING')) {
      throw new StepUpHttpException('STEP_UP_UNAVAILABLE', '账户当前不可用于身份复核');
    }
    if (user.password) {
      throw new StepUpHttpException('STEP_UP_REQUIRED', '该账户必须使用当前密码完成身份复核');
    }
  }

  signOAuthProof(
    userId: string,
    purpose: StepUpPurpose,
    sessionId: string,
  ): Promise<{ proof: string; expiresAt: string }> {
    return this.signProof(userId, purpose, 'reauth-oauth', sessionId);
  }

  /**
   * 请求 OTP：写入 email_otps（codeHash 用 bcrypt）+ 发邮件 + 命中限流。
   * 返回 requestId（= email_otps.id）与遮蔽邮件用于前端展示。
   */
  async requestOtp(
    userId: string,
    purpose: StepUpPurpose,
    sessionId?: string,
    ip?: string,
  ): Promise<StartStepUpResult & { kind: 'otp' }> {
    if (!sessionId) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '当前会话不可用于身份复核');
    }
    const user = await this.repository.findUser(userId);
    // spec §3.2 D'：状态必须为 ACTIVE/PENDING；DELETED/DISABLED/LOCKED 统一 STEP_UP_UNAVAILABLE(409)，不暴露软删。
    if (!user || (user.status !== 'ACTIVE' && user.status !== 'PENDING')) {
      throw new StepUpHttpException('STEP_UP_UNAVAILABLE', '账户当前不可用于身份复核');
    }
    if (user.password) {
      throw new StepUpHttpException('STEP_UP_REQUIRED', '该账户必须使用当前密码完成身份复核');
    }
    if (
      !user.email ||
      !user.emailVerified ||
      user.email.endsWith('@no-email.oauth.local')
    ) {
      throw new StepUpHttpException('STEP_UP_UNAVAILABLE', '账户没有可用于身份复核的已验证邮箱');
    }

    // spec §3.2 D''' OTP 限流矩阵（request）：userId 1/60s + 5/1h、session 3/1h、ip 20/1h、emailHash 5/1h。
    const emailHash = this.emailHash.hash(user.email);
    await this.rateLimit.consume([
      { key: `otp-request:user:${userId}:${purpose}`, windowMs: 60_000, limit: 1 },
      { key: `otp-request:user:${userId}:${purpose}:hourly`, windowMs: 60 * 60_000, limit: 5 },
      { key: `otp-request:session:${sessionId}`, windowMs: 60 * 60_000, limit: 3 },
      { key: `otp-request:emailhash:${emailHash}`, windowMs: 60 * 60_000, limit: 5 },
      ...(ip ? [{ key: `otp-request:ip:${ip}`, windowMs: 60 * 60_000, limit: 20 }] : []),
    ]);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const record = await this.repository.createOtp({
      userId,
      sessionId,
      emailHash,
      codeHash,
      purpose: PURPOSE_TO_EMAIL_OTP_ENUM[purpose],
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
    });
    if (!record) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '当前会话或账户不可用于身份复核');
    }

    try {
      await this.mail.sendStepUpOtp(user.email, code, purpose, OTP_TTL_MS / 60_000);
    } catch (err) {
      await this.repository.invalidateOtp(record.id);
      this.logger.error('Failed to send OTP email', err instanceof Error ? err.stack : String(err));
      throw new StepUpHttpException('STEP_UP_UNAVAILABLE', '验证码发送失败，请稍后重试');
    }

    return {
      kind: 'otp',
      channel: 'email',
      maskedTarget: EmailHashService.mask(user.email),
      requestId: record.id,
      resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  /**
   * 验证 OTP：命中即签发 proof，同时把该条 OTP 标记 consumed。
   * 每次错误尝试 +attempts；attempts >= maxAttempts 直接 OTP_LOCKED。
   */
  async verifyOtp(
    userId: string,
    purpose: StepUpPurpose,
    requestId: string,
    code: string,
    sessionId?: string,
    ip?: string,
  ): Promise<{ proof: string; expiresAt: string }> {
    if (!sessionId) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '当前会话不可用于身份复核');
    }

    const user = await this.repository.findUser(userId);
    if (
      !user ||
      (user.status !== 'ACTIVE' && user.status !== 'PENDING') ||
      !user.email ||
      !user.emailVerified ||
      user.email.endsWith('@no-email.oauth.local')
    ) {
      throw new StepUpHttpException('STEP_UP_UNAVAILABLE', '账户没有可用于身份复核的已验证邮箱');
    }

    // spec §3.2 D''' OTP 限流矩阵（verify）：userId 5/15min、session 10/15min、ip 50/15min、emailHash 10/15min。
    const emailHash = this.emailHash.hash(user.email);
    await this.rateLimit.consume([
      { key: `otp-verify:user:${userId}:${purpose}`, windowMs: 15 * 60_000, limit: 5 },
      { key: `otp-verify:session:${sessionId}`, windowMs: 15 * 60_000, limit: 10 },
      { key: `otp-verify:emailhash:${emailHash}`, windowMs: 15 * 60_000, limit: 10 },
      ...(ip ? [{ key: `otp-verify:ip:${ip}`, windowMs: 15 * 60_000, limit: 50 }] : []),
    ]);

    const result = await this.repository.verifyAndConsumeOtp({
      requestId,
      userId,
      sessionId,
      purpose: PURPOSE_TO_EMAIL_OTP_ENUM[purpose],
      emailHash,
      code,
      now: new Date(),
    });
    // 幂等冲突（已消费）保留 409；其余失败（过期/锁定/错误）统一 400 STEP_UP_INVALID_OR_EXPIRED，
    // 不暴露剩余尝试次数或锁定状态（spec §3.2 D'：不透露剩余次数）。
    if (result.status === 'consumed') {
      throw new StepUpHttpException('OTP_ALREADY_CONSUMED', '验证码已使用');
    }
    if (result.status !== 'ok') {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '验证码无效或已过期');
    }

    return this.signProof(userId, purpose, 'reauth-otp', sessionId);
  }

  /**
   * 消费 proof：在业务事务内调用，验签 + 校验 jti 未被消费。
   * 本方法本身不落库；调用方在同事务内 update email_otps 或 stepup_proofs 之类的表。
   * 简化实现：proof 载荷带 jti，业务方使用 jti 作为幂等键（如把 jti 写入 audit 表）。
   */
  verifyProof(
    proofToken: string,
    expectedUserId: string,
    expectedPurpose: StepUpPurpose,
    expectedSessionId?: string,
  ): StepUpProofPayload {
    let payload: StepUpProofPayload;
    try {
      payload = this.jwt.verify<StepUpProofPayload>(proofToken);
    } catch {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '身份复核凭证无效或已过期');
    }
    if (payload.sub !== expectedUserId) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '身份复核凭证无效或已过期');
    }
    if (payload.purpose !== expectedPurpose) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '身份复核凭证无效或已过期');
    }
    // T15.3：session 绑定校验（spec §3.2 P0）
    // - 调用方传 expectedSessionId 时，proof 中的 sid 必须存在且相等；
    // - proof 无 sid（老凭证）或 sid 不匹配 → 视为跨设备 replay，一律拒绝；
    // - 不传 expectedSessionId 保留兼容出口（例如仅做 payload 解码的场景），但生产 consumer 都应传。
    if (expectedSessionId !== undefined) {
      if (!payload.sid || payload.sid !== expectedSessionId) {
        throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '身份复核凭证无效或已过期');
      }
    }
    return payload;
  }

  /**
   * 校验并**原子消费**一次性 proof（JWT 验签 + DB 行条件消费）。
   * 供不在业务事务内的高危操作（OAuth link/unlink）复用，保证 proof 单次、绑用户/会话/用途。
   */
  async verifyAndConsumeProof(
    proofToken: string,
    userId: string,
    purpose: StepUpPurpose,
    sessionId?: string,
  ): Promise<void> {
    const payload = this.verifyProof(proofToken, userId, purpose, sessionId);
    if (!sessionId) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '当前会话不可用于身份复核');
    }
    const ok = await this.repository.consumeProof({
      jti: payload.jti,
      userId,
      sessionId,
      purpose: PURPOSE_TO_EMAIL_OTP_ENUM[purpose],
    });
    if (!ok) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '身份复核凭证无效或已使用');
    }
  }

  private async signProof(
    userId: string,
    purpose: StepUpPurpose,
    kind: StepUpProofPayload['kind'],
    sessionId?: string,
  ): Promise<{ proof: string; expiresAt: string }> {
    const jti = randomBytes(16).toString('hex');
    const claims: Omit<StepUpProofPayload, 'iat' | 'exp'> = { sub: userId, purpose, kind, jti };
    if (sessionId) {
      claims.sid = sessionId;
    }
    if (!sessionId) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '当前会话不可用于身份复核');
    }
    const expiresAtDate = new Date(Date.now() + STEP_UP_PROOF_TTL_SECONDS * 1000);
    const created = await this.repository.createProof({
      jti,
      userId,
      sessionId,
      purpose: PURPOSE_TO_EMAIL_OTP_ENUM[purpose],
      kind,
      expiresAt: expiresAtDate,
    });
    if (!created) {
      throw new StepUpHttpException('STEP_UP_INVALID_OR_EXPIRED', '当前会话或账户不可用于身份复核');
    }
    const proof = this.jwt.sign(claims, { expiresIn: STEP_UP_PROOF_TTL_SECONDS });
    return { proof, expiresAt: expiresAtDate.toISOString() };
  }
}

/**
 * 时序安全字符串比较（用于对比 jti 等敏感短串）。
 * 保留供后续 audit 层复用。
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
