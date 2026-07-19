import {
  Injectable,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { PointsSource } from '../../platform/prisma/generated';
import { SystemSettingsService } from '../../platform/system-settings/system-settings.service';
import { CampaignRewardService } from '../campaign/campaign-reward.service';
import { resolveRewardPoints } from '../campaign/campaign-reward.helpers';
import { InviteRepository } from './invite.repository';
import { generateInviteCode } from './invite.helpers';

const INVITATION_REWARD_CODE = 'INVITATION_REWARD';

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly inviteRepository: InviteRepository,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly campaignRewardService: CampaignRewardService,
  ) { }

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
    rewardPoints?: number,
  ) {
    if (!(await this.isInviteSharingEnabled())) return null;

    const code = await this.inviteRepository.findCodeByCode(inviteCode);
    if (!code) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'invite.code_not_found');
    if (code.userId === inviteeUserId) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'invite.cannot_invite_self');
    }

    const alreadyRecorded = await this.inviteRepository.findRecordByInvitee(inviteeUserId);
    if (alreadyRecorded) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'invite.already_invited');

    // FIX-2: 注册阶段只记录、不发奖励（rewarded:false）。
    // 奖励改为在被邀请人通过邮箱激活 / 管理员审批后由 settlePendingInvitationReward 结算，
    // 以杜绝「注册即发奖励」被批量小号刷量。
    const rewardPointsSnapshot = rewardPoints ?? await this.resolveInvitationRewardPointsSnapshot();
    const record = await this.inviteRepository.createRecord({
      inviteCodeId: code.id,
      inviterUserId: code.userId,
      inviteeUserId,
      rewardPoints: rewardPointsSnapshot,
      rewarded: false,
    });

    // 风控速率告警仅用于日志，不阻塞注册响应（fire-and-forget，内部已吞错）。
    void this.logInviteVelocity(code.userId);

    return record;
  }

  /** FIX-2: 一期风控——邀请人累计被邀请人数达阈值时记录告警（不拦截）。 */
  private async logInviteVelocity(inviterUserId: string) {
    try {
      const campaign = await this.campaignRewardService.findCampaignByCode(INVITATION_REWARD_CODE);
      const threshold = this.readMetadataNumber(campaign?.metadata, 'velocityThreshold');
      if (threshold == null || threshold <= 0) return;

      const total = await this.inviteRepository.countByInviter(inviterUserId);
      if (total + 1 >= threshold) {
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

    const campaign = await this.campaignRewardService.findCampaignByCode(INVITATION_REWARD_CODE);
    if (!campaign) {
      this.logger.warn(`[invite-campaign-missing] code=${INVITATION_REWARD_CODE}，跳过 invitee=${inviteeUserId}`);
      return null;
    }
    if (!this.isCampaignActive(campaign)) return null;

    // FIX-2: 每个邀请人结算笔数封顶，超过上限不再发奖励（记录告警）。
    const maxRewarded = this.readMetadataNumber(campaign.metadata, 'maxRewardedInvitesPerInviter');
    const rewardedCount = await this.inviteRepository.countRewardedByInviter(record.inviterUserId);
    if (maxRewarded != null && rewardedCount >= maxRewarded) {
      this.logger.warn(
        `[invite-cap] inviter=${record.inviterUserId} 已达邀请奖励上限(${maxRewarded})，跳过 invitee=${inviteeUserId}`,
      );
      return null;
    }

    try {
      await this.inviteRepository.claimRewardAndRun(inviteeUserId, async (tx) => {
        await this.campaignRewardService.grantCampaignRewardWithinTx(
          tx,
          campaign.id,
          {
            userId: record.inviterUserId,
            triggerKey: `invite:${record.inviteeUserId}`,
            triggerEventId: record.inviteeUserId,
            pointGrantSource: PointsSource.INVITATION,
            pointGrantSourceId: record.inviteeUserId,
            metadata: {
              source: 'invitation',
              inviteRecordId: record.id,
              inviteeUserId: record.inviteeUserId,
              rewardPointsSnapshot: record.rewardPoints,
            },
          },
          { pointsOverride: record.rewardPoints },
        );
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

  private async resolveInvitationRewardPointsSnapshot() {
    const campaign = await this.campaignRewardService.findCampaignByCode(INVITATION_REWARD_CODE);
    if (!campaign) {
      this.logger.warn(`[invite-campaign-missing] code=${INVITATION_REWARD_CODE}，邀请记录积分快照写入 0`);
      return 0;
    }
    return resolveRewardPoints(campaign.rewardPointsExpression);
  }

  private readMetadataNumber(metadata: unknown, key: string): number | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
  }

  private isCampaignActive(campaign: {
    status: string;
    startsAt: Date | string | null;
    endsAt: Date | string | null;
  }) {
    if (campaign.status !== 'ACTIVE') return false;
    const now = Date.now();
    const startsAt = campaign.startsAt ? new Date(campaign.startsAt).getTime() : null;
    const endsAt = campaign.endsAt ? new Date(campaign.endsAt).getTime() : null;
    return (startsAt == null || startsAt <= now) && (endsAt == null || endsAt >= now);
  }
}
