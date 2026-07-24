import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { EmailOtpPurpose } from '@autix/database';
import { PrismaService } from '../../../platform/prisma/prisma.service';

export type OtpConsumeResult =
  | { status: 'ok' }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'consumed' }
  | { status: 'locked' };

type LockedOtpRow = {
  id: string;
  userId: string | null;
  emailHash: string;
  codeHash: string;
  purpose: EmailOtpPurpose;
  sessionId: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
};

@Injectable()
export class StepUpRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        email: true,
        emailVerified: true,
        status: true,
        language: true,
      },
    });
  }

  async createProof(input: {
    jti: string;
    userId: string;
    sessionId: string;
    purpose: EmailOtpPurpose;
    kind: string;
    expiresAt: Date;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const sessions = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT sessions."id"
        FROM "users" users
        JOIN "user_sessions" sessions
          ON sessions."userId" = users."id"
         AND sessions."id" = ${input.sessionId}
        WHERE users."id" = ${input.userId}
          AND users."status" NOT IN ('DELETED', 'DISABLED', 'LOCKED')
          AND sessions."isActive" = TRUE
          AND sessions."expiresAt" > NOW()
        FOR UPDATE OF users, sessions
      `;
      if (!sessions[0]) return false;
      await tx.step_up_proofs.create({ data: input });
      return true;
    });
  }

  /**
   * 原子消费一次性 step-up proof（供不在业务事务内的调用方，如 OAuth link/unlink 使用）。
   * 命中 `jti + userId + sessionId + purpose + consumedAt IS NULL + 未过期` 才置 consumedAt，`count===1` 表示成功。
   */
  async consumeProof(input: {
    jti: string;
    userId: string;
    sessionId: string;
    purpose: EmailOtpPurpose;
    now?: Date;
  }): Promise<boolean> {
    const now = input.now ?? new Date();
    const res = await this.prisma.step_up_proofs.updateMany({
      where: {
        jti: input.jti,
        userId: input.userId,
        sessionId: input.sessionId,
        purpose: input.purpose,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    return res.count === 1;
  }

  async createOtp(input: {
    userId: string;
    sessionId: string;
    emailHash: string;
    codeHash: string;
    purpose: EmailOtpPurpose;
    maxAttempts: number;
    expiresAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const sessions = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT sessions."id"
        FROM "users" users
        JOIN "user_sessions" sessions
          ON sessions."userId" = users."id"
         AND sessions."id" = ${input.sessionId}
        WHERE users."id" = ${input.userId}
          AND users."status" NOT IN ('DELETED', 'DISABLED', 'LOCKED')
          AND sessions."isActive" = TRUE
          AND sessions."expiresAt" > NOW()
        FOR UPDATE OF users, sessions
      `;
      if (!sessions[0]) return null;
      await tx.email_otps.updateMany({
        where: {
          userId: input.userId,
          sessionId: input.sessionId,
          purpose: input.purpose,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: { invalidatedAt: new Date() },
      });
      return tx.email_otps.create({
        data: input,
        select: { id: true, expiresAt: true },
      });
    });
  }

  invalidateOtp(id: string): Promise<unknown> {
    return this.prisma.email_otps.updateMany({
      where: { id, consumedAt: null },
      data: { invalidatedAt: new Date() },
    });
  }

  async verifyAndConsumeOtp(input: {
    requestId: string;
    userId: string;
    sessionId: string;
    purpose: EmailOtpPurpose;
    emailHash: string;
    code: string;
    now: Date;
  }): Promise<OtpConsumeResult> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedOtpRow[]>`
        SELECT * FROM "email_otps"
        WHERE "id" = ${input.requestId}
        FOR UPDATE
      `;
      const row = rows[0];
      if (
        !row ||
        row.userId !== input.userId ||
        row.sessionId !== input.sessionId ||
        row.purpose !== input.purpose ||
        row.emailHash !== input.emailHash ||
        row.invalidatedAt
      ) {
        return { status: 'invalid' };
      }
      if (row.consumedAt) return { status: 'consumed' };
      if (row.expiresAt <= input.now) return { status: 'expired' };
      if (row.attempts >= row.maxAttempts) return { status: 'locked' };

      if (!(await bcrypt.compare(input.code, row.codeHash))) {
        const nextAttempts = row.attempts + 1;
        await tx.email_otps.update({
          where: { id: row.id },
          data: { attempts: nextAttempts },
        });
        return { status: nextAttempts >= row.maxAttempts ? 'locked' : 'invalid' };
      }

      await tx.email_otps.update({
        where: { id: row.id },
        data: { consumedAt: input.now },
      });
      return { status: 'ok' };
    });
  }

  /**
   * 清理已过期的 OTP challenge 与 step-up proof（都是 5min 级 ephemeral 记录），保证磁盘有界。
   * spec §3.2 D'：过期 OTP 懒清理 + 后台 job；proof 同为短时一次性凭证，一并清理。
   * 保留 graceMs 余量（默认 1h）避免删掉刚刚过期、仍可能被 verify 命中并映射为过期错误的记录。
   */
  async deleteExpiredChallenges(
    now: Date = new Date(),
    graceMs = 3600_000,
  ): Promise<{ otps: number; proofs: number }> {
    const cutoff = new Date(now.getTime() - graceMs);
    const [otps, proofs] = await this.prisma.$transaction([
      this.prisma.email_otps.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      this.prisma.step_up_proofs.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    ]);
    return { otps: otps.count, proofs: proofs.count };
  }
}
