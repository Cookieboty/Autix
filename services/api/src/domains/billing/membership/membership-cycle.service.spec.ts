import { BillingCycle, PointGrantType, PointLedgerEventType, PointsSource } from '../../platform/prisma/generated';
import { MembershipCycleService } from './membership-cycle.service';

function createPrisma() {
  const tx = {
    user_memberships: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    membership_plans: {
      findUnique: jest.fn(),
    },
    point_grants: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return {
    user_memberships: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    membership_plans: {
      findUnique: jest.fn(),
    },
    point_grants: {
      findFirst: jest.fn(),
    },
    _tx: tx,
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
  };
}

function createService(prisma = createPrisma()) {
  const points = {
    expireGrants: jest.fn().mockResolvedValue({ expiredGrants: 0, expiredAmount: 0 }),
    grantPointsWithinTx: jest.fn(async (_tx: unknown, _userId: string, input: any) => ({
      grant: { id: `grant-${input.sourceId}` },
      balance: input.amount,
    })),
  };
  return {
    service: new MembershipCycleService(prisma as never, points as never),
    prisma,
    points,
  };
}

describe('MembershipCycleService', () => {
  it('expires active memberships whose period has ended', async () => {
    const prisma = createPrisma();
    prisma.user_memberships.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });
    const { service } = createService(prisma);
    const now = new Date('2026-06-14T00:00:00.000Z');

    await expect(service.expireMemberships(now)).resolves.toEqual({
      expiredMemberships: 2,
      cancelledMemberships: 1,
    });
    expect(prisma.user_memberships.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
        expiresAt: { lte: now },
      },
      data: { status: 'CANCELLED', autoRenew: false },
    });
    expect(prisma.user_memberships.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        expiresAt: { lte: now },
      },
      data: { status: 'EXPIRED', autoRenew: false },
    });
  });

  it('grants due monthly subscription points after the first subscription cycle', async () => {
    const prisma = createPrisma();
    const { service, points } = createService(prisma);
    prisma.user_memberships.findMany.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    prisma.membership_plans.findUnique.mockResolvedValue({ id: 'plan-yearly', points: 6500 });
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      point_grants: { findFirst: jest.fn().mockResolvedValue(null) },
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

  it('skips monthly grant when the cycle sourceId already exists', async () => {
    const prisma = createPrisma();
    const { service, points } = createService(prisma);
    prisma.user_memberships.findMany.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    prisma.membership_plans.findUnique.mockResolvedValue({ id: 'plan-yearly', points: 6500 });
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      point_grants: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-grant' }) },
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
    const prisma = createPrisma();
    const { service, points } = createService(prisma);
    prisma.user_memberships.findMany.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    prisma.membership_plans.findUnique.mockResolvedValue({ id: 'plan-yearly', points: 6500 });
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      point_grants: { findFirst: jest.fn().mockResolvedValue(null) },
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
    const prisma = createPrisma();
    const { service, points } = createService(prisma);
    const effectiveAt = new Date('2026-07-01T00:00:00.000Z');
    prisma.user_memberships.findMany.mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        pendingPlanId: 'plan-starter',
        pendingOrderId: 'order-downgrade',
        pendingChangeEffectiveAt: effectiveAt,
      },
    ]);
    prisma._tx.user_memberships.findUnique.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      status: 'ACTIVE',
      pendingPlanId: 'plan-starter',
      pendingOrderId: 'order-downgrade',
      pendingChangeEffectiveAt: effectiveAt,
    });
    prisma._tx.membership_plans.findUnique.mockResolvedValue({
      id: 'plan-starter',
      levelId: 'level-starter',
      billingCycle: BillingCycle.MONTHLY,
      months: 1,
      autoRenew: false,
      points: 2500,
      level: { level: 1, name: 'Starter' },
    });
    prisma._tx.user_memberships.update.mockResolvedValue({ id: 'membership-1' });
    prisma._tx.point_grants.findFirst.mockResolvedValue(null);

    const result = await service.applyPendingMembershipChanges(
      new Date('2026-07-01T01:00:00.000Z'),
    );

    expect(result).toEqual({
      applied: 1,
      pointsGranted: 2500,
      skippedMissingPlan: 0,
      skippedExistingGrant: 0,
    });
    expect(prisma._tx.user_memberships.update).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
      data: expect.objectContaining({
        levelId: 'level-starter',
        planId: 'plan-starter',
        startedAt: effectiveAt,
        expiresAt: new Date('2026-08-01T00:00:00.000Z'),
        pendingPlanId: null,
        pendingOrderId: null,
      }),
    });
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
    const prisma = createPrisma();
    const { service, points } = createService(prisma);
    prisma.user_memberships.findMany.mockResolvedValue([
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
    prisma.membership_plans.findUnique.mockResolvedValue({ id: 'plan-pro', points: 20000 });
    prisma._tx.point_grants.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma._tx.point_grants.findMany.mockResolvedValue([
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
  });

  it('P2-D2: 年付场景下同一 cycleIndex sourceId 多次调用幂等（同一个月只发一次）', async () => {
    const prisma = createPrisma();
    const { service, points } = createService(prisma);
    prisma.user_memberships.findMany.mockResolvedValue([
      {
        id: 'membership-yearly',
        userId: 'user-1',
        planId: 'plan-yearly',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        level: { level: 2, name: 'Creator', pointsPerMonth: 6500 },
      },
    ]);
    prisma.membership_plans.findUnique.mockResolvedValue({ id: 'plan-yearly', points: 6500 });

    // 第一次：cycle sourceId 不存在 -> 发放成功
    prisma.$transaction.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({ point_grants: { findFirst: jest.fn().mockResolvedValue(null) } }),
    );
    const first = await service.grantDueSubscriptionPoints(
      new Date('2026-02-15T00:00:00.000Z'),
    );
    expect(first.grantsCreated).toBe(1);
    expect(first.skippedExisting).toBe(0);

    // 第二次：同一个月再次跑 cron，应识别到 cycle sourceId 已存在 -> 跳过
    prisma.$transaction.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({ point_grants: { findFirst: jest.fn().mockResolvedValue({ id: 'existing' }) } }),
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
