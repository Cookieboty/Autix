import { BadRequestException } from '@nestjs/common';
import {
  CampaignStatus,
  CampaignType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../../platform/prisma/generated';

export const DEFAULT_REWARD_USAGE_SCOPE = {
  excludedTaskPrefixes: ['seedance_'],
} as const;

export const SUCCESSFUL_GENERATION_STREAK = 'successful_generation';

type FeedbackEffectivenessInput = {
  rating?: number | null;
  tags?: string[] | null;
  text?: string | null;
};

export type CampaignUpsertInput = {
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
};

export type CampaignRewardRequestInput = {
  userId: string;
  triggerKey: string;
  triggerEventId?: string | null;
  metadata?: Record<string, unknown>;
};

export type CampaignFeedbackInput = {
  feedbackId?: string | null;
  generationId?: string | null;
  generationType?: string | null;
  rating?: number | null;
  tags?: string[] | null;
  text?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CampaignRewardGrantCampaign = {
  id: string;
  code: string;
  name: string;
  totalBudget: number | null;
  rewardGrantType: PointGrantType;
  rewardSourceEvent: PointLedgerEventType;
  rewardExpiresInDays: number;
  rewardUsageScope: Prisma.JsonValue | null;
};

type SuccessfulGenerationStreakRecord = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  rewardedAtCycle: string | null;
};

export function activeCampaignWhere(now: Date): Prisma.campaignsWhereInput {
  return {
    status: CampaignStatus.ACTIVE,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

export function assertCampaignCanGrant(
  campaign: {
    status: CampaignStatus;
    startsAt: Date | null;
    endsAt: Date | null;
  },
  nowMs = Date.now(),
) {
  if (campaign.status !== CampaignStatus.ACTIVE) {
    throw new BadRequestException('活动未启用');
  }
  if (campaign.startsAt && campaign.startsAt.getTime() > nowMs) {
    throw new BadRequestException('活动尚未开始');
  }
  if (campaign.endsAt && campaign.endsAt.getTime() < nowMs) {
    throw new BadRequestException('活动已结束');
  }
}

export function isRewardCapExceeded(
  existingPoints: number | null | undefined,
  pointsToGrant: number,
  cap: number | null | undefined,
) {
  return cap != null && (existingPoints ?? 0) + pointsToGrant > cap;
}

export function buildCampaignCreateData(
  input: CampaignUpsertInput,
): Prisma.campaignsCreateInput {
  return {
    code: input.code!.trim(),
    name: input.name!.trim(),
    description: input.description ?? null,
    type: enumValue(CampaignType, input.type, CampaignType.CUSTOM),
    status: enumValue(CampaignStatus, input.status, CampaignStatus.DRAFT),
    startsAt: parseDate(input.startsAt),
    endsAt: parseDate(input.endsAt),
    dailyBudget: optionalInt(input.dailyBudget),
    totalBudget: optionalInt(input.totalBudget),
    perUserDailyCap: optionalInt(input.perUserDailyCap),
    perUserTotalCap: optionalInt(input.perUserTotalCap),
    rewardGrantType: enumValue(
      PointGrantType,
      input.rewardGrantType,
      PointGrantType.GIFT,
    ),
    rewardSourceEvent: enumValue(
      PointLedgerEventType,
      input.rewardSourceEvent,
      PointLedgerEventType.campaign_bonus,
    ),
    rewardPointsExpression: rewardExpression(input),
    rewardExpiresInDays: positiveInt(input.rewardExpiresInDays, 7),
    rewardUsageScope: toJsonOrDefault(
      input.rewardUsageScope,
      DEFAULT_REWARD_USAGE_SCOPE,
    ),
    eligibility: toJsonOrNull(input.eligibility),
    metadata: toJsonOrNull(input.metadata),
  };
}

export function buildCampaignUpdateData(
  input: CampaignUpsertInput,
): Prisma.campaignsUpdateInput {
  const data: Prisma.campaignsUpdateInput = {};
  if (input.code !== undefined) data.code = input.code.trim();
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description;
  if (input.type !== undefined) {
    data.type = enumValue(CampaignType, input.type, CampaignType.CUSTOM);
  }
  if (input.status !== undefined) {
    data.status = enumValue(CampaignStatus, input.status, CampaignStatus.DRAFT);
  }
  if (input.startsAt !== undefined) data.startsAt = parseDate(input.startsAt);
  if (input.endsAt !== undefined) data.endsAt = parseDate(input.endsAt);
  if (input.dailyBudget !== undefined) {
    data.dailyBudget = optionalInt(input.dailyBudget);
  }
  if (input.totalBudget !== undefined) {
    data.totalBudget = optionalInt(input.totalBudget);
  }
  if (input.perUserDailyCap !== undefined) {
    data.perUserDailyCap = optionalInt(input.perUserDailyCap);
  }
  if (input.perUserTotalCap !== undefined) {
    data.perUserTotalCap = optionalInt(input.perUserTotalCap);
  }
  if (input.rewardGrantType !== undefined) {
    data.rewardGrantType = enumValue(
      PointGrantType,
      input.rewardGrantType,
      PointGrantType.GIFT,
    );
  }
  if (input.rewardSourceEvent !== undefined) {
    data.rewardSourceEvent = enumValue(
      PointLedgerEventType,
      input.rewardSourceEvent,
      PointLedgerEventType.campaign_bonus,
    );
  }
  if (input.rewardPoints !== undefined || input.rewardPointsExpression !== undefined) {
    data.rewardPointsExpression = rewardExpression(input);
  }
  if (input.rewardExpiresInDays !== undefined) {
    data.rewardExpiresInDays = positiveInt(input.rewardExpiresInDays, 7);
  }
  if (input.rewardUsageScope !== undefined) {
    data.rewardUsageScope = toJsonOrNull(input.rewardUsageScope);
  }
  if (input.eligibility !== undefined) {
    data.eligibility = toJsonOrNull(input.eligibility);
  }
  if (input.metadata !== undefined) {
    data.metadata = toJsonOrNull(input.metadata);
  }
  return data;
}

export function buildManualCampaignRewardInput(
  userId: string,
  actorId?: string,
  nowMs = Date.now(),
): CampaignRewardRequestInput {
  return {
    userId,
    triggerKey: `manual:${userId}:${nowMs}`,
    triggerEventId: actorId ?? null,
    metadata: { source: 'manual_admin_grant', actorId: actorId ?? null },
  };
}

export function shouldRewardSuccessfulGenerationStreak(currentStreak: number): boolean {
  return currentStreak > 0 && currentStreak % 7 === 0;
}

export function buildContinuousUseCycleKey(
  userId: string,
  currentStreak: number,
  now = new Date(),
): string {
  const cycleStart = addDays(
    startOfDay(now),
    -Math.max(currentStreak - 1, 0),
  );
  return `continuous_use:${userId}:${dateKey(cycleStart)}:${currentStreak}`;
}

export function buildContinuousUseCampaignRewardInput(input: {
  campaignId: string;
  userId: string;
  generationType: 'image' | 'video';
  generationId: string;
  currentStreak: number;
  cycleKey: string;
}): CampaignRewardRequestInput {
  return {
    userId: input.userId,
    triggerKey: `${input.cycleKey}:${input.campaignId}`,
    triggerEventId: input.generationId,
    metadata: {
      generationType: input.generationType,
      generationId: input.generationId,
      currentStreak: input.currentStreak,
    },
  };
}

export function resolveFeedbackId(input: CampaignFeedbackInput): string {
  return String(input.feedbackId ?? input.generationId ?? '').trim();
}

export function buildFeedbackCampaignRewardInput(
  userId: string,
  campaignId: string,
  feedbackId: string,
  input: CampaignFeedbackInput,
): CampaignRewardRequestInput {
  return {
    userId,
    triggerKey: `feedback:${userId}:${feedbackId}:${campaignId}`,
    triggerEventId: feedbackId,
    metadata: {
      ...(input.metadata ?? {}),
      feedbackId,
      generationId: input.generationId ?? null,
      generationType: input.generationType ?? null,
      rating: input.rating ?? null,
      tags: normalizeTags(input.tags),
      text: input.text?.trim() ? input.text.trim().slice(0, 1000) : null,
    },
  };
}

export function presentFeedbackRecordResult<TReward>(
  campaignCount: number,
  rewards: TReward[],
) {
  return {
    status: campaignCount > 0 ? ('recorded' as const) : ('no_active_campaign' as const),
    rewards,
  };
}

export function buildInitialSuccessfulGenerationStreakData(
  userId: string,
  today: Date,
): Prisma.user_activity_streaksUncheckedCreateInput {
  return {
    userId,
    streakType: SUCCESSFUL_GENERATION_STREAK,
    currentStreak: 1,
    longestStreak: 1,
    lastActiveDate: today,
  };
}

export function buildSuccessfulGenerationStreakUpdateData(
  existing: SuccessfulGenerationStreakRecord,
  today: Date,
): Prisma.user_activity_streaksUncheckedUpdateInput | null {
  const last = existing.lastActiveDate ? startOfDay(existing.lastActiveDate) : null;
  if (last && last.getTime() === today.getTime()) return null;

  const yesterday = addDays(today, -1);
  const currentStreak =
    last && last.getTime() === yesterday.getTime()
      ? existing.currentStreak + 1
      : 1;

  return {
    currentStreak,
    longestStreak: Math.max(existing.longestStreak, currentStreak),
    lastActiveDate: today,
    rewardedAtCycle: currentStreak === 1 ? null : existing.rewardedAtCycle,
  };
}

export function buildCampaignRewardCreateData(
  campaignId: string,
  input: CampaignRewardRequestInput,
  points: number,
): Prisma.campaign_rewardsUncheckedCreateInput {
  return {
    campaignId,
    userId: input.userId,
    triggerKey: input.triggerKey,
    triggerEventId: input.triggerEventId ?? null,
    pointsGranted: points,
    metadata: toJson(input.metadata ?? {}),
  };
}

export function resolveRemainingCampaignBudget(
  campaign: { totalBudget: number | null },
  points: number,
): number | null {
  return campaign.totalBudget != null ? campaign.totalBudget - points : null;
}

export function buildCampaignPointGrantInput(
  campaign: CampaignRewardGrantCampaign,
  input: CampaignRewardRequestInput,
  points: number,
  now = new Date(),
) {
  const expiresAt =
    campaign.rewardExpiresInDays > 0
      ? addDays(now, campaign.rewardExpiresInDays)
      : null;
  const usageScope =
    campaign.rewardUsageScope ??
    (campaign.rewardGrantType === PointGrantType.GIFT
      ? DEFAULT_REWARD_USAGE_SCOPE
      : undefined);

  return {
    amount: points,
    grantType: campaign.rewardGrantType,
    sourceEvent: campaign.rewardSourceEvent,
    source: PointsSource.CAMPAIGN,
    sourceId: campaign.id,
    expiresAt,
    usageScope: usageScope as Prisma.InputJsonValue | undefined,
    metadata: toJson({
      campaignId: campaign.id,
      campaignCode: campaign.code,
      triggerKey: input.triggerKey,
      ...(input.metadata ?? {}),
    }),
    remark: `活动奖励：${campaign.name}`,
  };
}

export function presentDuplicateCampaignReward<TReward>(reward: TReward) {
  return { status: 'duplicate' as const, reward };
}

export function presentGrantedCampaignReward<TReward, TGrant>(
  reward: TReward,
  grant: TGrant,
) {
  return { status: 'granted' as const, reward, grant };
}

export function isUniqueConstraintError(err: unknown): boolean {
  return (err as { code?: string }).code === 'P2002';
}

export function resolveRewardPoints(expression: unknown): number {
  if (typeof expression === 'number') return positiveInt(expression, 0);
  if (typeof expression === 'string') return positiveInt(Number(expression), 0);
  if (expression && typeof expression === 'object') {
    const obj = expression as Record<string, unknown>;
    return positiveInt(
      Number(obj.fixed ?? obj.amount ?? obj.points ?? 0),
      0,
    );
  }
  return 0;
}

export function isEffectiveFeedback(input: FeedbackEffectivenessInput): boolean {
  const rating = Number(input.rating);
  if (Number.isFinite(rating) && rating >= 1 && rating <= 5) return true;
  if (normalizeTags(input.tags).length > 0) return true;
  return Boolean(input.text?.trim() && input.text.trim().length >= 3);
}

export function normalizeTags(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function positiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function rewardExpression(input: CampaignUpsertInput): Prisma.InputJsonValue {
  if (input.rewardPointsExpression !== undefined) {
    return toJson(input.rewardPointsExpression);
  }
  return { fixed: positiveInt(input.rewardPoints, 0) };
}

function enumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  fallback: T[keyof T],
): T[keyof T] {
  if (typeof value === 'string' && Object.values(enumObject).includes(value)) {
    return value as T[keyof T];
  }
  return fallback;
}

function optionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function toJsonOrNull(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value == null || value === '') return Prisma.JsonNull;
  return toJson(value);
}

function toJsonOrDefault(value: unknown, fallback: unknown): Prisma.InputJsonValue {
  if (value == null || value === '') return toJson(fallback);
  return toJson(value);
}
