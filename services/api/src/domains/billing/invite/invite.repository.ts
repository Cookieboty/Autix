import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class InviteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCodeByUser(userId: string) {
    return this.prisma.invite_codes.findUnique({ where: { userId } });
  }

  createCode(userId: string, code: string) {
    return this.prisma.invite_codes.create({ data: { userId, code } });
  }

  findCodeByCode(code: string) {
    return this.prisma.invite_codes.findFirst({
      where: { code, user: { status: { not: 'DELETED' } } },
    });
  }

  findRecordByInvitee(inviteeUserId: string) {
    return this.prisma.invite_records.findUnique({ where: { inviteeUserId } });
  }

  findRecordsByInviter(inviterUserId: string) {
    return this.prisma.invite_records.findMany({
      where: { inviterUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  countRewardedByInviter(inviterUserId: string) {
    return this.prisma.invite_records.count({
      where: { inviterUserId, rewarded: true },
    });
  }

  countByInviter(inviterUserId: string) {
    return this.prisma.invite_records.count({
      where: { inviterUserId },
    });
  }

  createRecord(data: Prisma.invite_recordsUncheckedCreateInput) {
    return this.prisma.invite_records.create({ data });
  }

  claimRewardAndRun(
    inviteeUserId: string,
    grantReward: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.invite_records.updateMany({
        where: { inviteeUserId, rewarded: false },
        data: { rewarded: true },
      });
      if (claim.count === 0) return false;

      await grantReward(tx);
      return true;
    });
  }
}
