import { describe, expect, it, vi } from 'vitest';
import { ChatDashboardRepository } from './chat-dashboard.repository';
import {
  buildResolvedRange,
  decimalToString,
  presentAmounts,
  toDisplayName,
} from './chat-dashboard.presenter';

const range = { from: new Date('2026-06-01T00:00:00Z'), to: new Date('2026-06-08T00:00:00Z') };

describe('ChatDashboardRepository projections', () => {
  it('uses exact cross-cutting and Pending Inbox predicates', async () => {
    const prisma = {
      system: {
        findUnique: vi.fn().mockResolvedValue({ code: 'chat' }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      gallery_posts: { count: vi.fn().mockResolvedValue(1) },
      gallery_reports: { count: vi.fn().mockResolvedValue(2) },
      image_templates: { count: vi.fn().mockResolvedValue(3) },
      video_templates: { count: vi.fn().mockResolvedValue(4) },
      user_risk_profiles: { count: vi.fn().mockResolvedValue(5) },
    };
    const repo = new ChatDashboardRepository(prisma as never);

    expect(await repo.findSystemCodeById('chat-id')).toBe('chat');
    await repo.findUsersForDisplay(['user-1', 'user-2']);
    await repo.countGalleryPending();
    await repo.countGalleryPendingReports();
    expect(await repo.countTemplatePending()).toEqual({ image: 3, video: 4 });
    await repo.countFlaggedRiskUsers();

    expect(prisma.system.findUnique).toHaveBeenCalledWith({
      where: { id: 'chat-id' },
      select: { code: true },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-1', 'user-2'] } },
      select: {
        id: true,
        status: true,
        nickname: true,
        realName: true,
        username: true,
      },
    });
    expect(prisma.gallery_posts.count).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
    });
    expect(prisma.gallery_reports.count).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
    });
    expect(prisma.image_templates.count).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
    });
    expect(prisma.video_templates.count).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
    });
    expect(prisma.user_risk_profiles.count).toHaveBeenCalledWith({
      where: {
        level: { not: 'L0' },
        user: { status: { not: 'DELETED' } },
      },
    });

    prisma.user.findMany.mockClear();
    expect(await repo.findUsersForDisplay([])).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('uses precise pending, generation duration, points, and hold predicates', async () => {
    const prisma = {
      systemRegistration: { count: vi.fn().mockResolvedValue(2) },
      batch_jobs: { count: vi.fn().mockResolvedValue(1) },
      generation_tasks: { aggregate: vi.fn().mockResolvedValue({ _avg: { durationMs: 12 } }) },
      points_records: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 5 } }) },
      point_holds: { count: vi.fn().mockResolvedValue(3) },
    };
    const repo = new ChatDashboardRepository(prisma as never);
    await repo.countRegistrationPending('chat-id');
    await repo.countBatchJobsProcessing();
    await repo.aggregateGenerationDuration(range);
    await repo.sumPointsConsumed(range);
    await repo.countActiveHoldsGlobal();
    expect(prisma.systemRegistration.count).toHaveBeenCalledWith({ where: { systemId: 'chat-id', status: 'PENDING' } });
    expect(prisma.batch_jobs.count).toHaveBeenCalledWith({ where: { status: 'processing' } });
    expect(prisma.generation_tasks.aggregate).toHaveBeenCalledWith({ where: { createdAt: { gte: range.from, lt: range.to }, status: 'SUCCEEDED', durationMs: { not: null } }, _avg: { durationMs: true } });
    expect(prisma.points_records.aggregate).toHaveBeenCalledWith({ where: { type: 'CONSUME', status: 'CONFIRMED', source: 'TASK', createdAt: { gte: range.from, lt: range.to } }, _sum: { amount: true } });
    expect(prisma.point_holds.count).toHaveBeenCalledWith({ where: { status: { in: ['PENDING', 'PROCESSING'] } } });
  });

  it('anchors generation projections to createdAt and isolates succeeded/failed denominators', async () => {
    const prisma = {
      generation_tasks: {
        groupBy: vi.fn()
          .mockResolvedValueOnce([{ status: 'SUCCEEDED', kind: 'IMAGE', _count: { _all: 2 } }])
          .mockResolvedValueOnce([{ errorStage: 'PROVIDER', errorClass: 'TIMEOUT', _count: { _all: 1 } }])
          .mockResolvedValueOnce([
            { provider: 'openai', model: 'image-1', status: 'SUCCEEDED', _count: { _all: 3 } },
            { provider: 'openai', model: 'image-1', status: 'FAILED', _count: { _all: 1 } },
            { provider: 'openai', model: 'image-1', status: 'PENDING', _count: { _all: 2 } },
          ]),
      },
    };
    const repo = new ChatDashboardRepository(prisma as never);

    await repo.groupGenerationByStatus(range);
    await repo.groupGenerationFailureReasons(range, 10);
    const models = await repo.groupGenerationTopModels(range, 10);

    expect(prisma.generation_tasks.groupBy.mock.calls[0][0]).toMatchObject({
      by: ['status', 'kind'],
      where: { createdAt: { gte: range.from, lt: range.to } },
    });
    expect(prisma.generation_tasks.groupBy.mock.calls[1][0]).toMatchObject({
      by: ['errorStage', 'errorClass'],
      where: {
        createdAt: { gte: range.from, lt: range.to },
        status: 'FAILED',
      },
    });
    expect(models).toEqual([
      {
        provider: 'openai',
        model: 'image-1',
        count: 6,
        succeeded: 3,
        failed: 1,
      },
    ]);
  });

  it('uses paid/refund COALESCE SQL and the approved risk bucket boundaries', async () => {
    const raw = vi.fn().mockResolvedValue([]);
    const repo = new ChatDashboardRepository({ $queryRaw: raw } as never);
    await repo.sumGmvByCurrency(range);
    await repo.sumRefundedByCurrency(range);
    await repo.bucketRiskEventSeverity(range);
    const sql = raw.mock.calls.map(([statement]) => (statement as { strings: string[] }).strings.join('?'));
    expect(sql[0]).toContain('SUM(COALESCE("paidAmount", "amount"))');
    expect(sql[0]).toContain("COALESCE(\"currency\", 'UNKNOWN')");
    expect(sql[0]).not.toContain('"status"');
    expect(sql[1]).toContain('SUM(COALESCE("refundAmount", "paidAmount", "amount"))');
    expect(sql[2]).toContain('severity" = 0');
    expect(sql[2]).toContain('severity" >= 70 AND event."severity" < 100');
    expect(sql[2]).toContain('severity" BETWEEN 0 AND 100');
  });

  it('uses paidAt/status and task-point predicates for remaining Billing projections', async () => {
    const prisma = {
      orders: { count: vi.fn().mockResolvedValue(0) },
      points_records: {
        groupBy: vi.fn().mockResolvedValue([
          { userId: 'user-1', _sum: { amount: 12 } },
        ]),
      },
      conversations: { count: vi.fn().mockResolvedValue(0) },
    };
    const repo = new ChatDashboardRepository(prisma as never);

    await repo.countPaidOrders(range);
    await repo.countPendingOrdersGlobal();
    expect(await repo.groupTopPointsConsumers(range, 10)).toEqual([
      { userId: 'user-1', points: 12 },
    ]);
    await repo.countConversationsCreated(range);

    expect(prisma.orders.count.mock.calls).toEqual([
      [{ where: { paidAt: { gte: range.from, lt: range.to } } }],
      [{ where: { status: 'PENDING' } }],
    ]);
    expect(prisma.points_records.groupBy).toHaveBeenCalledWith({
      by: ['userId'],
      where: {
        type: 'CONSUME',
        status: 'CONFIRMED',
        source: 'TASK',
        createdAt: { gte: range.from, lt: range.to },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });
    expect(prisma.conversations.count).toHaveBeenCalledWith({
      where: { createdAt: { gte: range.from, lt: range.to } },
    });
  });

  it('keeps content and risk filters aligned with published/evaluated semantics', async () => {
    const prisma = {
      gallery_posts: { groupBy: vi.fn().mockResolvedValue([]) },
      featured_slots: { count: vi.fn().mockResolvedValue(0) },
      resource_boosts: { count: vi.fn().mockResolvedValue(0) },
      user: { count: vi.fn().mockResolvedValue(0) },
      user_risk_profiles: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      user_risk_events: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const repo = new ChatDashboardRepository(prisma as never);
    await repo.countGalleryPublished(range);
    await repo.featuredSlotsCoverage(range.to);
    await repo.countActiveBoosts(range.to);
    await repo.countUsersForRiskDistribution();
    await repo.groupRiskLevelDistribution();
    await repo.countEvaluatedHighRiskUsers(range);
    await repo.countRiskEvents(range);
    await repo.groupTopRiskEventTypes(range, 10);
    await repo.listRecentHighSeverityEvents(range, 10);
    expect(prisma.gallery_posts.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'PUBLISHED', publishedAt: { gte: range.from, lt: range.to } } }));
    expect(prisma.featured_slots.count.mock.calls).toEqual([
      [{ where: { kind: 'RESOURCE', isEnabled: true } }],
      [{ where: {
        kind: 'RESOURCE',
        isEnabled: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: range.to } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: range.to } }] },
        ],
      } }],
    ]);
    expect(prisma.resource_boosts.count).toHaveBeenCalledWith({ where: { isActive: true, startsAt: { lte: range.to }, endsAt: { gte: range.to } } });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { status: { not: 'DELETED' } } });
    expect(prisma.user_risk_profiles.groupBy).toHaveBeenCalledWith({
      by: ['level'],
      where: { user: { status: { not: 'DELETED' } } },
      _count: { _all: true },
    });
    expect(prisma.user_risk_profiles.count).toHaveBeenCalledWith({ where: { evaluatedAt: { gte: range.from, lt: range.to }, level: { in: ['L2', 'L3'] }, user: { status: { not: 'DELETED' } } } });
    expect(prisma.user_risk_events.count).toHaveBeenCalledWith({ where: { createdAt: { gte: range.from, lt: range.to }, user: { status: { not: 'DELETED' } } } });
    expect(prisma.user_risk_events.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['type'],
      where: { createdAt: { gte: range.from, lt: range.to }, user: { status: { not: 'DELETED' } } },
      take: 10,
    }));
    expect(prisma.user_risk_events.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { severity: { gte: 70 }, createdAt: { gte: range.from, lt: range.to }, user: { status: { not: 'DELETED' } } }, take: 10 }));
  });

  it('uses the approved gallery metrics join and stable hot ordering', async () => {
    const raw = vi.fn().mockResolvedValue([]);
    const repo = new ChatDashboardRepository({ $queryRaw: raw } as never);
    await repo.topGalleryHot(10);
    const sql = (raw.mock.calls[0][0] as { strings: string[] }).strings.join('?');
    expect(sql).toContain('LEFT JOIN "resource_metrics" metrics');
    expect(sql).toContain("metrics.\"resourceType\" = 'GALLERY_POST'");
    expect(sql).toContain('ORDER BY COALESCE(metrics."hotScore", 0) DESC');
    expect(sql).toContain('post."publishedAt" DESC NULLS LAST');
    expect(sql).toContain('post."id" ASC');
  });

  it('presents Decimal values, display-name fallbacks, and resolved custom ranges', () => {
    expect(decimalToString({ toString: () => '12.50' })).toBe('12.50');
    expect(decimalToString(null)).toBe('0');
    expect(toDisplayName(undefined)).toBe('Unknown user');
    expect(toDisplayName({
      id: 'deleted',
      status: 'DELETED',
      nickname: 'Old name',
      realName: null,
      username: 'deleted-user',
    })).toBe('Deactivated user');
    expect(toDisplayName({
      id: 'active',
      status: 'ACTIVE',
      nickname: '  Ada  ',
      realName: 'Ada Lovelace',
      username: 'ada',
    })).toBe('Ada');
    expect(presentAmounts([
      { currency: 'USD', amount: '2.00' },
      { currency: 'EUR', amount: '1.00' },
    ])).toEqual([
      { currency: 'EUR', amount: '1.00' },
      { currency: 'USD', amount: '2.00' },
    ]);
    expect(buildResolvedRange({
      window: 'custom',
      tz: 'UTC',
      from: range.from,
      to: range.to,
      fromDate: '2026-06-01',
      toDate: '2026-06-07',
      isComplete: true,
      prev: {
        from: new Date('2026-05-25T00:00:00Z'),
        to: new Date('2026-06-01T00:00:00Z'),
      },
    })).toEqual({
      window: 'custom',
      tz: 'UTC',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-08T00:00:00.000Z',
      fromDate: '2026-06-01',
      toDate: '2026-06-07',
      isComplete: true,
    });
  });
});
