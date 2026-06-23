import { BadRequestException } from '@nestjs/common';
import {
  CampaignStatus,
  CampaignType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
} from '../../platform/prisma/generated';
import { CampaignRepository } from './campaign.repository';
import { CampaignRewardService } from './campaign-reward.service';

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'campaign-1',
    code: 'weekly-streak',
    name: '连续使用奖励',
    description: null,
    type: CampaignType.CONTINUOUS_USE,
    status: CampaignStatus.ACTIVE,
    startsAt: null,
    endsAt: null,
    dailyBudget: null,
    totalBudget: 1000,
    usedBudget: 0,
    perUserDailyCap: null,
    perUserTotalCap: null,
    rewardGrantType: PointGrantType.GIFT,
    rewardSourceEvent: PointLedgerEventType.campaign_bonus,
    rewardPointsExpression: { fixed: 50 },
    rewardExpiresInDays: 7,
    rewardUsageScope: null,
    eligibility: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(overrides: {
  campaign?: Record<string, unknown> | null;
  existingReward?: Record<string, unknown> | null;
  budgetUpdateCount?: number;
} = {}) {
  const campaign = overrides.campaign === undefined ? makeCampaign() : overrides.campaign;
  const tx = {
    campaigns: {
      findUnique: jest.fn(async () => campaign),
      updateMany: jest.fn(async () => ({ count: overrides.budgetUpdateCount ?? 1 })),
    },
    campaign_rewards: {
      findUnique: jest.fn(async () => overrides.existingReward ?? null),
      create: jest.fn(async (args: any) => ({
        id: 'reward-1',
        ...args.data,
        grantedAt: new Date(),
      })),
      update: jest.fn(async (args: any) => ({
        id: args.where.id,
        campaignId: 'campaign-1',
        userId: 'user-1',
        triggerKey: 'trigger-1',
        pointsGranted: 50,
        pointGrantId: args.data.pointGrantId,
        grantedAt: new Date(),
      })),
      aggregate: jest.fn(async () => ({ _sum: { pointsGranted: 0 } })),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    campaigns: {
      findMany: jest.fn(async () => (campaign ? [campaign] : [])),
    },
    campaign_rewards: {
      findFirst: jest.fn(),
    },
  };
  const pointsService = {
    grantPointsWithinTx: jest.fn(async () => ({ grant: { id: 'grant-1' } })),
  };
  const service = new CampaignRewardService(
    new CampaignRepository(prisma as never),
    pointsService as never,
  );
  return { service, prisma, pointsService, tx };
}

describe('CampaignRewardService.grantCampaignReward', () => {
  it('grants GIFT campaign points with default usage scope excluding seedance tasks', async () => {
    const { service, pointsService, tx } = makeService();

    const result = await service.grantCampaignReward('campaign-1', {
      userId: 'user-1',
      triggerKey: 'trigger-1',
      triggerEventId: 'generation-1',
    });

    expect(result.status).toBe('granted');
    expect(tx.campaign_rewards.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: 'campaign-1',
          triggerKey: 'trigger-1',
          pointsGranted: 50,
        }),
      }),
    );
    expect(pointsService.grantPointsWithinTx).toHaveBeenCalledWith(
      tx,
      'user-1',
      expect.objectContaining({
        amount: 50,
        grantType: PointGrantType.GIFT,
        sourceEvent: PointLedgerEventType.campaign_bonus,
        source: PointsSource.CAMPAIGN,
        sourceId: 'campaign-1',
        usageScope: { excludedTaskTypes: ['video_generation'] },
      }),
    );
  });

  it('returns duplicate without granting points again when triggerKey already exists', async () => {
    const existingReward = {
      id: 'reward-existing',
      campaignId: 'campaign-1',
      userId: 'user-1',
      triggerKey: 'trigger-1',
      pointsGranted: 50,
    };
    const { service, pointsService, tx } = makeService({ existingReward });

    const result = await service.grantCampaignReward('campaign-1', {
      userId: 'user-1',
      triggerKey: 'trigger-1',
    });

    expect(result.status).toBe('duplicate');
    expect(tx.campaign_rewards.create).not.toHaveBeenCalled();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('blocks grants when the guarded total budget update fails', async () => {
    const { service, pointsService } = makeService({ budgetUpdateCount: 0 });

    await expect(
      service.grantCampaignReward('campaign-1', {
        userId: 'user-1',
        triggerKey: 'trigger-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });
});

describe('CampaignRewardService.recordFeedback', () => {
  it('rejects feedback without rating, tags, or text', async () => {
    const { service, prisma } = makeService({
      campaign: makeCampaign({ type: CampaignType.FEEDBACK }),
    });

    await expect(
      service.recordFeedback('user-1', { feedbackId: 'feedback-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.campaigns.findMany).not.toHaveBeenCalled();
  });

  it('grants active feedback campaign rewards idempotently by feedback event', async () => {
    const { service, pointsService, tx } = makeService({
      campaign: makeCampaign({
        type: CampaignType.FEEDBACK,
        code: 'feedback-bonus',
        name: '评价反馈奖励',
        rewardPointsExpression: { fixed: 8 },
      }),
    });

    const result = await service.recordFeedback('user-1', {
      feedbackId: 'feedback-1',
      generationId: 'generation-1',
      generationType: 'image',
      rating: 5,
      tags: ['useful'],
    });

    expect(result.status).toBe('recorded');
    expect(tx.campaign_rewards.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: 'campaign-1',
          userId: 'user-1',
          triggerKey: 'feedback:user-1:feedback-1:campaign-1',
          triggerEventId: 'feedback-1',
          pointsGranted: 8,
        }),
      }),
    );
    expect(pointsService.grantPointsWithinTx).toHaveBeenCalledWith(
      tx,
      'user-1',
      expect.objectContaining({
        amount: 8,
        grantType: PointGrantType.GIFT,
        sourceEvent: PointLedgerEventType.campaign_bonus,
        source: PointsSource.CAMPAIGN,
        usageScope: { excludedTaskTypes: ['video_generation'] },
      }),
    );
  });
});
