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
import { generateInviteCode } from './invite.helpers';

const DEFAULT_INVITE_REWARD_POINTS = 100;
/** FIX-2: 每个邀请人最多可结算的邀请奖励笔数上限（防刷）。 */
const INVITE_REWARD_MAX_PER_INVITER = 50;
/** FIX-2: 邀请人累计被邀请人数达到该阈值时记录风控告警（一期仅告警，不拦截）。 */
const INVITE_VELOCITY_ALERT_THRESHOLD = 20;
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

  async getOrCreateCode(userId: string) {
    if (!(await this.isInviteSharingEnabled())) return null;

    const existing = await this.inviteRepository.findCodeByUser(userId);
    if (existing) return existing;

    return this.inviteRepository.createCode(userId, generateInviteCode());
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

    // FIX-2: 注册阶段只记录、不发奖励（rewarded:false）。
    // 奖励改为在被邀请人通过邮箱激活 / 管理员审批后由 settlePendingInvitationReward 结算，
    // 以杜绝「注册即发奖励」被批量小号刷量。
    const record = await this.inviteRepository.createRecord({
      inviteCodeId: code.id,
      inviterUserId: code.userId,
      inviteeUserId,
      rewardPoints,
      rewarded: false,
    });

    // 风控速率告警仅用于日志，不阻塞注册响应（fire-and-forget，内部已吞错）。
    void this.logInviteVelocity(code.userId);

    return record;
  }

  /** FIX-2: 一期风控——邀请人累计被邀请人数达阈值时记录告警（不拦截）。 */
  private async logInviteVelocity(inviterUserId: string) {
    try {
      const total = await this.inviteRepository.countByInviter(inviterUserId);
      if (total + 1 >= INVITE_VELOCITY_ALERT_THRESHOLD) {
        this.logger.warn(
          `[invite-velocity] inviter=${inviterUserId} 已累计邀请 ${total + 1} 人，请关注是否存在刷量`,
        );
      }
    } catch (err) {
      this.logger.error(`logInviteVelocity failed: ${(err as Error).message}`);
    }
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

    // FIX-2: 每个邀请人结算笔数封顶，超过上限不再发奖励（记录告警）。
    const rewardedCount = await this.inviteRepository.countRewardedByInviter(record.inviterUserId);
    if (rewardedCount >= INVITE_REWARD_MAX_PER_INVITER) {
      this.logger.warn(
        `[invite-cap] inviter=${record.inviterUserId} 已达邀请奖励上限(${INVITE_REWARD_MAX_PER_INVITER})，跳过 invitee=${inviteeUserId}`,
      );
      return null;
    }

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
