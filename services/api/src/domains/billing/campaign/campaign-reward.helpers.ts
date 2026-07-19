import { HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import {
  CampaignStatus,
  CampaignType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../../platform/prisma/generated';

export const DEFAULT_REWARD_USAGE_SCOPE = {
  excludedTaskTypes: ['video_generation'],
} as const;

export const SUCCESSFUL_GENERATION_STREAK = 'successful_generation';

/** 首页任务 code 前缀 —— 列表(repo)与领取(service)必须用同一判定，避免漂移。 */
export const HOME_QUEST_CODE_PREFIX = 'HOME_QUEST_';

export const BUILTIN_CAMPAIGN_CODES = [
  'INVITATION_REWARD',
  'REGISTRATION_BONUS',
  'HOME_QUEST_NANO_BANANA_PRO',
  'HOME_QUEST_SEEDANCE',
  'HOME_QUEST_MARKETING',
] as const;

export type FixedCampaignDefinition = {
  code: string;
  name: string;
  description: string;
  type: CampaignType;
  status: CampaignStatus;
  rewardPoints: number;
  rewardExpiresInDays: number;
  metadata: Prisma.InputJsonValue;
  rewardUsageScope?: Prisma.InputJsonValue | null;
};

export const FIXED_CAMPAIGN_DEFINITIONS: readonly FixedCampaignDefinition[] = [
  {
    code: 'INVITATION_REWARD',
    name: '邀请奖励',
    description: '邀请好友注册并完成激活后发放奖励。',
    type: CampaignType.INVITATION,
    status: CampaignStatus.ACTIVE,
    rewardPoints: 100,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      maxRewardedInvitesPerInviter: 50,
      velocityThreshold: 20,
    },
  },
  {
    code: 'REGISTRATION_BONUS',
    name: '注册奖励',
    description: '新用户完成注册后发放的欢迎奖励，默认关闭。',
    type: CampaignType.REGISTRATION,
    status: CampaignStatus.PAUSED,
    rewardPoints: 0,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      grantOn: ['email_activation', 'oauth_first_login'],
      onlyFirstRegistration: true,
    },
  },
  {
    code: 'HOME_QUEST_NANO_BANANA_PRO',
    name: '首页任务：Nano Banana Pro',
    description: '完成 Nano Banana Pro 图片生成后领取奖励。',
    type: CampaignType.QUEST,
    status: CampaignStatus.ACTIVE,
    rewardPoints: 50,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      questCode: 'HOME_QUEST_NANO_BANANA_PRO',
      completionKind: 'IMAGE_GENERATION_MODEL',
      modelMatchers: ['nano-banana-pro'],
      titleI18nKey: 'onboardTryModel',
      subtitleI18nKey: 'onboardSubBestImage',
      ctaI18nKey: 'onboardCtaTry',
      modelLabel: 'Nano Banana Pro',
      hrefPath: '/workbench/image',
      sortOrder: 1,
    },
  },
  {
    code: 'HOME_QUEST_SEEDANCE',
    name: '首页任务：Seedance',
    description: '完成 Seedance 视频生成后领取奖励。',
    type: CampaignType.QUEST,
    status: CampaignStatus.ACTIVE,
    rewardPoints: 80,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      questCode: 'HOME_QUEST_SEEDANCE',
      completionKind: 'VIDEO_GENERATION_MODEL',
      modelMatchers: ['seedance'],
      titleI18nKey: 'onboardExploreModel',
      subtitleI18nKey: 'onboardSubBestVideo',
      ctaI18nKey: 'onboardCtaExplore',
      modelLabel: 'Seedance 2.0',
      hrefPath: '/workbench/video',
      sortOrder: 2,
    },
  },
  {
    code: 'HOME_QUEST_MARKETING',
    name: '首页任务：Marketing Studio',
    description: '营销创作工作流恢复后可启用此任务。',
    type: CampaignType.QUEST,
    status: CampaignStatus.PAUSED,
    rewardPoints: 20,
    rewardExpiresInDays: 7,
    metadata: {
      fixed: true,
      builtin: true,
      questCode: 'HOME_QUEST_MARKETING',
      completionKind: 'MARKETING_WORKFLOW',
      titleI18nKey: 'onboardExploreModel',
      subtitleI18nKey: 'onboardSubPromptCampaign',
      ctaI18nKey: 'onboardCtaExplore',
      modelLabel: 'Marketing Studio',
      hrefPath: '/marketing-studio',
      sortOrder: 3,
    },
  },
];

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
  pointGrantSourceId?: string | null;
  pointGrantSource?: PointsSource;
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
    throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'campaign.not_enabled');
  }
  if (campaign.startsAt && campaign.startsAt.getTime() > nowMs) {
    throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'campaign.not_started');
  }
  if (campaign.endsAt && campaign.endsAt.getTime() < nowMs) {
    throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'campaign.ended');
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

export function isBuiltinCampaignCode(code?: string | null): boolean {
  const normalized = String(code ?? '').trim();
  return (
    BUILTIN_CAMPAIGN_CODES.includes(normalized as (typeof BUILTIN_CAMPAIGN_CODES)[number]) ||
    normalized.startsWith('HOME_QUEST_')
  );
}

export function isBuiltinCampaign(campaign: {
  code: string;
  metadata?: Prisma.JsonValue | null;
}): boolean {
  const metadata = campaign.metadata;
  const metadataRecord =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata as Record<string, unknown>
      : null;
  return (
    isBuiltinCampaignCode(campaign.code) ||
    metadataRecord?.fixed === true ||
    metadataRecord?.builtin === true
  );
}

export function assertBuiltinCampaignUpdateAllowed(
  campaign: {
    code: string;
    type: CampaignType;
    metadata?: Prisma.JsonValue | null;
  },
  input: CampaignUpsertInput,
): void {
  if (!isBuiltinCampaign(campaign)) return;

  if (input.code !== undefined && input.code.trim() !== campaign.code) {
    throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'campaign.fixed_code_immutable');
  }

  if (
    input.type !== undefined &&
    enumValue(CampaignType, input.type, campaign.type) !== campaign.type
  ) {
    throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'campaign.fixed_type_immutable');
  }
}

export function buildManualCampaignRewardInput(
  campaignId: string,
  userId: string,
  actorId?: string,
): CampaignRewardRequestInput {
  return {
    userId,
    // FIX-15: 幂等键确定（每活动每用户一次），重试/双击经 campaignId+triggerKey 唯一约束去重，
    // 不再用 manual:${userId}:${nowMs} 这种含时间戳、永不命中去重的 key。
    triggerKey: `manual:${campaignId}:${userId}`,
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
  const triggerKey = `${input.cycleKey}:${input.campaignId}`;
  return {
    userId: input.userId,
    triggerKey,
    triggerEventId: input.generationId,
    pointGrantSourceId: triggerKey,
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
  const triggerKey = `feedback:${userId}:${feedbackId}:${campaignId}`;
  return {
    userId,
    triggerKey,
    triggerEventId: feedbackId,
    pointGrantSourceId: triggerKey,
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
  const sourceId = String(input.pointGrantSourceId ?? campaign.id).trim();
  if (!sourceId) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'campaign.source_id_required');

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
    source: input.pointGrantSource ?? PointsSource.CAMPAIGN,
    sourceId,
    expiresAt,
    usageScope: usageScope as Prisma.InputJsonValue | undefined,
    metadata: toJson({
      campaignId: campaign.id,
      campaignCode: campaign.code,
      triggerKey: input.triggerKey,
      pointGrantSourceId: sourceId,
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
