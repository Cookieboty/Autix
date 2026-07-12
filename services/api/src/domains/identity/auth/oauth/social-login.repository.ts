import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import type { EmailOtpPurpose, SocialLoginFlow } from '@autix/database';

@Injectable()
export class SocialLoginRepository {
  constructor(private readonly prisma: PrismaService) {}

  createState(data: {
    state: string; nonce: string; codeVerifier: string; provider: string; systemCode: string;
    clientType: string; redirectUri: string; inviteCode?: string; deviceId?: string;
    linkUserId?: string; flow?: SocialLoginFlow; purpose?: EmailOtpPurpose;
    sessionId?: string; expiresAt: Date;
  }) {
    return this.prisma.socialLoginState.create({ data });
  }

  // 单消费保证：先读再用 deleteMany 的 count 确认只有自己删成功（state 防 CSRF 重放）
  async consumeState(state: string) {
    const row = await this.prisma.socialLoginState.findUnique({ where: { state } });
    if (!row) return null;
    const del = await this.prisma.socialLoginState.deleteMany({ where: { state } });
    if (del.count !== 1) return null; // 已被并发请求消费
    if (row.expiresAt.getTime() < Date.now()) return null;
    return row;
  }

  createLoginCode(data: { code: string; userId: string; sessionId: string; expiresAt: Date }) {
    return this.prisma.socialLoginCode.create({ data });
  }

  // 原子消费：updateMany 带条件，count===1 才算消费成功，杜绝并发双换 token（P0）
  async consumeLoginCode(code: string) {
    const upd = await this.prisma.socialLoginCode.updateMany({
      where: { code, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });
    if (upd.count !== 1) return null;
    return this.prisma.socialLoginCode.findUnique({ where: { code } });
  }
}
