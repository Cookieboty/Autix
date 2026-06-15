import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  CampaignStatus,
  CampaignType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';

const DEFAULT_REWARD_USAGE_SCOPE = {
  excludedTaskPrefixes: ['seedance_'],
} as const;

const SUCCESSFUL_GENERATION_STREAK = 'successful_generation';

export interface UpsertCampaignInput {
  code?: string;
  name?: string;
  description?: string | null;
  type?: CampaignType | string;
  status?: CampaignStatus | string;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  dailyBudget?: number | null;
  totalBudget?: number | null;
  perUserDailyCap?: number | null;
  perUserTotalCap?: number | null;
  rewardGrantType?: PointGrantType | string;
  rewardSourceEvent?: PointLedgerEventType | string;
  rewardPoints?: number;
  rewardPointsExpression?: unknown;
  rewardExpiresInDays?: number;
  rewardUsageScope?: unknown;
  eligibility?: unknown;
  metadata?: unknown;
}

export interface GrantCampaignRewardInput {
  userId: string;
  triggerKey: string;
  triggerEventId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecordFeedbackInput {
  feedbackId?: string | null;
  generationId?: string | null;
  generationType?: string | null;
  rating?: number | null;
  tags?: string[] | null;
  text?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class CampaignRewardService {
  private readonly logger = new Logger(CampaignRewardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

  async listActiveCampaigns(now = new Date()) {
    return this.prisma.campaigns.findMany({
      where: this.activeCampaignWhere(now),
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getMyProgress(userId: string) {
    const [activeCampaigns, streaks, rewards, pendingInvites] = await Promise.all([
      this.listActiveCampaigns(),
      this.prisma.user_activity_streaks.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.campaign_rewards.findMany({
        where: { userId },
        include: { campaign: true },
        orderBy: { grantedAt: 'desc' },
        take: 30,
      }),
      this.prisma.invite_records.findMany({
        where: { inviterUserId: userId, rewarded: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      activeCampaigns,
      streaks,
      rewards,
      pendingInvites,
    };
  }

  async listAdminCampaigns() {
    return this.prisma.campaigns.findMany({
      include: { _count: { select: { rewards: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listCampaignRewards(campaignId: string, take = 100) {
    return this.prisma.campaign_rewards.findMany({
      where: { campaignId },
      include: { user: { select: { id: true, username: true, email: true, realName: true } } },
      orderBy: { grantedAt: 'desc' },
      take: Math.min(Math.max(take, 1), 200),
    });
  }

  async createCampaign(input: UpsertCampaignInput) {
    if (!input.code?.trim()) throw new BadRequestException('活动 code 必填');
    if (!input.name?.trim()) throw new BadRequestException('活动名称必填');

    return this.prisma.campaigns.create({
      data: this.toCampaignCreateData(input),
    });
  }

  async updateCampaign(id: string, input: UpsertCampaignInput) {
    return this.prisma.campaigns.update({
      where: { id },
      data: this.toCampaignUpdateData(input),
    });
  }

  async grantOnce(campaignId: string, userId: string, actorId?: string) {
    const triggerKey = `manual:${userId}:${Date.now()}`;
    return this.grantCampaignReward(campaignId, {
      userId,
      triggerKey,
      triggerEventId: actorId ?? null,
      metadata: { source: 'manual_admin_grant', actorId: actorId ?? null },
    });
  }

  async recordSuccessGeneration(
    userId: string,
    generationType: 'image' | 'video',
    generationId: string,
  ) {
    const streak = await this.updateSuccessfulGenerationStreak(userId);
    if (streak.currentStreak <= 0 || streak.currentStreak % 7 !== 0) {
      return { streak, rewards: [] };
    }

    const campaigns = await this.prisma.campaigns.findMany({
      where: {
        ...this.activeCampaignWhere(new Date()),
        type: CampaignType.CONTINUOUS_USE,
      },
    });
    if (campaigns.length === 0) return { streak, rewards: [] };

    const cycleStart = this.addDays(
      this.startOfDay(new Date()),
      -Math.max(streak.currentStreak - 1, 0),
    );
    const cycleKey = `continuous_use:${userId}:${this.dateKey(cycleStart)}:${streak.currentStreak}`;
    if (streak.rewardedAtCycle === cycleKey) return { streak, rewards: [] };

    const rewards: Awaited<ReturnType<CampaignRewardService['grantCampaignReward']>>[] = [];
    for (const campaign of campaigns) {
      try {
        const reward = await this.grantCampaignReward(campaign.id, {
          userId,
          triggerKey: `${cycleKey}:${campaign.id}`,
          triggerEventId: generationId,
          metadata: {
            generationType,
            generationId,
            currentStreak: streak.currentStreak,
          },
        });
        rewards.push(reward);
      } catch (err) {
        this.logger.warn(
          `continuous campaign reward skipped: campaign=${campaign.id} user=${userId} reason=${(err as Error).message}`,
        );
      }
    }

    await this.prisma.user_activity_streaks.update({
      where: {
        userId_streakType: { userId, streakType: SUCCESSFUL_GENERATION_STREAK },
      },
      data: { rewardedAtCycle: cycleKey },
    });

    return { streak: { ...streak, rewardedAtCycle: cycleKey }, rewards };
  }

  async recordFeedback(userId: string, input: RecordFeedbackInput) {
    const feedbackId = String(input.feedbackId ?? input.generationId ?? '').trim();
    if (!feedbackId) throw new BadRequestException('feedbackId 或 generationId 必填');
    if (!this.isEffectiveFeedback(input)) {
      throw new BadRequestException('反馈内容不足');
    }

    const campaigns = await this.prisma.campaigns.findMany({
      where: {
        ...this.activeCampaignWhere(new Date()),
        type: CampaignType.FEEDBACK,
      },
    });

    const rewards: Awaited<ReturnType<CampaignRewardService['grantCampaignReward']>>[] = [];
    for (const campaign of campaigns) {
      try {
        const reward = await this.grantCampaignReward(campaign.id, {
          userId,
          triggerKey: `feedback:${userId}:${feedbackId}:${campaign.id}`,
          triggerEventId: feedbackId,
          metadata: {
            ...(input.metadata ?? {}),
            feedbackId,
            generationId: input.generationId ?? null,
            generationType: input.generationType ?? null,
            rating: input.rating ?? null,
            tags: this.normalizeTags(input.tags),
            text: input.text?.trim() ? input.text.trim().slice(0, 1000) : null,
          },
        });
        rewards.push(reward);
      } catch (err) {
        this.logger.warn(
          `feedback campaign reward skipped: campaign=${campaign.id} user=${userId} reason=${(err as Error).message}`,
        );
      }
    }

    return {
      status: campaigns.length > 0 ? ('recorded' as const) : ('no_active_campaign' as const),
      rewards,
    };
  }

  async grantCampaignReward(campaignId: string, input: GrantCampaignRewardInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const campaign = await tx.campaigns.findUnique({ where: { id: campaignId } });
        if (!campaign) throw new BadRequestException('活动不存在');
        this.assertCampaignCanGrant(campaign);

        const points = this.resolveRewardPoints(campaign.rewardPointsExpression);
        if (points <= 0) throw new BadRequestException('活动奖励积分必须大于 0');

        const existing = await tx.campaign_rewards.findUnique({
          where: {
            campaignId_triggerKey: {
              campaignId: campaign.id,
              triggerKey: input.triggerKey,
            },
          },
        });
        if (existing) return { status: 'duplicate' as const, reward: existing };

        await this.assertRewardCaps(tx, campaign, input.userId, points);

        const reward = await tx.campaign_rewards.create({
          data: {
            campaignId: campaign.id,
            userId: input.userId,
            triggerKey: input.triggerKey,
            triggerEventId: input.triggerEventId ?? null,
            pointsGranted: points,
            metadata: this.toJson(input.metadata ?? {}),
          },
        });

        const updated = await tx.campaigns.updateMany({
          where: {
            id: campaign.id,
            ...(campaign.totalBudget != null
              ? { usedBudget: { lte: campaign.totalBudget - points } }
              : {}),
          },
          data: { usedBudget: { increment: points } },
        });
        if (updated.count === 0) {
          throw new BadRequestException('活动总预算不足');
        }

        const expiresAt =
          campaign.rewardExpiresInDays > 0
            ? this.addDays(new Date(), campaign.rewardExpiresInDays)
            : null;
        const usageScope =
          campaign.rewardUsageScope ??
          (campaign.rewardGrantType === PointGrantType.GIFT
            ? DEFAULT_REWARD_USAGE_SCOPE
            : undefined);

        const grant = await this.pointsService.grantPointsWithinTx(tx, input.userId, {
          amount: points,
          grantType: campaign.rewardGrantType,
          sourceEvent: campaign.rewardSourceEvent,
          source: PointsSource.CAMPAIGN,
          sourceId: campaign.id,
          expiresAt,
          usageScope: usageScope as Prisma.InputJsonValue | undefined,
          metadata: this.toJson({
            campaignId: campaign.id,
            campaignCode: campaign.code,
            triggerKey: input.triggerKey,
            ...(input.metadata ?? {}),
          }),
          remark: `活动奖励：${campaign.name}`,
        });

        const completed = await tx.campaign_rewards.update({
          where: { id: reward.id },
          data: { pointGrantId: grant.grant.id },
        });

        return { status: 'granted' as const, reward: completed, grant: grant.grant };
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const reward = await this.prisma.campaign_rewards.findFirst({
          where: { campaignId, triggerKey: input.triggerKey },
        });
        if (reward) return { status: 'duplicate' as const, reward };
      }
      throw err;
    }
  }

  private async updateSuccessfulGenerationStreak(userId: string) {
    const today = this.startOfDay(new Date());
    const existing = await this.prisma.user_activity_streaks.findUnique({
      where: {
        userId_streakType: { userId, streakType: SUCCESSFUL_GENERATION_STREAK },
      },
    });

    if (!existing) {
      return this.prisma.user_activity_streaks.create({
        data: {
          userId,
          streakType: SUCCESSFUL_GENERATION_STREAK,
          currentStreak: 1,
          longestStreak: 1,
          lastActiveDate: today,
        },
      });
    }

    const last = existing.lastActiveDate ? this.startOfDay(existing.lastActiveDate) : null;
    if (last && last.getTime() === today.getTime()) return existing;

    const yesterday = this.addDays(today, -1);
    const currentStreak =
      last && last.getTime() === yesterday.getTime()
        ? existing.currentStreak + 1
        : 1;

    return this.prisma.user_activity_streaks.update({
      where: {
        userId_streakType: { userId, streakType: SUCCESSFUL_GENERATION_STREAK },
      },
      data: {
        currentStreak,
        longestStreak: Math.max(existing.longestStreak, currentStreak),
        lastActiveDate: today,
        rewardedAtCycle: currentStreak === 1 ? null : existing.rewardedAtCycle,
      },
    });
  }

  private activeCampaignWhere(now: Date): Prisma.campaignsWhereInput {
    return {
      status: CampaignStatus.ACTIVE,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };
  }

  private assertCampaignCanGrant(campaign: {
    status: CampaignStatus;
    startsAt: Date | null;
    endsAt: Date | null;
  }) {
    const now = Date.now();
    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException('活动未启用');
    }
    if (campaign.startsAt && campaign.startsAt.getTime() > now) {
      throw new BadRequestException('活动尚未开始');
    }
    if (campaign.endsAt && campaign.endsAt.getTime() < now) {
      throw new BadRequestException('活动已结束');
    }
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
    const today = this.startOfDay(new Date());
    const tomorrow = this.addDays(today, 1);

    if (campaign.dailyBudget != null) {
      const daily = await tx.campaign_rewards.aggregate({
        where: {
          campaignId: campaign.id,
          grantedAt: { gte: today, lt: tomorrow },
        },
        _sum: { pointsGranted: true },
      });
      if ((daily._sum.pointsGranted ?? 0) + points > campaign.dailyBudget) {
        throw new BadRequestException('活动今日预算不足');
      }
    }

    if (campaign.perUserDailyCap != null) {
      const dailyUser = await tx.campaign_rewards.aggregate({
        where: {
          campaignId: campaign.id,
          userId,
          grantedAt: { gte: today, lt: tomorrow },
        },
        _sum: { pointsGranted: true },
      });
      if ((dailyUser._sum.pointsGranted ?? 0) + points > campaign.perUserDailyCap) {
        throw new BadRequestException('用户今日奖励上限已达');
      }
    }

    if (campaign.perUserTotalCap != null) {
      const totalUser = await tx.campaign_rewards.aggregate({
        where: { campaignId: campaign.id, userId },
        _sum: { pointsGranted: true },
      });
      if ((totalUser._sum.pointsGranted ?? 0) + points > campaign.perUserTotalCap) {
        throw new BadRequestException('用户活动总奖励上限已达');
      }
    }
  }

  private toCampaignCreateData(input: UpsertCampaignInput): Prisma.campaignsCreateInput {
    return {
      code: input.code!.trim(),
      name: input.name!.trim(),
      description: input.description ?? null,
      type: this.enumValue(CampaignType, input.type, CampaignType.CUSTOM),
      status: this.enumValue(CampaignStatus, input.status, CampaignStatus.DRAFT),
      startsAt: this.parseDate(input.startsAt),
      endsAt: this.parseDate(input.endsAt),
      dailyBudget: this.optionalInt(input.dailyBudget),
      totalBudget: this.optionalInt(input.totalBudget),
      perUserDailyCap: this.optionalInt(input.perUserDailyCap),
      perUserTotalCap: this.optionalInt(input.perUserTotalCap),
      rewardGrantType: this.enumValue(PointGrantType, input.rewardGrantType, PointGrantType.GIFT),
      rewardSourceEvent: this.enumValue(
        PointLedgerEventType,
        input.rewardSourceEvent,
        PointLedgerEventType.campaign_bonus,
      ),
      rewardPointsExpression: this.rewardExpression(input),
      rewardExpiresInDays: this.positiveInt(input.rewardExpiresInDays, 7),
      rewardUsageScope: this.toJsonOrDefault(
        input.rewardUsageScope,
        DEFAULT_REWARD_USAGE_SCOPE,
      ),
      eligibility: this.toJsonOrNull(input.eligibility),
      metadata: this.toJsonOrNull(input.metadata),
    };
  }

  private toCampaignUpdateData(input: UpsertCampaignInput): Prisma.campaignsUpdateInput {
    const data: Prisma.campaignsUpdateInput = {};
    if (input.code !== undefined) data.code = input.code.trim();
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.type !== undefined) data.type = this.enumValue(CampaignType, input.type, CampaignType.CUSTOM);
    if (input.status !== undefined) data.status = this.enumValue(CampaignStatus, input.status, CampaignStatus.DRAFT);
    if (input.startsAt !== undefined) data.startsAt = this.parseDate(input.startsAt);
    if (input.endsAt !== undefined) data.endsAt = this.parseDate(input.endsAt);
    if (input.dailyBudget !== undefined) data.dailyBudget = this.optionalInt(input.dailyBudget);
    if (input.totalBudget !== undefined) data.totalBudget = this.optionalInt(input.totalBudget);
    if (input.perUserDailyCap !== undefined) data.perUserDailyCap = this.optionalInt(input.perUserDailyCap);
    if (input.perUserTotalCap !== undefined) data.perUserTotalCap = this.optionalInt(input.perUserTotalCap);
    if (input.rewardGrantType !== undefined) {
      data.rewardGrantType = this.enumValue(PointGrantType, input.rewardGrantType, PointGrantType.GIFT);
    }
    if (input.rewardSourceEvent !== undefined) {
      data.rewardSourceEvent = this.enumValue(
        PointLedgerEventType,
        input.rewardSourceEvent,
        PointLedgerEventType.campaign_bonus,
      );
    }
    if (input.rewardPoints !== undefined || input.rewardPointsExpression !== undefined) {
      data.rewardPointsExpression = this.rewardExpression(input);
    }
    if (input.rewardExpiresInDays !== undefined) {
      data.rewardExpiresInDays = this.positiveInt(input.rewardExpiresInDays, 7);
    }
    if (input.rewardUsageScope !== undefined) data.rewardUsageScope = this.toJsonOrNull(input.rewardUsageScope);
    if (input.eligibility !== undefined) data.eligibility = this.toJsonOrNull(input.eligibility);
    if (input.metadata !== undefined) data.metadata = this.toJsonOrNull(input.metadata);
    return data;
  }

  private rewardExpression(input: UpsertCampaignInput): Prisma.InputJsonValue {
    if (input.rewardPointsExpression !== undefined) {
      return this.toJson(input.rewardPointsExpression);
    }
    return { fixed: this.positiveInt(input.rewardPoints, 0) };
  }

  private resolveRewardPoints(expression: unknown): number {
    if (typeof expression === 'number') return this.positiveInt(expression, 0);
    if (typeof expression === 'string') return this.positiveInt(Number(expression), 0);
    if (expression && typeof expression === 'object') {
      const obj = expression as Record<string, unknown>;
      return this.positiveInt(
        Number(obj.fixed ?? obj.amount ?? obj.points ?? 0),
        0,
      );
    }
    return 0;
  }

  private isEffectiveFeedback(input: RecordFeedbackInput): boolean {
    const rating = Number(input.rating);
    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) return true;
    if (this.normalizeTags(input.tags).length > 0) return true;
    return Boolean(input.text?.trim() && input.text.trim().length >= 3);
  }

  private normalizeTags(tags: string[] | null | undefined): string[] {
    if (!Array.isArray(tags)) return [];
    return tags
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  private enumValue<T extends Record<string, string>>(
    enumObject: T,
    value: unknown,
    fallback: T[keyof T],
  ): T[keyof T] {
    if (typeof value === 'string' && Object.values(enumObject).includes(value)) {
      return value as T[keyof T];
    }
    return fallback;
  }

  private optionalInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
  }

  private positiveInt(value: unknown, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
  }

  private parseDate(value: string | Date | null | undefined): Date | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private toJsonOrNull(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value == null || value === '') return Prisma.JsonNull;
    return this.toJson(value);
  }

  private toJsonOrDefault(
    value: unknown,
    fallback: unknown,
  ): Prisma.InputJsonValue {
    if (value == null || value === '') return this.toJson(fallback);
    return this.toJson(value);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
