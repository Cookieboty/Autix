import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  CampaignStatus,
  CampaignType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
} from '../../platform/prisma/generated';
import { CampaignRepository } from './campaign.repository';
import { CampaignRewardService } from './campaign-reward.service';
import { buildContinuousUseCycleKey } from './campaign-reward.helpers';

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
  claimedRewards?: Record<string, unknown>[];
  budgetUpdateCount?: number;
  generationOwned?: boolean;
} = {}) {
  const campaign = overrides.campaign === undefined ? makeCampaign() : overrides.campaign;
  const generationOwned = overrides.generationOwned ?? true;
  const queryRaw = vi.fn(async () => []);
  const tx: any = {
    $queryRaw: queryRaw,
    campaigns: {
      findUnique: vi.fn(async () => campaign),
      updateMany: vi.fn(async () => ({ count: overrides.budgetUpdateCount ?? 1 })),
    },
    campaign_rewards: {
      findUnique: vi.fn(async () => overrides.existingReward ?? null),
      create: vi.fn(async (args: any) => ({
        id: 'reward-1',
        ...args.data,
        grantedAt: new Date(),
      })),
      update: vi.fn(async (args: any) => ({
        id: args.where.id,
        campaignId: 'campaign-1',
        userId: 'user-1',
        triggerKey: 'trigger-1',
        pointsGranted: 50,
        pointGrantId: args.data.pointGrantId,
        grantedAt: new Date(),
      })),
      aggregate: vi.fn(async () => ({ _sum: { pointsGranted: 0 } })),
    },
  };
  const ownedCount = vi.fn(async () => (generationOwned ? 1 : 0));
  const prisma = {
    $transaction: vi.fn(async (cb: any) => cb(tx)),
    campaigns: {
      findMany: vi.fn(async () => (campaign ? [campaign] : [])),
      findUnique: vi.fn(async () => campaign),
      upsert: vi.fn(async (args: any) => ({ id: args.create.code, ...args.create })),
    },
    campaign_rewards: {
      findFirst: vi.fn(async () => overrides.existingReward ?? null),
      findMany: vi.fn(async () => overrides.claimedRewards ?? []),
    },
    image_generations: { count: ownedCount },
    video_generations: { count: ownedCount },
    video_clip_generations: { count: ownedCount },
  };
  const pointsService = {
    grantPointsWithinTx: vi.fn(async () => ({ grant: { id: 'grant-1' } })),
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
    // FIX-12: the campaign row is locked (FOR UPDATE) to serialize concurrent grants.
    expect(tx.$queryRaw).toHaveBeenCalled();
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

  it('FIX-14: rejects feedback referencing a generation not owned by the user', async () => {
    const { service, prisma, pointsService } = makeService({
      campaign: makeCampaign({ type: CampaignType.FEEDBACK }),
      generationOwned: false,
    });

    await expect(
      service.recordFeedback('user-1', {
        generationId: 'gen-not-mine',
        generationType: 'image',
        rating: 5,
        tags: ['useful'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.campaigns.findMany).not.toHaveBeenCalled();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
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

  it('grants dynamic AUTO_EVENT feedback campaigns configured with triggerKind', async () => {
    const { service, pointsService, tx } = makeService({
      campaign: makeCampaign({
        type: CampaignType.CUSTOM,
        code: 'dynamic-feedback-bonus',
        name: '动态反馈奖励',
        rewardPointsExpression: { fixed: 6 },
        metadata: {
          claimMode: 'AUTO_EVENT',
          triggerKind: 'FEEDBACK_SUBMITTED',
        },
      }),
    });

    const result = await service.recordFeedback('user-1', {
      feedbackId: 'feedback-1',
      generationId: 'generation-1',
      generationType: 'image',
      text: 'useful feedback',
    });

    expect(result.status).toBe('recorded');
    expect(tx.campaign_rewards.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggerKey: 'feedback:user-1:feedback-1:campaign-1',
          pointsGranted: 6,
        }),
      }),
    );
    expect(pointsService.grantPointsWithinTx).toHaveBeenCalledWith(
      tx,
      'user-1',
      expect.objectContaining({
        sourceId: 'feedback:user-1:feedback-1:campaign-1',
      }),
    );
  });

  it('uses per-feedback point grant source ids for repeatable dynamic rewards', async () => {
    const { service, pointsService } = makeService({
      campaign: makeCampaign({
        type: CampaignType.CUSTOM,
        code: 'repeatable-feedback-bonus',
        rewardPointsExpression: { fixed: 6 },
        metadata: {
          claimMode: 'AUTO_EVENT',
          triggerKind: 'FEEDBACK_SUBMITTED',
        },
      }),
    });

    await service.recordFeedback('user-1', {
      feedbackId: 'feedback-1',
      generationId: 'generation-1',
      rating: 5,
    });
    await service.recordFeedback('user-1', {
      feedbackId: 'feedback-2',
      generationId: 'generation-2',
      rating: 5,
    });

    expect(pointsService.grantPointsWithinTx).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'user-1',
      expect.objectContaining({ sourceId: 'feedback:user-1:feedback-1:campaign-1' }),
    );
    expect(pointsService.grantPointsWithinTx).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'user-1',
      expect.objectContaining({ sourceId: 'feedback:user-1:feedback-2:campaign-1' }),
    );
  });

  it('rejects unsupported dynamic event trigger kinds', async () => {
    const { service } = makeService();

    await expect(
      service.recordEvent('user-1', { triggerKind: 'FRONTEND_CLICK' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects dynamic streak events for generations not owned by the user', async () => {
    const { service } = makeService({ generationOwned: false });

    await expect(
      service.recordEvent('user-1', {
        triggerKind: 'SUCCESSFUL_GENERATION_STREAK',
        triggerEventId: 'generation-1',
        sourceRef: {
          currentStreak: 7,
          cycleKey: buildContinuousUseCycleKey('user-1', 7),
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects dynamic streak events with forged cycle keys', async () => {
    const { service } = makeService({ generationOwned: true });

    await expect(
      service.recordEvent('user-1', {
        triggerKind: 'SUCCESSFUL_GENERATION_STREAK',
        triggerEventId: 'generation-1',
        sourceRef: {
          currentStreak: 7,
          cycleKey: 'continuous_use:user-1:forged:7',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CampaignRewardService home starter quests', () => {
  const questCampaign = makeCampaign({
    type: CampaignType.QUEST,
    code: 'HOME_QUEST_NANO_BANANA_PRO',
    name: '首页任务：Nano Banana Pro',
    rewardPointsExpression: { fixed: 50 },
    metadata: {
      fixed: true,
      builtin: true,
      completionKind: 'IMAGE_GENERATION_MODEL',
      modelMatchers: ['nano-banana-pro'],
      titleI18nKey: 'onboardTryModel',
      subtitleI18nKey: 'onboardSubBestImage',
      ctaI18nKey: 'onboardCtaTry',
      modelLabel: 'Nano Banana Pro',
      hrefPath: '/workbench/image',
      sortOrder: 1,
    },
  });

  it('lists anonymous home starter tasks as locked when enabled', async () => {
    const { service } = makeService({ campaign: questCampaign });

    const result = await service.listHomeStarterTasks();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        code: 'HOME_QUEST_NANO_BANANA_PRO',
        points: 50,
        status: 'LOCKED',
        completed: false,
      }),
    );
    expect(result.summary.availablePoints).toBe(50);
  });

  it('self-heals fixed campaigns before admin campaigns are listed', async () => {
    const { service, prisma } = makeService({ campaign: questCampaign });

    await service.listAdminCampaigns();

    expect(prisma.campaigns.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'INVITATION_REWARD' },
      }),
    );
  });

  it('marks a completed unclaimed home starter task as claimable', async () => {
    const { service } = makeService({ campaign: questCampaign, generationOwned: true });

    const result = await service.listHomeStarterTasks('user-1');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'CLAIMABLE',
        completed: true,
      }),
    );
  });

  it('requires generated image output before marking image quests complete', async () => {
    const { service, prisma } = makeService({
      campaign: questCampaign,
      generationOwned: true,
    });

    await service.listHomeStarterTasks('user-1');

    expect(prisma.image_generations.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        generatedImages: { isEmpty: false },
      }),
    });
  });

  it('disables active home starter quests with unsupported completion kinds', async () => {
    const { service } = makeService({
      campaign: makeCampaign({
        type: CampaignType.QUEST,
        code: 'HOME_QUEST_MARKETING',
        name: '首页任务：Marketing Studio',
        rewardPointsExpression: { fixed: 20 },
        metadata: {
          fixed: true,
          builtin: true,
          completionKind: 'MARKETING_WORKFLOW',
        },
      }),
      generationOwned: true,
    });

    const result = await service.listHomeStarterTasks('user-1');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'DISABLED',
        completed: false,
      }),
    );
    expect(result.summary.availablePoints).toBe(0);
  });

  it('claims a completed quest with a quest-scoped point grant source id', async () => {
    const { service, pointsService, tx } = makeService({
      campaign: questCampaign,
      generationOwned: true,
    });

    const result = await service.claimHomeStarterTask('HOME_QUEST_NANO_BANANA_PRO', 'user-1');

    expect(result.status).toBe('granted');
    expect(tx.campaign_rewards.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: 'campaign-1',
          userId: 'user-1',
          triggerKey: 'quest:HOME_QUEST_NANO_BANANA_PRO:user-1',
          triggerEventId: 'HOME_QUEST_NANO_BANANA_PRO',
          pointsGranted: 50,
        }),
      }),
    );
    expect(pointsService.grantPointsWithinTx).toHaveBeenCalledWith(
      tx,
      'user-1',
      expect.objectContaining({
        sourceId: 'quest:HOME_QUEST_NANO_BANANA_PRO:user-1',
      }),
    );
  });

  it('rejects quest claim before the completion condition is met', async () => {
    const { service, pointsService } = makeService({
      campaign: questCampaign,
      generationOwned: false,
    });

    await expect(
      service.claimHomeStarterTask('HOME_QUEST_NANO_BANANA_PRO', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('returns claimed without granting again for an existing quest reward', async () => {
    const existingReward = {
      id: 'reward-existing',
      campaignId: 'campaign-1',
      userId: 'user-1',
      triggerKey: 'quest:HOME_QUEST_NANO_BANANA_PRO:user-1',
      pointsGranted: 50,
    };
    const { service, pointsService } = makeService({
      campaign: questCampaign,
      existingReward,
      claimedRewards: [existingReward],
      generationOwned: false,
    });

    const result = await service.claimHomeStarterTask('HOME_QUEST_NANO_BANANA_PRO', 'user-1');

    expect(result.status).toBe('claimed');
    expect(result.task).toEqual(expect.objectContaining({ status: 'CLAIMED' }));
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });
});
