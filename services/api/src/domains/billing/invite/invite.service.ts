import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PointsService } from '../points/points.service';
import { PointGrantType, PointLedgerEventType, PointsSource } from '../../platform/prisma/generated';
import { SystemSettingsService } from '../../platform/system-settings/system-settings.service';
import { InviteRepository } from './invite.repository';
import { randomBytes } from 'crypto';

const DEFAULT_INVITE_REWARD_POINTS = 100;
const INVITE_REWARD_USAGE_SCOPE = {
  excludedTaskTypes: ['video_generation'],
} as const;

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly inviteRepository: InviteRepository,
    private readonly pointsService: PointsService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  private generateCode(): string {
    return randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
  }

  async getOrCreateCode(userId: string) {
    if (!(await this.isInviteSharingEnabled())) return null;

    const existing = await this.inviteRepository.findCodeByUser(userId);
    if (existing) return existing;

    return this.inviteRepository.createCode(userId, this.generateCode());
  }

  async getRecords(userId: string) {
    if (!(await this.isInviteSharingEnabled())) return [];

    const codeRow = await this.inviteRepository.findCodeByUser(userId);
    if (!codeRow) return [];

    return this.inviteRepository.findRecordsByInviter(userId);
  }

  async recordInvitation(
    inviteCode: string,
    inviteeUserId: string,
    rewardPoints: number = DEFAULT_INVITE_REWARD_POINTS,
  ) {
    if (!(await this.isInviteSharingEnabled())) return null;

    const code = await this.inviteRepository.findCodeByCode(inviteCode);
    if (!code) throw new NotFoundException('邀请码不存在');
    if (code.userId === inviteeUserId) {
      throw new BadRequestException('不能邀请自己');
    }

    const alreadyRecorded = await this.inviteRepository.findRecordByInvitee(inviteeUserId);
    if (alreadyRecorded) throw new BadRequestException('该用户已被邀请过');

    const recordData = {
      inviteCodeId: code.id,
      inviterUserId: code.userId,
      inviteeUserId,
      rewardPoints,
      rewarded: rewardPoints > 0,
    };

    if (rewardPoints <= 0) {
      return this.inviteRepository.createRecord(recordData);
    }

    return this.inviteRepository.createRecordAndGrantReward(recordData, async (tx) => {
      await this.grantInviteReward(tx, {
        inviterUserId: code.userId,
        sourceId: inviteeUserId,
        rewardPoints,
        remark: '邀请奖励（被邀请人注册成功）',
      });
    });
  }

  /**
   * 历史数据兜底：幂等补发旧版本遗留的待结算邀请奖励。
   * - 没有邀请记录、已结算、奖励金额 <= 0：直接返回（无副作用）；
   * - 真正发奖时：GIFT 批次写入 usageScope 禁用视频生成任务（P0-2）。
   */
  async settlePendingInvitationReward(inviteeUserId: string) {
    if (!(await this.isInviteSharingEnabled())) return null;

    const record = await this.inviteRepository.findRecordByInvitee(inviteeUserId);
    if (!record || record.rewarded || record.rewardPoints <= 0) return null;

    try {
      await this.inviteRepository.claimRewardAndRun(inviteeUserId, async (tx) => {
        await this.grantInviteReward(tx, {
          inviterUserId: record.inviterUserId,
          sourceId: record.inviteeUserId,
          rewardPoints: record.rewardPoints,
          remark: '邀请奖励（历史待结算补发）',
        });
      });
      return record;
    } catch (err) {
      this.logger.error(
        `settlePendingInvitationReward failed: invitee=${inviteeUserId} reason=${(err as Error).message}`,
      );
      return null;
    }
  }

  private async isInviteSharingEnabled(): Promise<boolean> {
    return this.systemSettingsService.getBoolean('features.inviteSharingEnabled');
  }

  private async grantInviteReward(
    tx: Parameters<PointsService['grantPointsWithinTx']>[0],
    input: {
      inviterUserId: string;
      sourceId: string;
      rewardPoints: number;
      remark: string;
    },
  ) {
    await this.pointsService.grantPointsWithinTx(tx, input.inviterUserId, {
      amount: input.rewardPoints,
      grantType: PointGrantType.GIFT,
      sourceEvent: PointLedgerEventType.campaign_bonus,
      source: PointsSource.INVITATION,
      sourceId: input.sourceId,
      usageScope: INVITE_REWARD_USAGE_SCOPE,
      remark: input.remark,
    });
  }
}
