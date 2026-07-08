import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { CampaignStatus, CampaignType, Prisma } from '../../platform/prisma/generated';
import { PointsService } from '../points/points.service';
import { CampaignRepository } from './campaign.repository';
import {
  SUCCESSFUL_GENERATION_STREAK,
  FIXED_CAMPAIGN_DEFINITIONS,
  HOME_QUEST_CODE_PREFIX,
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
export type CampaignEventTriggerKind =
  | 'FEEDBACK_SUBMITTED'
  | 'SUCCESSFUL_GENERATION_STREAK'
  | 'MANUAL_ADMIN_GRANT';
export type RecordCampaignEventInput = {
  triggerKind: CampaignEventTriggerKind | string;
  triggerEventId?: string | null;
  sourceRef?: {
    generationId?: string | null;
    generationType?: 'image' | 'video' | string | null;
    currentStreak?: number | null;
    cycleKey?: string | null;
  } | null;
  metadata?: Record<string, unknown> | null;
};
export type HomeStarterTaskStatus = 'LOCKED' | 'CLAIMABLE' | 'CLAIMED' | 'DISABLED';
export type HomeStarterTask = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  status: HomeStarterTaskStatus;
  completed: boolean;
  titleI18nKey: string;
  subtitleI18nKey: string;
  ctaI18nKey: string;
  modelLabel: string;
  hrefPath: string;
  sortOrder: number;
};
export type HomeStarterTasksResult = {
  items: HomeStarterTask[];
  summary: {
    total: number;
    completed: number;
    availablePoints: number;
  };
};

const REGISTRATION_BONUS_CODE = 'REGISTRATION_BONUS';

@Injectable()
export class CampaignRewardService {
  private readonly logger = new Logger(CampaignRewardService.name);
  private fixedCampaignsEnsured: Promise<void> | null = null;

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
    const homeStarterTasks = await this.listHomeStarterTasks(userId);

    return {
      activeCampaigns,
      homeStarterTasks: homeStarterTasks.items,
      claimableCampaigns: homeStarterTasks.items.filter((item) => item.status === 'CLAIMABLE'),
      streaks,
      rewards,
      pendingInvites,
    };
  }

  async listHomeStarterTasks(userId?: string | null): Promise<HomeStarterTasksResult> {
    await this.ensureFixedCampaigns();
    const campaigns = await this.campaignRepository.listHomeQuestCampaigns();
    const triggerKeys = userId
      ? campaigns.map((campaign) => this.homeQuestTriggerKey(campaign.code, userId))
      : [];
    const rewards = userId
      ? await this.campaignRepository.findRewardsByTriggerKeys(userId, triggerKeys)
      : [];
    const claimedKeys = new Set(rewards.map((reward) => reward.triggerKey));

    const items = await Promise.all(
      campaigns.map(async (campaign) => {
        const metadata = this.asRecord(campaign.metadata);
        const points = resolveRewardPoints(campaign.rewardPointsExpression);
        const enabled =
          this.isCampaignEligibleNow(campaign) &&
          points > 0 &&
          this.hasSupportedHomeQuestCompletionKind(metadata);
        const triggerKey = userId ? this.homeQuestTriggerKey(campaign.code, userId) : null;
        const claimed = Boolean(triggerKey && claimedKeys.has(triggerKey));
        const completed =
          Boolean(userId) && enabled
            ? await this.hasCompletedHomeQuest(userId!, metadata)
            : false;
        const status = this.resolveHomeStarterTaskStatus({
          enabled,
          userId,
          completed,
          claimed,
        });

        return {
          id: campaign.id,
          code: campaign.code,
          name: campaign.name,
          description: campaign.description,
          points,
          status,
          completed,
          titleI18nKey: this.asString(metadata.titleI18nKey) ?? 'onboardExploreModel',
          subtitleI18nKey: this.asString(metadata.subtitleI18nKey) ?? 'onboardSubPromptCampaign',
          ctaI18nKey: this.asString(metadata.ctaI18nKey) ?? 'onboardCtaExplore',
          modelLabel: this.asString(metadata.modelLabel) ?? campaign.name,
          hrefPath: this.asString(metadata.hrefPath) ?? '/workbench/image',
          sortOrder: this.asNumber(metadata.sortOrder, 999),
        } satisfies HomeStarterTask;
      }),
    );

    const sorted = items.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    return {
      items: sorted,
      summary: {
        total: sorted.length,
        completed: sorted.filter((item) => item.status === 'CLAIMED').length,
        availablePoints: sorted.reduce(
          (sum, item) => sum + (item.status !== 'DISABLED' ? item.points : 0),
          0,
        ),
      },
    };
  }

  async claimHomeStarterTask(code: string, userId: string) {
    const normalizedCode = code.trim();
    const campaign = await this.campaignRepository.findCampaignByCode(normalizedCode);
    if (!campaign || !this.isHomeQuestCampaign(campaign)) {
      throw new BadRequestException('首页任务不存在');
    }

    const points = resolveRewardPoints(campaign.rewardPointsExpression);
    if (!this.isCampaignEligibleNow(campaign) || points <= 0) {
      throw new BadRequestException('首页任务未启用');
    }

    const triggerKey = this.homeQuestTriggerKey(campaign.code, userId);
    const existing = await this.campaignRepository.findRewardByTrigger(campaign.id, triggerKey);
    if (existing) {
      return {
        status: 'claimed' as const,
        reward: existing,
        task: await this.findHomeStarterTaskForUser(campaign.code, userId),
      };
    }

    const metadata = this.asRecord(campaign.metadata);
    const completed = await this.hasCompletedHomeQuest(userId, metadata);
    if (!completed) throw new BadRequestException('首页任务未完成');

    const result = await this.grantCampaignReward(campaign.id, {
      userId,
      triggerKey,
      triggerEventId: campaign.code,
      pointGrantSourceId: triggerKey,
      metadata: {
        questCode: campaign.code,
        completionKind: this.asString(metadata.completionKind) ?? null,
      },
    });

    return {
      ...result,
      status: result.status === 'duplicate' ? ('claimed' as const) : ('granted' as const),
      task: await this.findHomeStarterTaskForUser(campaign.code, userId),
    };
  }

  async listAdminCampaigns() {
    await this.ensureFixedCampaigns();
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

    const campaigns = await this.listEventCampaigns(
      'SUCCESSFUL_GENERATION_STREAK',
      CampaignType.CONTINUOUS_USE,
    );
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

    const campaigns = await this.listEventCampaigns(
      'FEEDBACK_SUBMITTED',
      CampaignType.FEEDBACK,
    );

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

  async recordEvent(userId: string, input: RecordCampaignEventInput) {
    const triggerKind = input.triggerKind?.trim();
    if (!this.isSupportedAutoEventTrigger(triggerKind)) {
      throw new BadRequestException('不支持的活动触发类型');
    }
    if (triggerKind === 'FEEDBACK_SUBMITTED') {
      return this.recordFeedbackEvent(userId, input);
    }
    if (triggerKind === 'SUCCESSFUL_GENERATION_STREAK') {
      return this.recordSuccessfulGenerationStreakEvent(userId, input);
    }
    throw new BadRequestException('不支持的活动触发类型');
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
    if (campaign.status !== CampaignStatus.ACTIVE) return false;
    const now = Date.now();
    return (
      (!campaign.startsAt || campaign.startsAt.getTime() <= now) &&
      (!campaign.endsAt || campaign.endsAt.getTime() >= now)
    );
  }

  private async findHomeStarterTaskForUser(code: string, userId: string): Promise<HomeStarterTask | null> {
    const tasks = await this.listHomeStarterTasks(userId);
    return tasks.items.find((item) => item.code === code) ?? null;
  }

  private async hasCompletedHomeQuest(
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> {
    const completionKind = this.asString(metadata.completionKind);
    const modelMatchers = this.asStringArray(metadata.modelMatchers);
    if (completionKind === 'IMAGE_GENERATION_MODEL') {
      return this.campaignRepository.hasCompletedImageGenerationByModel(userId, modelMatchers);
    }
    if (completionKind === 'VIDEO_GENERATION_MODEL') {
      return this.campaignRepository.hasCompletedVideoGenerationByModel(userId, modelMatchers);
    }
    return false;
  }

  private async recordFeedbackEvent(userId: string, input: RecordCampaignEventInput) {
    const metadata = input.metadata ?? {};
    const feedbackId = String(input.triggerEventId ?? metadata.feedbackId ?? '').trim();
    const generationId = String(input.sourceRef?.generationId ?? metadata.generationId ?? '').trim();
    if (!feedbackId) throw new BadRequestException('feedbackId 必填');
    if (!generationId) throw new BadRequestException('generationId 必填');

    const feedbackInput: CampaignFeedbackInput = {
      feedbackId,
      generationId,
      generationType: this.asString(input.sourceRef?.generationType ?? metadata.generationType),
      rating: this.asNullableNumber(metadata.rating),
      tags: Array.isArray(metadata.tags) ? metadata.tags.filter((item): item is string => typeof item === 'string') : null,
      text: this.asString(metadata.text) ?? null,
      metadata,
    };
    if (!isEffectiveFeedback(feedbackInput)) {
      throw new BadRequestException('反馈内容不足');
    }
    const owned = await this.campaignRepository.generationBelongsToUser(userId, generationId);
    if (!owned) {
      throw new ForbiddenException('无效的生成记录');
    }

    const campaigns = await this.listEventCampaigns('FEEDBACK_SUBMITTED');
    const rewards: Awaited<ReturnType<CampaignRewardService['grantCampaignReward']>>[] = [];
    for (const campaign of campaigns) {
      try {
        const reward = await this.grantCampaignReward(
          campaign.id,
          buildFeedbackCampaignRewardInput(userId, campaign.id, feedbackId, feedbackInput),
        );
        rewards.push(reward);
      } catch (err) {
        this.logger.warn(
          `dynamic feedback campaign reward skipped: campaign=${campaign.id} user=${userId} reason=${(err as Error).message}`,
        );
      }
    }
    return presentFeedbackRecordResult(campaigns.length, rewards);
  }

  private async recordSuccessfulGenerationStreakEvent(
    userId: string,
    input: RecordCampaignEventInput,
  ) {
    const generationType = input.sourceRef?.generationType === 'video' ? 'video' : 'image';
    const generationId = String(input.sourceRef?.generationId ?? input.triggerEventId ?? '').trim();
    const currentStreak = Number(input.sourceRef?.currentStreak);
    const cycleKey = String(input.sourceRef?.cycleKey ?? '').trim();
    if (!generationId || !Number.isFinite(currentStreak) || currentStreak <= 0 || !cycleKey) {
      throw new BadRequestException('连续生成事件参数不完整');
    }
    const owned = await this.campaignRepository.generationBelongsToUser(userId, generationId);
    if (!owned) {
      throw new ForbiddenException('无效的生成记录');
    }
    if (!shouldRewardSuccessfulGenerationStreak(currentStreak)) return { rewards: [] };
    const expectedCycleKey = buildContinuousUseCycleKey(userId, currentStreak);
    if (cycleKey !== expectedCycleKey) {
      throw new BadRequestException('连续生成周期不匹配');
    }
    const streak = await this.campaignRepository.findStreak(userId, SUCCESSFUL_GENERATION_STREAK);
    if (!streak || streak.currentStreak !== currentStreak || streak.rewardedAtCycle === cycleKey) {
      return { rewards: [] };
    }
    const campaigns = await this.listEventCampaigns('SUCCESSFUL_GENERATION_STREAK');
    const rewards: Awaited<ReturnType<CampaignRewardService['grantCampaignReward']>>[] = [];
    if (campaigns.length === 0) return { rewards };
    for (const campaign of campaigns) {
      try {
        const reward = await this.grantCampaignReward(
          campaign.id,
          buildContinuousUseCampaignRewardInput({
            campaignId: campaign.id,
            userId,
            generationType,
            generationId,
            currentStreak,
            cycleKey,
          }),
        );
        rewards.push(reward);
      } catch (err) {
        this.logger.warn(
          `dynamic streak campaign reward skipped: campaign=${campaign.id} user=${userId} reason=${(err as Error).message}`,
        );
      }
    }
    await this.campaignRepository.updateStreak(userId, SUCCESSFUL_GENERATION_STREAK, {
      rewardedAtCycle: cycleKey,
    });
    return { rewards };
  }

  private async listEventCampaigns(
    triggerKind: CampaignEventTriggerKind,
    legacyType?: CampaignType,
  ) {
    const campaigns = await this.campaignRepository.listCampaigns(activeCampaignWhere(new Date()));
    return campaigns.filter((campaign) => (
      (legacyType !== undefined && campaign.type === legacyType) ||
      this.matchesAutoEventCampaign(campaign, triggerKind)
    ));
  }

  private matchesAutoEventCampaign(
    campaign: { metadata: Prisma.JsonValue | null },
    triggerKind: CampaignEventTriggerKind,
  ): boolean {
    const metadata = this.asRecord(campaign.metadata);
    return (
      metadata.claimMode === 'AUTO_EVENT' &&
      metadata.triggerKind === triggerKind
    );
  }

  private isSupportedAutoEventTrigger(
    triggerKind: string | undefined,
  ): triggerKind is Exclude<CampaignEventTriggerKind, 'MANUAL_ADMIN_GRANT'> {
    return triggerKind === 'FEEDBACK_SUBMITTED' || triggerKind === 'SUCCESSFUL_GENERATION_STREAK';
  }

  private resolveHomeStarterTaskStatus(input: {
    enabled: boolean;
    userId?: string | null;
    completed: boolean;
    claimed: boolean;
  }): HomeStarterTaskStatus {
    if (!input.enabled) return 'DISABLED';
    if (!input.userId) return 'LOCKED';
    if (input.claimed) return 'CLAIMED';
    if (input.completed) return 'CLAIMABLE';
    return 'LOCKED';
  }

  private homeQuestTriggerKey(code: string, userId: string): string {
    return `quest:${code}:${userId}`;
  }

  private isHomeQuestCampaign(campaign: { code: string; type: CampaignType }): boolean {
    return campaign.type === CampaignType.QUEST && campaign.code.startsWith(HOME_QUEST_CODE_PREFIX);
  }

  private hasSupportedHomeQuestCompletionKind(metadata: Record<string, unknown>): boolean {
    const completionKind = this.asString(metadata.completionKind);
    return (
      completionKind === 'IMAGE_GENERATION_MODEL' ||
      completionKind === 'VIDEO_GENERATION_MODEL'
    );
  }

  private ensureFixedCampaigns(): Promise<void> {
    if (!this.fixedCampaignsEnsured) {
      this.fixedCampaignsEnsured = this.campaignRepository
        .ensureFixedCampaigns(FIXED_CAMPAIGN_DEFINITIONS)
        .catch((err) => {
          this.fixedCampaignsEnsured = null;
          throw err;
        });
    }
    return this.fixedCampaignsEnsured;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  private asNumber(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private asNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
}
