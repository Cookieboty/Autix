import { BadRequestException } from '@nestjs/common';
import {
  CampaignStatus,
  CampaignType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
} from '../../platform/prisma/generated';
import {
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
  normalizeTags,
  presentDuplicateCampaignReward,
  presentFeedbackRecordResult,
  presentGrantedCampaignReward,
  resolveFeedbackId,
  resolveRemainingCampaignBudget,
  resolveRewardPoints,
  shouldRewardSuccessfulGenerationStreak,
} from './campaign-reward.helpers';

describe('campaign reward helpers', () => {
  it('checks campaign grant status windows', () => {
    const now = new Date('2026-06-14T00:00:00.000Z').getTime();

    expect(() =>
      assertCampaignCanGrant(
        {
          status: CampaignStatus.ACTIVE,
          startsAt: new Date('2026-06-01T00:00:00.000Z'),
          endsAt: new Date('2026-06-30T00:00:00.000Z'),
        },
        now,
      ),
    ).not.toThrow();
    expect(() =>
      assertCampaignCanGrant(
        { status: CampaignStatus.DRAFT, startsAt: null, endsAt: null },
        now,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertCampaignCanGrant(
        {
          status: CampaignStatus.ACTIVE,
          startsAt: new Date('2026-06-15T00:00:00.000Z'),
          endsAt: null,
        },
        now,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertCampaignCanGrant(
        {
          status: CampaignStatus.ACTIVE,
          startsAt: null,
          endsAt: new Date('2026-06-13T00:00:00.000Z'),
        },
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('detects budget and per-user cap overflow without blocking exact-cap grants', () => {
    expect(isRewardCapExceeded(90, 10, 100)).toBe(false);
    expect(isRewardCapExceeded(91, 10, 100)).toBe(true);
    expect(isRewardCapExceeded(null, 10, null)).toBe(false);
  });

  it('resolves fixed reward points from supported expression shapes', () => {
    expect(resolveRewardPoints(8.9)).toBe(8);
    expect(resolveRewardPoints('12')).toBe(12);
    expect(resolveRewardPoints({ fixed: 50 })).toBe(50);
    expect(resolveRewardPoints({ amount: 7 })).toBe(7);
    expect(resolveRewardPoints({ points: 3 })).toBe(3);
    expect(resolveRewardPoints({ fixed: -1 })).toBe(0);
  });

  it('treats rating, tags, or meaningful text as effective feedback', () => {
    expect(isEffectiveFeedback({ rating: 5 })).toBe(true);
    expect(isEffectiveFeedback({ tags: [' useful '] })).toBe(true);
    expect(isEffectiveFeedback({ text: '不错了' })).toBe(true);
    expect(isEffectiveFeedback({ rating: 0, tags: [], text: 'ok' })).toBe(false);
  });

  it('normalizes tags by trimming blanks and limiting stored values', () => {
    expect(
      normalizeTags(['  a ', '', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']),
    ).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
  });

  it('builds create campaign payloads with the existing defaults', () => {
    const data = buildCampaignCreateData({
      code: ' welcome ',
      name: ' 新手活动 ',
      type: CampaignType.FEEDBACK,
      status: CampaignStatus.ACTIVE,
      startsAt: '2026-06-01T00:00:00.000Z',
      endsAt: '',
      dailyBudget: 10.8,
      totalBudget: 'bad' as unknown as number,
      rewardPoints: 8.9,
      metadata: { source: 'admin' },
    });

    expect(data).toEqual(
      expect.objectContaining({
        code: 'welcome',
        name: '新手活动',
        type: CampaignType.FEEDBACK,
        status: CampaignStatus.ACTIVE,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: null,
        dailyBudget: 10,
        totalBudget: null,
        rewardGrantType: PointGrantType.GIFT,
        rewardSourceEvent: PointLedgerEventType.campaign_bonus,
        rewardPointsExpression: { fixed: 8 },
        rewardExpiresInDays: 7,
        rewardUsageScope: { excludedTaskPrefixes: ['seedance_'] },
        metadata: { source: 'admin' },
      }),
    );
  });

  it('builds sparse update campaign payloads without touching omitted fields', () => {
    expect(
      buildCampaignUpdateData({
        code: ' daily ',
        totalBudget: null,
        rewardPointsExpression: { fixed: 30 },
        rewardUsageScope: '',
      }),
    ).toEqual({
      code: 'daily',
      totalBudget: null,
      rewardPointsExpression: { fixed: 30 },
      rewardUsageScope: expect.any(Object),
    });
  });

  it('builds manual reward trigger payloads', () => {
    expect(buildManualCampaignRewardInput('user-1', 'admin-1', 123456)).toEqual({
      userId: 'user-1',
      triggerKey: 'manual:user-1:123456',
      triggerEventId: 'admin-1',
      metadata: { source: 'manual_admin_grant', actorId: 'admin-1' },
    });
  });

  it('decides and builds continuous-use reward payloads by seven-day cycles', () => {
    expect(shouldRewardSuccessfulGenerationStreak(6)).toBe(false);
    expect(shouldRewardSuccessfulGenerationStreak(7)).toBe(true);
    const cycleKey = buildContinuousUseCycleKey(
      'user-1',
      7,
      new Date(2026, 5, 14, 12),
    );

    expect(cycleKey).toMatch(/^continuous_use:user-1:\d{4}-\d{2}-\d{2}:7$/);
    expect(
      buildContinuousUseCampaignRewardInput({
        campaignId: 'campaign-1',
        userId: 'user-1',
        generationType: 'image',
        generationId: 'generation-1',
        currentStreak: 7,
        cycleKey,
      }),
    ).toEqual({
      userId: 'user-1',
      triggerKey: `${cycleKey}:campaign-1`,
      triggerEventId: 'generation-1',
      metadata: {
        generationType: 'image',
        generationId: 'generation-1',
        currentStreak: 7,
      },
    });
  });

  it('normalizes feedback reward payloads without changing trigger semantics', () => {
    const longText = ` ${'a'.repeat(1005)} `;
    const input = {
      feedbackId: ' feedback-1 ',
      generationId: 'generation-1',
      generationType: 'video',
      rating: 4,
      tags: [' useful ', '', 'fast'],
      text: longText,
      metadata: { channel: 'modal', feedbackId: 'overwritten' },
    };
    const feedbackId = resolveFeedbackId(input);

    expect(feedbackId).toBe('feedback-1');
    expect(buildFeedbackCampaignRewardInput('user-1', 'campaign-1', feedbackId, input)).toEqual({
      userId: 'user-1',
      triggerKey: 'feedback:user-1:feedback-1:campaign-1',
      triggerEventId: 'feedback-1',
      metadata: {
        channel: 'modal',
        feedbackId: 'feedback-1',
        generationId: 'generation-1',
        generationType: 'video',
        rating: 4,
        tags: ['useful', 'fast'],
        text: 'a'.repeat(1000),
      },
    });
  });

  it('builds successful generation streak create and update payloads', () => {
    const today = new Date(2026, 5, 14);

    expect(buildInitialSuccessfulGenerationStreakData('user-1', today)).toEqual({
      userId: 'user-1',
      streakType: 'successful_generation',
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: today,
    });
    expect(
      buildSuccessfulGenerationStreakUpdateData(
        {
          currentStreak: 2,
          longestStreak: 5,
          lastActiveDate: new Date(2026, 5, 13, 10),
          rewardedAtCycle: 'cycle-1',
        },
        today,
      ),
    ).toEqual({
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: today,
      rewardedAtCycle: 'cycle-1',
    });
    expect(
      buildSuccessfulGenerationStreakUpdateData(
        {
          currentStreak: 2,
          longestStreak: 5,
          lastActiveDate: new Date(2026, 5, 14, 10),
          rewardedAtCycle: 'cycle-1',
        },
        today,
      ),
    ).toBeNull();
  });

  it('builds reward creation and point grant payloads', () => {
    const rewardInput = {
      userId: 'user-1',
      triggerKey: 'trigger-1',
      triggerEventId: 'event-1',
      metadata: { foo: 'bar' },
    };
    const campaign = {
      id: 'campaign-1',
      code: 'weekly',
      name: '连续使用奖励',
      totalBudget: 100,
      rewardGrantType: PointGrantType.GIFT,
      rewardSourceEvent: PointLedgerEventType.campaign_bonus,
      rewardExpiresInDays: 7,
      rewardUsageScope: null,
    };

    expect(buildCampaignRewardCreateData('campaign-1', rewardInput, 50)).toEqual({
      campaignId: 'campaign-1',
      userId: 'user-1',
      triggerKey: 'trigger-1',
      triggerEventId: 'event-1',
      pointsGranted: 50,
      metadata: { foo: 'bar' },
    });
    expect(resolveRemainingCampaignBudget(campaign, 50)).toBe(50);
    expect(
      buildCampaignPointGrantInput(
        campaign,
        rewardInput,
        50,
        new Date('2026-06-14T00:00:00.000Z'),
      ),
    ).toEqual({
      amount: 50,
      grantType: PointGrantType.GIFT,
      sourceEvent: PointLedgerEventType.campaign_bonus,
      source: PointsSource.CAMPAIGN,
      sourceId: 'campaign-1',
      expiresAt: new Date('2026-06-21T00:00:00.000Z'),
      usageScope: { excludedTaskPrefixes: ['seedance_'] },
      metadata: {
        campaignId: 'campaign-1',
        campaignCode: 'weekly',
        triggerKey: 'trigger-1',
        foo: 'bar',
      },
      remark: '活动奖励：连续使用奖励',
    });
  });

  it('presents reward outcomes and unique constraint checks', () => {
    expect(presentFeedbackRecordResult(0, [])).toEqual({
      status: 'no_active_campaign',
      rewards: [],
    });
    expect(presentDuplicateCampaignReward({ id: 'reward-1' })).toEqual({
      status: 'duplicate',
      reward: { id: 'reward-1' },
    });
    expect(presentGrantedCampaignReward({ id: 'reward-1' }, { id: 'grant-1' })).toEqual({
      status: 'granted',
      reward: { id: 'reward-1' },
      grant: { id: 'grant-1' },
    });
    expect(isUniqueConstraintError({ code: 'P2002' })).toBe(true);
    expect(isUniqueConstraintError({ code: 'P2025' })).toBe(false);
  });
});
