import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class InviteService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCode(): string {
    return randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
  }

  async getOrCreateCode(userId: string) {
    const existing = await this.prisma.invite_codes.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    return this.prisma.invite_codes.create({
      data: { userId, code: this.generateCode() },
    });
  }

  async getRecords(userId: string) {
    const codeRow = await this.prisma.invite_codes.findUnique({
      where: { userId },
    });
    if (!codeRow) return [];

    return this.prisma.invite_records.findMany({
      where: { inviterUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async rewardInviter(
    inviteCode: string,
    inviteeUserId: string,
    rewardPoints: number,
  ) {
    const code = await this.prisma.invite_codes.findUnique({
      where: { code: inviteCode },
    });
    if (!code) throw new NotFoundException('邀请码不存在');

    const alreadyRecorded = await this.prisma.invite_records.findUnique({
      where: { inviteeUserId },
    });
    if (alreadyRecorded) throw new BadRequestException('该用户已被邀请过');

    return this.prisma.$transaction(async (tx) => {
      await tx.invite_records.create({
        data: {
          inviteCodeId: code.id,
          inviterUserId: code.userId,
          inviteeUserId,
          rewardPoints,
          rewarded: true,
        },
      });

      const points = await tx.user_points.upsert({
        where: { userId: code.userId },
        create: { userId: code.userId, balance: rewardPoints },
        update: { balance: { increment: rewardPoints } },
      });

      await tx.points_records.create({
        data: {
          userId: code.userId,
          type: 'EARN',
          amount: rewardPoints,
          source: 'INVITATION',
          sourceId: code.id,
          balance: points.balance,
        },
      });
    });
  }
}
