import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { ChatDashboardService } from './chat-dashboard.service';

function makeRepo() {
  return {
    findSystemCodeById: vi.fn().mockResolvedValue('chat'),
    countGalleryPending: vi.fn().mockResolvedValue(1),
    countGalleryPendingReports: vi.fn().mockResolvedValue(2),
    countTemplatePending: vi.fn().mockResolvedValue({ image: 3, video: 4 }),
    countRegistrationPending: vi.fn().mockResolvedValue(5),
    countFlaggedRiskUsers: vi.fn().mockResolvedValue(6),
    countBatchJobsProcessing: vi.fn().mockResolvedValue(7),
    groupGenerationByStatus: vi.fn().mockResolvedValue([
      { status: 'SUCCEEDED', kind: 'IMAGE', count: 8 },
      { status: 'FAILED', kind: 'IMAGE', count: 2 },
      { status: 'PENDING', kind: 'VIDEO', count: 1 },
    ]),
    aggregateGenerationDuration: vi.fn().mockResolvedValue({ avgMs: 1200 }),
    groupGenerationFailureReasons: vi.fn().mockResolvedValue([{ errorStage: 'PROVIDER', errorClass: 'RATE_LIMIT', count: 2 }]),
    groupGenerationTopModels: vi.fn().mockResolvedValue([{ provider: 'openai', model: 'gpt-image', count: 10, succeeded: 8, failed: 2 }]),
    sumGmvByCurrency: vi.fn().mockResolvedValue([{ currency: 'USD', amount: '12.50' }]),
    countPaidOrders: vi.fn().mockResolvedValue(3),
    sumRefundedByCurrency: vi.fn().mockResolvedValue([{ currency: 'USD', amount: '2.50' }]),
    sumPointsConsumed: vi.fn().mockResolvedValue(50),
    groupTopPointsConsumers: vi.fn().mockResolvedValue([
      { userId: 'u2', points: 30 },
      { userId: 'u2', points: 20 },
    ]),
    countPendingOrdersGlobal: vi.fn().mockResolvedValue(4),
    countActiveHoldsGlobal: vi.fn().mockResolvedValue(5),
    findUsersForDisplay: vi.fn().mockResolvedValue([
      { id: 'u2', status: 'ACTIVE', nickname: 'Ada', realName: null, username: 'ada' },
    ]),
    countGalleryPublished: vi.fn().mockResolvedValue({ image: 2, video: 1 }),
    countConversationsCreated: vi.fn().mockResolvedValue(4),
    topGalleryHot: vi.fn().mockResolvedValue([]),
    featuredSlotsCoverage: vi.fn().mockResolvedValue({ activeResourceSlots: 1, enabledResourceSlots: 2 }),
    countActiveBoosts: vi.fn().mockResolvedValue(3),
    countEvaluatedHighRiskUsers: vi.fn().mockResolvedValue(2),
    countRiskEvents: vi.fn().mockResolvedValue(4),
    groupTopRiskEventTypes: vi.fn().mockResolvedValue([{ type: 'AUTO_SCORE', count: 4, avgSeverity: 75 }]),
    bucketRiskEventSeverity: vi.fn().mockResolvedValue([{ bucket: 'D', count: 4 }]),
    listRecentHighSeverityEvents: vi.fn().mockResolvedValue([
      { id: 'e1', userId: 'u2', type: 'AUTO_SCORE', severity: 80, createdAt: new Date('2026-07-29T10:00:00.000Z') },
      { id: 'e2', userId: 'u2', type: 'AUTO_SCORE', severity: 75, createdAt: new Date('2026-07-29T09:00:00.000Z') },
    ]),
    countUsersForRiskDistribution: vi.fn().mockResolvedValue(5),
    groupRiskLevelDistribution: vi.fn().mockResolvedValue({ L1: 1, L2: 1, L3: 1 }),
  };
}

const user = { id: 'u1', currentSystemId: 'chat-id' } as never;

describe('ChatDashboardService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('validates the active Chat system before touching snapshots', async () => {
    const repo = makeRepo();
    const service = new ChatDashboardService(repo as never);
    await expect(service.pendingInbox({ id: 'u1' } as never)).rejects.toMatchObject({ i18nKey: 'auth.system.not_in_chat_system' });
    expect(repo.findSystemCodeById).not.toHaveBeenCalled();
    expect(repo.countGalleryPending).not.toHaveBeenCalled();

    repo.findSystemCodeById.mockResolvedValueOnce('admin-system');
    try {
      await service.pendingInbox(user);
    } catch (error) {
      expect(error).toBeInstanceOf(I18nHttpException);
      expect((error as I18nHttpException).i18nKey).toBe('auth.system.not_in_chat_system');
    }
    expect(repo.countGalleryPending).not.toHaveBeenCalled();
  });

  it('assembles pending inbox from one snapshot and does not double-count template details', async () => {
    const repo = makeRepo();
    const service = new ChatDashboardService(repo as never);
    const result = await service.pendingInbox(user);
    expect(result).toMatchObject({
      galleryPendingCount: 1,
      galleryPendingReportCount: 2,
      templatePendingCount: 7,
      templatePendingImageCount: 3,
      templatePendingVideoCount: 4,
      registrationPendingCount: 5,
      riskFlaggedUserCount: 6,
      batchJobProcessingCount: 7,
    });
    await service.pendingInbox(user);
    expect(repo.countGalleryPending).toHaveBeenCalledTimes(1);
  });

  it('caches preset generation ranges but never caches custom range projections', async () => {
    const repo = makeRepo();
    const service = new ChatDashboardService(repo as never);
    const preset = { tz: 'UTC', window: 'today' } as const;
    const first = await service.generationHealth(user, preset);
    const second = await service.generationHealth(user, preset);
    expect(first.totals).toEqual({ total: 11, active: 1, succeeded: 8, failed: 2, expired: 0 });
    expect(first.successRate).toBe(0.8);
    expect(first.topModels[0]?.failureRate).toBe(0.2);
    expect(second).toEqual(first);
    expect(repo.groupGenerationByStatus).toHaveBeenCalledTimes(2);

    const custom = { tz: 'UTC', window: 'custom', from: '2026-07-20', to: '2026-07-21' } as const;
    await service.generationHealth(user, custom);
    await service.generationHealth(user, custom);
    expect(repo.groupGenerationByStatus).toHaveBeenCalledTimes(6);
  });

  it('propagates projection failures instead of replacing them with zero values', async () => {
    const repo = makeRepo();
    repo.aggregateGenerationDuration.mockRejectedValueOnce(new Error('database unavailable'));
    const service = new ChatDashboardService(repo as never);
    await expect(service.generationHealth(user, { tz: 'UTC', window: 'today' })).rejects.toThrow('database unavailable');
  });

  it('batches Billing display names once and keeps Decimal amounts as strings', async () => {
    const repo = makeRepo();
    const service = new ChatDashboardService(repo as never);
    const result = await service.billingSummary(user, { tz: 'UTC', window: 'today' });

    expect(repo.findUsersForDisplay).toHaveBeenCalledOnce();
    expect(repo.findUsersForDisplay).toHaveBeenCalledWith(['u2']);
    expect(result.gmv).toEqual([{ currency: 'USD', amount: '12.50' }]);
    expect(result.refunded).toEqual([{ currency: 'USD', amount: '2.50' }]);
    expect(result.topPointsConsumers.map((item) => item.displayName)).toEqual(['Ada', 'Ada']);
    expect(result.pendingOrdersCount).toBe(4);
    expect(result.activeHoldsCount).toBe(5);
  });

  it('fills the risk L0 scope and batches recent event display names without N+1 queries', async () => {
    const repo = makeRepo();
    const service = new ChatDashboardService(repo as never);
    const result = await service.riskSignals(user, { tz: 'UTC', window: 'today' });

    expect(result.levelDistribution).toEqual({ L0: 2, L1: 1, L2: 1, L3: 1 });
    expect(result.severityBuckets).toEqual([
      { bucket: 'A', count: 0 },
      { bucket: 'B', count: 0 },
      { bucket: 'C', count: 0 },
      { bucket: 'D', count: 4 },
      { bucket: 'E', count: 0 },
    ]);
    expect(repo.findUsersForDisplay).toHaveBeenCalledOnce();
    expect(repo.findUsersForDisplay).toHaveBeenCalledWith(['u2']);
    expect(result.recentHighSeverityEvents.map((item) => item.displayName)).toEqual(['Ada', 'Ada']);
  });

  it('uses one captured now for content snapshots and exposes provisional ranges unchanged', async () => {
    const repo = makeRepo();
    const service = new ChatDashboardService(repo as never);
    const result = await service.contentPulse(user, { tz: 'UTC', window: 'today' });

    expect(repo.featuredSlotsCoverage).toHaveBeenCalledOnce();
    expect(repo.countActiveBoosts).toHaveBeenCalledOnce();
    expect(repo.featuredSlotsCoverage.mock.calls[0][0]).toBe(
      repo.countActiveBoosts.mock.calls[0][0],
    );
    expect(result.range.isComplete).toBe(false);
  });
});
