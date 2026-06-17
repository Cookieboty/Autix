import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { PointGrantType, PointLedgerEventType, PointsSource } from '../prisma/generated';
import { randomBytes } from 'crypto';

const DEFAULT_INVITE_REWARD_POINTS = 100;
const INVITE_REWARD_USAGE_SCOPE = {
  excludedTaskPrefixes: ['seedance_'],
} as const;

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

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

  /**
   * P0-3: 注册阶段仅登记邀请关系，不立即发奖。
   * `rewarded=false` 标记“待结算”，需要被邀请人首次生成成功后调用
   * `settleInvitationOnFirstGeneration` 才真正发放积分。
   */
  async recordInvitation(
    inviteCode: string,
    inviteeUserId: string,
    rewardPoints: number = DEFAULT_INVITE_REWARD_POINTS,
  ) {
    const code = await this.prisma.invite_codes.findUnique({
      where: { code: inviteCode },
    });
    if (!code) throw new NotFoundException('邀请码不存在');
    if (code.userId === inviteeUserId) {
      throw new BadRequestException('不能邀请自己');
    }

    const alreadyRecorded = await this.prisma.invite_records.findUnique({
      where: { inviteeUserId },
    });
    if (alreadyRecorded) throw new BadRequestException('该用户已被邀请过');

    return this.prisma.invite_records.create({
      data: {
        inviteCodeId: code.id,
        inviterUserId: code.userId,
        inviteeUserId,
        rewardPoints,
        rewarded: false,
      },
    });
  }

  /**
   * P0-3: 被邀请人首次生成成功后调用，幂等结算邀请奖励。
   * - 没有邀请记录、已结算、奖励金额 <= 0：直接返回（无副作用）；
   * - 真正发奖时：GIFT 批次写入 usageScope 禁用 seedance_* 高成本视频任务（P0-2）。
   */
  async settleInvitationOnFirstGeneration(inviteeUserId: string) {
    const record = await this.prisma.invite_records.findUnique({
      where: { inviteeUserId },
    });
    if (!record || record.rewarded || record.rewardPoints <= 0) return null;

    try {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.invite_records.updateMany({
          where: { inviteeUserId, rewarded: false },
          data: { rewarded: true },
        });
        if (claim.count === 0) return;

        await this.pointsService.grantPointsWithinTx(tx, record.inviterUserId, {
          amount: record.rewardPoints,
          grantType: PointGrantType.GIFT,
          sourceEvent: PointLedgerEventType.campaign_bonus,
          source: PointsSource.INVITATION,
          sourceId: record.inviteCodeId,
          usageScope: INVITE_REWARD_USAGE_SCOPE,
          remark: '邀请奖励（被邀请人首次生成）',
        });
      });
      return record;
    } catch (err) {
      this.logger.error(
        `settleInvitationOnFirstGeneration failed: invitee=${inviteeUserId} reason=${(err as Error).message}`,
      );
      return null;
    }
  }
}
