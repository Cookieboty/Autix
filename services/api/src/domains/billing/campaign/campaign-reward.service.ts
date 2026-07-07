import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { CampaignType, Prisma } from '../../platform/prisma/generated';
import { PointsService } from '../points/points.service';
import { CampaignRepository } from './campaign.repository';
import {
  SUCCESSFUL_GENERATION_STREAK,
  activeCampaignWhere,
  addDays,
  assertBuiltinCampaignUpdateAllowed,
  assertCampaignCanGrant,
  buildCampaignCreateData,
  buildCampaignPointGrantInput,
  buildCampaignRewardCreateData,
  buildCampaignUpdateData,
  buildContinuousUseCampaignRewardInput,
  buildContinuousUseCycleKey,
  buildFeedbackCampaignRewardInput,
  buildInitialSuccessfulGenerationStreakData,
  buildManualCampaignRewardInput,
  buildSuccessfulGenerationStreakUpdateData,
  isEffectiveFeedback,
  isRewardCapExceeded,
  isUniqueConstraintError,
  presentDuplicateCampaignReward,
  presentFeedbackRecordResult,
  presentGrantedCampaignReward,
  resolveRewardPoints,
  resolveFeedbackId,
  resolveRemainingCampaignBudget,
  shouldRewardSuccessfulGenerationStreak,
  startOfDay,
  type CampaignFeedbackInput,
  type CampaignRewardRequestInput,
  type CampaignUpsertInput,
} from './campaign-reward.helpers';

export type UpsertCampaignInput = CampaignUpsertInput;
export type GrantCampaignRewardInput = CampaignRewardRequestInput;
export type RecordFeedbackInput = CampaignFeedbackInput;

const REGISTRATION_BONUS_CODE = 'REGISTRATION_BONUS';

@Injectable()
export class CampaignRewardService {
  private readonly logger = new Logger(CampaignRewardService.name);

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly pointsService: PointsService,
  ) {}

  async listActiveCampaigns(now = new Date()) {
    return this.campaignRepository.listActiveCampaigns(activeCampaignWhere(now));
  }

  async getMyProgress(userId: string) {
    const [activeCampaigns, streaks, rewards, pendingInvites] =
      await this.campaignRepository.findProgressRows(
        userId,
        activeCampaignWhere(new Date()),
      );

    return {
      activeCampaigns,
      streaks,
      rewards,
      pendingInvites,
    };
  }

  async listAdminCampaigns() {
    return this.campaignRepository.listAdminCampaigns();
  }

  async findCampaignByCode(code: string) {
    return this.campaignRepository.findCampaignByCode(code);
  }

  async listCampaignRewards(campaignId: string, take = 100) {
    return this.campaignRepository.listCampaignRewards(
      campaignId,
      Math.min(Math.max(take, 1), 200),
    );
  }

  async createCampaign(input: UpsertCampaignInput) {
    if (!input.code?.trim()) throw new BadRequestException('活动 code 必填');
    if (!input.name?.trim()) throw new BadRequestException('活动名称必填');

    return this.campaignRepository.createCampaign(buildCampaignCreateData(input));
  }

  async updateCampaign(id: string, input: UpsertCampaignInput) {
    const existing = await this.campaignRepository.findCampaign(id);
    if (!existing) throw new BadRequestException('活动不存在');
    assertBuiltinCampaignUpdateAllowed(existing, input);
    return this.campaignRepository.updateCampaign(id, buildCampaignUpdateData(input));
  }

  async grantOnce(campaignId: string, userId: string, actorId?: string) {
    return this.grantCampaignReward(
      campaignId,
      buildManualCampaignRewardInput(campaignId, userId, actorId),
    );
  }

  async grantRegistrationBonus(userId: string, source: 'email_activation' | 'oauth_first_login') {
    const campaign = await this.campaignRepository.findCampaignByCode(REGISTRATION_BONUS_CODE);
    if (!campaign || !this.isCampaignEligibleNow(campaign)) return null;
    if (resolveRewardPoints(campaign.rewardPointsExpression) <= 0) return null;

    return this.grantCampaignReward(campaign.id, {
      userId,
      triggerKey: `registration:${userId}`,
      triggerEventId: source,
      pointGrantSourceId: `registration:${userId}`,
      metadata: { source, registrationBonus: true },
    });
  }

  async recordSuccessGeneration(
    userId: string,
    generationType: 'image' | 'video',
    generationId: string,
  ) {
    const streak = await this.updateSuccessfulGenerationStreak(userId);
    if (!shouldRewardSuccessfulGenerationStreak(streak.currentStreak)) {
      return { streak, rewards: [] };
    }

    const campaigns = await this.campaignRepository.listCampaigns({
      ...activeCampaignWhere(new Date()),
      type: CampaignType.CONTINUOUS_USE,
    });
    if (campaigns.length === 0) return { streak, rewards: [] };

    const cycleKey = buildContinuousUseCycleKey(userId, streak.currentStreak);
    if (streak.rewardedAtCycle === cycleKey) return { streak, rewards: [] };

    const rewards: Awaited<ReturnType<CampaignRewardService['grantCampaignReward']>>[] = [];
    for (const campaign of campaigns) {
      try {
        const reward = await this.grantCampaignReward(
          campaign.id,
          buildContinuousUseCampaignRewardInput({
            campaignId: campaign.id,
            userId,
            generationType,
            generationId,
            currentStreak: streak.currentStreak,
            cycleKey,
          }),
        );
        rewards.push(reward);
      } catch (err) {
        this.logger.warn(
          `continuous campaign reward skipped: campaign=${campaign.id} user=${userId} reason=${(err as Error).message}`,
        );
      }
    }

    await this.campaignRepository.updateStreak(userId, SUCCESSFUL_GENERATION_STREAK, {
      rewardedAtCycle: cycleKey,
    });

    return { streak: { ...streak, rewardedAtCycle: cycleKey }, rewards };
  }

  async recordFeedback(userId: string, input: RecordFeedbackInput) {
    const feedbackId = resolveFeedbackId(input);
    if (!feedbackId) throw new BadRequestException('feedbackId 或 generationId 必填');
    if (!isEffectiveFeedback(input)) {
      throw new BadRequestException('反馈内容不足');
    }

    // FIX-14: 奖励必须锚定在"属于当前用户的真实生成记录"上，杜绝伪造 generationId 刷奖励。
    const generationId = String(input.generationId ?? '').trim();
    if (!generationId) {
      throw new BadRequestException('generationId 必填');
    }
    const owned = await this.campaignRepository.generationBelongsToUser(userId, generationId);
    if (!owned) {
      throw new ForbiddenException('无效的生成记录');
    }

    const campaigns = await this.campaignRepository.listCampaigns({
      ...activeCampaignWhere(new Date()),
      type: CampaignType.FEEDBACK,
    });

    const rewards: Awaited<ReturnType<CampaignRewardService['grantCampaignReward']>>[] = [];
    for (const campaign of campaigns) {
      try {
        const reward = await this.grantCampaignReward(
          campaign.id,
          buildFeedbackCampaignRewardInput(userId, campaign.id, feedbackId, input),
        );
        rewards.push(reward);
      } catch (err) {
        this.logger.warn(
          `feedback campaign reward skipped: campaign=${campaign.id} user=${userId} reason=${(err as Error).message}`,
        );
      }
    }

    return presentFeedbackRecordResult(campaigns.length, rewards);
  }

  async grantCampaignReward(campaignId: string, input: GrantCampaignRewardInput) {
    try {
      return await this.campaignRepository.runRewardTransaction(async (tx) => {
        return this.grantCampaignRewardWithinTx(tx, campaignId, input);
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        const reward = await this.campaignRepository.findRewardByTrigger(
          campaignId,
          input.triggerKey,
        );
        if (reward) return presentDuplicateCampaignReward(reward);
      }
      throw err;
    }
  }

  async grantCampaignRewardWithinTx(
    tx: Prisma.TransactionClient,
    campaignId: string,
    input: GrantCampaignRewardInput,
    options: { pointsOverride?: number } = {},
  ) {
    // FIX-12: 先锁活动行，串行化并发发奖，保证封顶判断原子化。
    await this.campaignRepository.lockCampaignInTx(tx, campaignId);
    const campaign = await this.campaignRepository.findCampaignInTx(tx, campaignId);
    if (!campaign) throw new BadRequestException('活动不存在');
    assertCampaignCanGrant(campaign);

    const points = options.pointsOverride ?? resolveRewardPoints(campaign.rewardPointsExpression);
    if (points <= 0) throw new BadRequestException('活动奖励积分必须大于 0');

    const existing = await this.campaignRepository.findRewardByTriggerInTx(
      tx,
      campaign.id,
      input.triggerKey,
    );
    if (existing) return presentDuplicateCampaignReward(existing);

    await this.assertRewardCaps(tx, campaign, input.userId, points);

    const reward = await this.campaignRepository.createRewardInTx(
      tx,
      buildCampaignRewardCreateData(campaign.id, input, points),
    );

    const updated = await this.campaignRepository.guardedIncrementUsedBudgetInTx(
      tx,
      campaign.id,
      resolveRemainingCampaignBudget(campaign, points),
      points,
    );
    if (updated.count === 0) {
      throw new BadRequestException('活动总预算不足');
    }

    const grant = await this.pointsService.grantPointsWithinTx(
      tx,
      input.userId,
      buildCampaignPointGrantInput(campaign, input, points),
    );

    const completed = await this.campaignRepository.attachPointGrantInTx(
      tx,
      reward.id,
      grant.grant.id,
    );

    return presentGrantedCampaignReward(completed, grant.grant);
  }

  private async updateSuccessfulGenerationStreak(userId: string) {
    const today = startOfDay(new Date());
    const existing = await this.campaignRepository.findStreak(
      userId,
      SUCCESSFUL_GENERATION_STREAK,
    );

    if (!existing) {
      return this.campaignRepository.createStreak(
        buildInitialSuccessfulGenerationStreakData(userId, today),
      );
    }

    const data = buildSuccessfulGenerationStreakUpdateData(existing, today);
    if (!data) return existing;

    return this.campaignRepository.updateStreak(userId, SUCCESSFUL_GENERATION_STREAK, {
      ...data,
    });
  }

  private async assertRewardCaps(
    tx: Prisma.TransactionClient,
    campaign: {
      id: string;
      dailyBudget: number | null;
      perUserDailyCap: number | null;
      perUserTotalCap: number | null;
    },
    userId: string,
    points: number,
  ) {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);

    if (campaign.dailyBudget != null) {
      const daily = await this.campaignRepository.aggregateRewardPointsInTx(
        tx,
        {
          campaignId: campaign.id,
          grantedAt: { gte: today, lt: tomorrow },
        },
      );
      if (isRewardCapExceeded(daily._sum.pointsGranted, points, campaign.dailyBudget)) {
        throw new BadRequestException('活动今日预算不足');
      }
    }

    if (campaign.perUserDailyCap != null) {
      const dailyUser = await this.campaignRepository.aggregateRewardPointsInTx(
        tx,
        {
          campaignId: campaign.id,
          userId,
          grantedAt: { gte: today, lt: tomorrow },
        },
      );
      if (isRewardCapExceeded(dailyUser._sum.pointsGranted, points, campaign.perUserDailyCap)) {
        throw new BadRequestException('用户今日奖励上限已达');
      }
    }

    if (campaign.perUserTotalCap != null) {
      const totalUser = await this.campaignRepository.aggregateRewardPointsInTx(
        tx,
        { campaignId: campaign.id, userId },
      );
      if (isRewardCapExceeded(totalUser._sum.pointsGranted, points, campaign.perUserTotalCap)) {
        throw new BadRequestException('用户活动总奖励上限已达');
      }
    }
  }

  private isCampaignEligibleNow(campaign: {
    status: string;
    startsAt: Date | null;
    endsAt: Date | null;
  }) {
    if (campaign.status !== 'ACTIVE') return false;
    const now = Date.now();
    return (
      (!campaign.startsAt || campaign.startsAt.getTime() <= now) &&
      (!campaign.endsAt || campaign.endsAt.getTime() >= now)
    );
  }
}
