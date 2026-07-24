import { BillingCycle, PointGrantType, PointLedgerEventType, PointsSource } from '../../platform/prisma/generated';
import { MembershipCycleService } from './membership-cycle.service';

function createRepository() {
  const tx = {
    user_memberships: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    membership_plans: {
      findUnique: vi.fn(),
    },
    point_grants: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  return {
    expireMemberships: vi.fn(),
    findPendingMembershipChanges: vi.fn(),
    findActiveMembershipsForSubscriptionPoints: vi.fn(),
    findPlan: vi.fn(),
    findSubscriptionGrantBySourceInTx: vi.fn((txArg: typeof tx, sourceId: string) =>
      txArg.point_grants.findFirst({
        where: {
          sourceEvent: PointLedgerEventType.subscription_grant,
          sourceId,
        },
      }),
    ),
    findPreviousSubscriptionGrantsInTx: vi.fn(
      (
        txArg: typeof tx,
        input: { userId: string; previousCycleStart: Date; cycleStart: Date },
      ) =>
        // 这里必须传真实 where：塞 expect.objectContaining 给一个忽略入参的 mock，
        // 断言永远不会被求值，上周期窗口谓词等于零覆盖。
        txArg.point_grants.findMany({
          where: {
            userId: input.userId,
            expiresAt: {
              gt: input.previousCycleStart,
              lte: input.cycleStart,
            },
          },
        }),
    ),
    findMembershipInTx: vi.fn((txArg: typeof tx, id: string) =>
      txArg.user_memberships.findUnique({ where: { id } }),
    ),
    findPlanWithLevelInTx: vi.fn((txArg: typeof tx, id: string) =>
      txArg.membership_plans.findUnique({
        where: { id },
        include: { level: true },
      }),
    ),
    activatePendingPlanInTx: vi.fn((txArg: typeof tx, id: string, data: unknown) =>
      txArg.user_memberships.update({ where: { id }, data }),
    ),
    clearMissingPendingPlanInTx: vi.fn(),
    _tx: tx,
    runTransaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)),
  };
}

function createService(repository = createRepository()) {
  const points = {
    expireGrants: vi.fn().mockResolvedValue({ expiredGrants: 0, expiredAmount: 0 }),
    grantPointsWithinTx: vi.fn(async (_tx: unknown, _userId: string, input: any) => ({
      grant: { id: `grant-${input.sourceId}` },
      balance: input.amount,
    })),
  };
  return {
    service: new MembershipCycleService(repository as never, points as never),
    repository,
    points,
  };
}

describe('MembershipCycleService', () => {
  it('expires active memberships whose period has ended', async () => {
    const repository = createRepository();
    repository.expireMemberships.mockResolvedValue({
      cancelled: { count: 1 },
      expired: { count: 2 },
    });
    const { service } = createService(repository);
    const now = new Date('2026-06-14T00:00:00.000Z');

    await expect(service.expireMemberships(now)).resolves.toEqual({
      expiredMemberships: 2,
      cancelledMemberships: 1,
    });
    expect(repository.expireMemberships).toHaveBeenCalledWith(now);
  });

  it('grants due monthly subscription points after the first subscription cycle', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    repository.findActiveMembershipsForSubscriptionPoints.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    repository.findPlan.mockResolvedValue({ id: 'plan-yearly', points: 6500 });
    repository.runTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      point_grants: { findFirst: vi.fn().mockResolvedValue(null) },
    }));

    const result = await service.grantDueSubscriptionPoints(
      new Date('2026-02-15T00:00:00.000Z'),
    );

    expect(result).toEqual({
      grantsCreated: 1,
      pointsGranted: 6500,
      carryoverGrantsCreated: 0,
      carryoverPointsGranted: 0,
      skippedExisting: 0,
    });
    expect(points.grantPointsWithinTx).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({
        amount: 6500,
        grantType: PointGrantType.SUBSCRIPTION,
        sourceEvent: PointLedgerEventType.subscription_grant,
        source: PointsSource.MEMBERSHIP,
        sourceId: 'membership-cycle:membership-1:1',
        expiresAt: new Date('2026-03-01T00:00:00.000Z'),
        metadata: expect.objectContaining({
          membershipId: 'membership-1',
          planId: 'plan-yearly',
          cycleIndex: 1,
          scheduledMonthlyGrant: true,
        }),
      }),
    );
  });

  it('FIX-8: treats a unique-constraint conflict (concurrent grant) as already-granted', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    repository.findActiveMembershipsForSubscriptionPoints.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    repository.findPlan.mockResolvedValue({ id: 'plan-yearly', points: 6500 });
    repository.runTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({ point_grants: { findFirst: vi.fn().mockResolvedValue(null) } }),
    );
    points.grantPointsWithinTx.mockRejectedValue(
      Object.assign(new Error('unique violation'), { code: 'P2002' }),
    );

    const result = await service.grantDueSubscriptionPoints(
      new Date('2026-02-15T00:00:00.000Z'),
    );

    expect(result.grantsCreated).toBe(0);
    expect(result.skippedExisting).toBe(1);
  });

  it('skips monthly grant when the cycle sourceId already exists', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    repository.findActiveMembershipsForSubscriptionPoints.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    repository.findPlan.mockResolvedValue({ id: 'plan-yearly', points: 6500 });
    repository.runTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      point_grants: { findFirst: vi.fn().mockResolvedValue({ id: 'existing-grant' }) },
    }));

    const result = await service.grantDueSubscriptionPoints(
      new Date('2026-02-15T00:00:00.000Z'),
    );

    expect(result).toEqual({
      grantsCreated: 0,
      pointsGranted: 0,
      carryoverGrantsCreated: 0,
      carryoverPointsGranted: 0,
      skippedExisting: 1,
    });
    expect(points.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('does not backfill subscription cycles that are already expired', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    repository.findActiveMembershipsForSubscriptionPoints.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    repository.findPlan.mockResolvedValue({ id: 'plan-yearly', points: 6500 });
    repository.runTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      point_grants: { findFirst: vi.fn().mockResolvedValue(null) },
    }));

    const result = await service.grantDueSubscriptionPoints(
      new Date('2026-04-15T00:00:00.000Z'),
    );

    expect(result).toEqual({
      grantsCreated: 1,
      pointsGranted: 6500,
      carryoverGrantsCreated: 0,
      carryoverPointsGranted: 0,
      skippedExisting: 0,
    });
    expect(points.grantPointsWithinTx).toHaveBeenCalledTimes(1);
    expect(points.grantPointsWithinTx).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({
        sourceId: 'membership-cycle:membership-1:3',
        expiresAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    );
  });

  it('applies a pending downgrade at period end and grants the new cycle subscription points', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    const effectiveAt = new Date('2026-07-01T00:00:00.000Z');
    repository.findPendingMembershipChanges.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        pendingPlanId: 'plan-starter',
        pendingOrderId: 'order-downgrade',
        pendingChangeEffectiveAt: effectiveAt,
      },
    ]);
    repository._tx.user_memberships.findUnique.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      status: 'ACTIVE',
      pendingPlanId: 'plan-starter',
      pendingOrderId: 'order-downgrade',
      pendingChangeEffectiveAt: effectiveAt,
    });
    repository._tx.membership_plans.findUnique.mockResolvedValue({
      id: 'plan-starter',
      levelId: 'level-starter',
      billingCycle: BillingCycle.MONTHLY,
      months: 1,
      autoRenew: false,
      points: 2500,
      level: { level: 1, name: 'Starter' },
    });
    repository._tx.user_memberships.update.mockResolvedValue({ id: 'membership-1' });
    repository._tx.point_grants.findFirst.mockResolvedValue(null);

    const result = await service.applyPendingMembershipChanges(
      new Date('2026-07-01T01:00:00.000Z'),
    );

    expect(result).toEqual({
      applied: 1,
      pointsGranted: 2500,
      skippedMissingPlan: 0,
      skippedExistingGrant: 0,
    });
    expect(repository.activatePendingPlanInTx).toHaveBeenCalledWith(
      expect.anything(),
      'membership-1',
      expect.objectContaining({
        levelId: 'level-starter',
        planId: 'plan-starter',
        startedAt: effectiveAt,
        expiresAt: new Date('2026-08-01T00:00:00.000Z'),
        pendingPlanId: null,
        pendingOrderId: null,
      }),
    );
    expect(points.grantPointsWithinTx).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({
        amount: 2500,
        sourceId: 'order-downgrade',
        expiresAt: new Date('2026-08-01T00:00:00.000Z'),
        metadata: expect.objectContaining({
          scheduledDowngradeActivation: true,
          pendingOrderId: 'order-downgrade',
        }),
      }),
    );
  });

  it('carries over one cycle of Pro subscription points before expiring the previous grant', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    repository.findActiveMembershipsForSubscriptionPoints.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-pro',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-04-01T00:00:00.000Z'),
        level: {
          level: 3,
          name: 'Pro',
          pointsPerMonth: 20000,
          features: {
            pointsCarryover: { enabled: true, maxCycles: 1, maxPoints: 20000 },
          },
        },
      },
    ]);
    repository.findPlan.mockResolvedValue({ id: 'plan-pro', points: 20000 });
    repository._tx.point_grants.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    repository._tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'grant-previous',
        userId: 'user-1',
        grantType: PointGrantType.SUBSCRIPTION,
        sourceEvent: PointLedgerEventType.subscription_grant,
        availableAmount: 12000,
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
        metadata: { membershipId: 'membership-1' },
      },
      {
        id: 'grant-carryover-old',
        userId: 'user-1',
        grantType: PointGrantType.SUBSCRIPTION,
        sourceEvent: PointLedgerEventType.subscription_grant,
        availableAmount: 5000,
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
        metadata: { membershipId: 'membership-1', carryover: true },
      },
    ]);

    const result = await service.grantDueSubscriptionPoints(
      new Date('2026-02-15T00:00:00.000Z'),
    );

    expect(result).toEqual({
      grantsCreated: 1,
      pointsGranted: 20000,
      carryoverGrantsCreated: 1,
      carryoverPointsGranted: 12000,
      skippedExisting: 0,
    });
    expect(points.grantPointsWithinTx).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'user-1',
      expect.objectContaining({
        amount: 12000,
        sourceId: 'membership-carryover:membership-1:1',
        metadata: expect.objectContaining({
          carryover: true,
          carriedCycles: 1,
          carriedFromGrantIds: ['grant-previous'],
        }),
      }),
    );
    expect(points.grantPointsWithinTx).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'user-1',
      expect.objectContaining({
        amount: 20000,
        sourceId: 'membership-cycle:membership-1:1',
      }),
    );
    // 结转只能取「上一周期」的 grant：窗口谓词必须是 (previousCycleStart, cycleStart]。
    // 窗口写错会把更早或当期的 grant 也卷进来，重复结转。
    expect(repository._tx.point_grants.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        expiresAt: {
          gt: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-02-01T00:00:00.000Z'),
        },
      },
    });
  });

  it('runDailyCycle grants the new cycle BEFORE expiring the previous one (no zero-balance gap)', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    // 一个已进入第 2 个周期、应发放新月积分的会员
    repository.findPendingMembershipChanges.mockResolvedValue([]);
    repository.expireMemberships.mockResolvedValue({
      cancelled: { count: 0 },
      expired: { count: 0 },
    });
    repository.findActiveMembershipsForSubscriptionPoints.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    repository.findPlan.mockResolvedValue({ id: 'plan-yearly', points: 6500 });
    repository.runTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({ point_grants: { findFirst: vi.fn().mockResolvedValue(null) } }),
    );

    const result = await service.runDailyCycle();

    // runDailyCycle 成功时不返回 failed 标记
    expect(result).toBeUndefined();
    expect(points.grantPointsWithinTx).toHaveBeenCalledTimes(1);
    expect(points.expireGrants).toHaveBeenCalledTimes(1);

    // 铁律：先发放（grantPointsWithinTx）再清空（expireGrants）。
    // 若顺序反了，会出现一个 subscriptionBalance 归零的空窗期——这个断言就是守卫。
    const grantOrder = points.grantPointsWithinTx.mock.invocationCallOrder[0];
    const expireOrder = points.expireGrants.mock.invocationCallOrder[0];
    expect(grantOrder).toBeLessThan(expireOrder);
  });

  it('carries a once-carried grant again and ages it to 2 (maxCycles=2)', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    repository.findActiveMembershipsForSubscriptionPoints.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-pro',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-06-01T00:00:00.000Z'),
        level: {
          level: 1,
          name: 'Plus',
          pointsPerMonth: 20000,
          features: { pointsCarryover: { enabled: true, maxCycles: 2, maxPoints: 20000 } },
        },
      },
    ]);
    repository.findPlan.mockResolvedValue({ id: 'plan-pro', points: 20000 });
    repository._tx.point_grants.findFirst.mockResolvedValue(null);
    repository._tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'grant-carry-1',
        userId: 'user-1',
        grantType: PointGrantType.SUBSCRIPTION,
        sourceEvent: PointLedgerEventType.subscription_grant,
        availableAmount: 8000,
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
        metadata: { membershipId: 'membership-1', carryover: true, carriedCycles: 1 },
      },
    ]);

    const result = await service.grantDueSubscriptionPoints(
      new Date('2026-02-15T00:00:00.000Z'),
    );

    expect(result.carryoverGrantsCreated).toBe(1);
    expect(points.grantPointsWithinTx).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'user-1',
      expect.objectContaining({
        amount: 8000,
        sourceId: 'membership-carryover:membership-1:1',
        metadata: expect.objectContaining({ carryover: true, carriedCycles: 2 }),
      }),
    );
  });

  it('does NOT carry a grant that reached maxCycles (age 2, maxCycles 2)', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    repository.findActiveMembershipsForSubscriptionPoints.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-pro',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-06-01T00:00:00.000Z'),
        level: {
          level: 1,
          name: 'Plus',
          pointsPerMonth: 20000,
          features: { pointsCarryover: { enabled: true, maxCycles: 2, maxPoints: 20000 } },
        },
      },
    ]);
    repository.findPlan.mockResolvedValue({ id: 'plan-pro', points: 20000 });
    repository._tx.point_grants.findFirst.mockResolvedValue(null);
    repository._tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'grant-carry-2',
        userId: 'user-1',
        grantType: PointGrantType.SUBSCRIPTION,
        sourceEvent: PointLedgerEventType.subscription_grant,
        availableAmount: 8000,
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
        metadata: { membershipId: 'membership-1', carryover: true, carriedCycles: 2 },
      },
    ]);

    const result = await service.grantDueSubscriptionPoints(
      new Date('2026-02-15T00:00:00.000Z'),
    );

    expect(result.carryoverGrantsCreated).toBe(0);
    expect(points.grantPointsWithinTx).toHaveBeenCalledTimes(1);
    expect(points.grantPointsWithinTx).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ sourceId: 'membership-cycle:membership-1:1' }),
    );
  });

  it('P2-D2: 年付场景下同一 cycleIndex sourceId 多次调用幂等（同一个月只发一次）', async () => {
    const repository = createRepository();
    const { service, points } = createService(repository);
    repository.findActiveMembershipsForSubscriptionPoints.mockResolvedValue([
      {
        id: 'membership-yearly',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    repository.findPlan.mockResolvedValue({ id: 'plan-yearly', points: 6500 });

    // 第一次：cycle sourceId 不存在 -> 发放成功
    repository.runTransaction.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({ point_grants: { findFirst: vi.fn().mockResolvedValue(null) } }),
    );
    const first = await service.grantDueSubscriptionPoints(
      new Date('2026-02-15T00:00:00.000Z'),
    );
    expect(first.grantsCreated).toBe(1);
    expect(first.skippedExisting).toBe(0);

    // 第二次：同一个月再次跑 cron，应识别到 cycle sourceId 已存在 -> 跳过
    repository.runTransaction.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({ point_grants: { findFirst: vi.fn().mockResolvedValue({ id: 'existing' }) } }),
    );
    const second = await service.grantDueSubscriptionPoints(
      new Date('2026-02-15T01:00:00.000Z'),
    );
    expect(second).toEqual({
      grantsCreated: 0,
      pointsGranted: 0,
      carryoverGrantsCreated: 0,
      carryoverPointsGranted: 0,
      skippedExisting: 1,
    });
    expect(points.grantPointsWithinTx).toHaveBeenCalledTimes(1);
    expect(points.grantPointsWithinTx).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ sourceId: 'membership-cycle:membership-yearly:1' }),
    );
  });
});
