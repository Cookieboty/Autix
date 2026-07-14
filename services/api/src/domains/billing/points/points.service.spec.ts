import { BadRequestException } from '@nestjs/common';
import {
  PointGrantType,
  PointHoldStatus,
  PointLedgerEventType,
  PointsSource,
} from '../../platform/prisma/generated';
import { PointsService } from './points.service';
import { PointsRepository } from './repositories/points.repository';
import { TaskPricingRepository } from './repositories/task-pricing.repository';
import { PointsLedgerService } from './services/points-ledger.service';
import { PointsHoldService } from './services/points-hold.service';
import { TaskPricingEstimatorService } from './services/task-pricing-estimator.service';

function buildPointsService(prisma: unknown) {
  const pointsRepo = new PointsRepository(prisma as never);
  const taskPricingRepo = new TaskPricingRepository(prisma as never);
  const ledgerService = new PointsLedgerService(pointsRepo);
  const holdService = new PointsHoldService(pointsRepo, ledgerService);
  const taskPricingService = new TaskPricingEstimatorService(taskPricingRepo);
  return new PointsService(pointsRepo, ledgerService, holdService, taskPricingService);
}

// NOTE: the task brief's literal scaffold typed this parameter as
// `Partial<TaskPricingRepository>` and wrapped it in a real
// `new TaskPricingEstimatorService(repo)`. That does not exercise the intended
// delegation: TaskPricingEstimatorService.estimateCost calls
// `this.repo.findTaskDefinition(...)`, never `this.repo.estimateCost(...)`, so a
// `{ estimateCost }` stand-in repo is never invoked and the real service throws a
// TypeError instead of returning the mocked value (confirmed by running it). The
// test's actual intent — assert PointsService.estimateCost delegates to
// taskPricingService.estimateCost with the new input shape — is expressed correctly
// by mocking the *service* directly instead of wrapping a fake repo.
function buildPointsServiceWithTaskPricing(taskPricingService: Partial<TaskPricingEstimatorService>) {
  const prisma = createPrisma(createTx());
  const pointsRepo = new PointsRepository(prisma as never);
  const ledgerService = new PointsLedgerService(pointsRepo);
  const holdService = new PointsHoldService(pointsRepo, ledgerService);
  return new PointsService(
    pointsRepo,
    ledgerService,
    holdService,
    taskPricingService as TaskPricingEstimatorService,
  );
}

function createTx() {
  return {
    user_points: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: 0 }),
    },
    points_records: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn(),
    },
    point_grants: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    point_holds: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(async () => null),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    point_hold_items: {
      create: vi.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createTx>) {
  return {
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
    // findHoldById() reads through `this.prisma` directly (not a $transaction
    // callback), so the non-tx mock needs its own point_holds.findUnique. Sharing
    // the tx's mock keeps `tx.point_holds.findUnique.mockResolvedValue(...)` working
    // for both the transactional and non-transactional call paths.
    point_holds: tx.point_holds,
  };
}

describe('PointsService.deductPoints (grant ledger)', () => {
  it('deducts grant batches and split balances, then records CONSUME', async () => {
    const tx = createTx();
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'gift',
        grantType: PointGrantType.GIFT,
        availableAmount: 20,
        frozenAmount: 0,
        expiresAt: null,
      },
      {
        id: 'purchased',
        grantType: PointGrantType.PURCHASED,
        availableAmount: 80,
        frozenAmount: 0,
        expiresAt: null,
      },
    ]);
    tx.user_points.findUniqueOrThrow.mockResolvedValue({ balance: 40 });
    const service = buildPointsService(createPrisma(tx));

    const balance = await service.deductPoints(
      'u1',
      60,
      PointsSource.TASK,
      undefined,
      'remark',
    );

    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'gift',
        availableAmount: { gte: 20 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      data: {
        availableAmount: { decrement: 20 },
        consumedAmount: { increment: 20 },
      },
    });
    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'purchased',
        availableAmount: { gte: 40 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      data: {
        availableAmount: { decrement: 40 },
        consumedAmount: { increment: 40 },
      },
    });
    expect(tx.user_points.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        balance: { gte: 60 },
        availableBalance: { gte: 60 },
        giftBalance: { gte: 20 },
        purchasedBalance: { gte: 40 },
      },
      data: {
        balance: { decrement: 60 },
        availableBalance: { decrement: 60 },
        totalBalance: { decrement: 60 },
        giftBalance: { decrement: 20 },
        purchasedBalance: { decrement: 40 },
      },
    });
    expect(tx.points_records.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'CONSUME', amount: 60, balance: 40 }),
      }),
    );
    expect(balance).toBe(40);
  });

  it('rejects (no record) when a grant update loses the concurrency race', async () => {
    const tx = createTx();
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'gift',
        grantType: PointGrantType.GIFT,
        availableAmount: 100,
        frozenAmount: 0,
        expiresAt: null,
      },
    ]);
    tx.point_grants.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = buildPointsService(createPrisma(tx));

    await expect(
      service.deductPoints('u1', 60, PointsSource.TASK),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user_points.updateMany).not.toHaveBeenCalled();
    expect(tx.points_records.create).not.toHaveBeenCalled();
  });

  it('rejects when usage scope excludes the direct deduction task type', async () => {
    const tx = createTx();
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'invite-reward',
        grantType: PointGrantType.GIFT,
        availableAmount: 100,
        frozenAmount: 0,
        expiresAt: null,
        usageScope: { allowedTaskTypes: ['image_generation'] },
      },
    ]);
    const service = buildPointsService(createPrisma(tx));

    await expect(
      service.deductWithinTx(
        tx as never,
        'u1',
        60,
        PointsSource.TASK,
        'agent-1',
        'skill_acquisition: Agent X',
        'skill_acquisition',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.point_grants.updateMany).not.toHaveBeenCalled();
  });
});

describe('PointsService grant and hold ledger', () => {
  it('grants points into a batch and updates split balances', async () => {
    const tx = createTx();
    tx.point_grants.create.mockResolvedValue({ id: 'grant-1' });
    tx.user_points.upsert.mockResolvedValue({ balance: 100 });
    const service = buildPointsService(createPrisma(tx));

    const result = await service.grantPoints('u1', {
      amount: 100,
      grantType: PointGrantType.PURCHASED,
      sourceEvent: PointLedgerEventType.points_purchase,
      source: PointsSource.PACKAGE,
      sourceId: 'order-1',
    });

    expect(tx.point_grants.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        grantType: PointGrantType.PURCHASED,
        totalAmount: 100,
        availableAmount: 100,
      }),
    });
    expect(tx.user_points.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          balance: { increment: 100 },
          availableBalance: { increment: 100 },
          totalBalance: { increment: 100 },
          purchasedBalance: { increment: 100 },
        }),
      }),
    );
    expect(result.balance).toBe(100);
  });

  it('freezes grants by expiry first, then grant type priority for same expiry', async () => {
    const tx = createTx();
    const sameExpiry = new Date('2026-07-01T00:00:00.000Z');
    tx.point_grants.count.mockResolvedValue(2);
    tx.user_points.findUnique.mockResolvedValue({ balance: 120 });
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'sub',
        grantType: PointGrantType.SUBSCRIPTION,
        availableAmount: 100,
        frozenAmount: 0,
        expiresAt: sameExpiry,
      },
      {
        id: 'gift',
        grantType: PointGrantType.GIFT,
        availableAmount: 30,
        frozenAmount: 0,
        expiresAt: sameExpiry,
      },
    ]);
    tx.point_holds.create.mockResolvedValue({ id: 'hold-1' });
    tx.user_points.findUniqueOrThrow.mockResolvedValue({ balance: 60 });
    const service = buildPointsService(createPrisma(tx));

    const result = await service.createHold('u1', {
      taskType: 'image_generation',
      taskId: 'gen-1',
      amount: 60,
    });

    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'gift',
        availableAmount: { gte: 30 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      data: {
        availableAmount: { decrement: 30 },
        frozenAmount: { increment: 30 },
      },
    });
    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'sub',
        availableAmount: { gte: 30 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      data: {
        availableAmount: { decrement: 30 },
        frozenAmount: { increment: 30 },
      },
    });
    expect(tx.point_hold_items.create).toHaveBeenCalledTimes(2);
    expect(result.balance).toBe(60);
  });

  it('rejects hold when available grants are insufficient', async () => {
    const tx = createTx();
    tx.point_grants.count.mockResolvedValue(1);
    tx.user_points.findUnique.mockResolvedValue({ balance: 20 });
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'gift',
        grantType: PointGrantType.GIFT,
        availableAmount: 20,
        frozenAmount: 0,
        expiresAt: null,
      },
    ]);
    const service = buildPointsService(createPrisma(tx));

    await expect(
      service.createHold('u1', { taskType: 'video_generation', amount: 60 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.point_holds.create).not.toHaveBeenCalled();
  });

  it('skips grants whose usage scope excludes the requested task type', async () => {
    const tx = createTx();
    tx.point_grants.count.mockResolvedValue(2);
    tx.user_points.findUnique.mockResolvedValue({ balance: 220 });
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'gift-video-blocked',
        grantType: PointGrantType.GIFT,
        availableAmount: 200,
        frozenAmount: 0,
        expiresAt: new Date('2026-07-01T00:00:00.000Z'),
        usageScope: { excludedTaskTypes: ['video_generation'] },
      },
      {
        id: 'purchased',
        grantType: PointGrantType.PURCHASED,
        availableAmount: 120,
        frozenAmount: 0,
        expiresAt: new Date('2026-12-01T00:00:00.000Z'),
        usageScope: null,
      },
    ]);
    tx.point_holds.create.mockResolvedValue({ id: 'hold-1' });
    tx.user_points.findUniqueOrThrow.mockResolvedValue({ balance: 120 });
    const service = buildPointsService(createPrisma(tx));

    await service.createHold('u1', {
      taskType: 'video_generation',
      taskId: 'video-1',
      amount: 100,
    });

    expect(tx.point_grants.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.point_grants.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'purchased',
        availableAmount: { gte: 100 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      data: {
        availableAmount: { decrement: 100 },
        frozenAmount: { increment: 100 },
      },
    });
  });

  it('P2-D1: rejects hold when every grant is excluded by usageScope (邀请积分场景)', async () => {
    const tx = createTx();
    tx.point_grants.count.mockResolvedValue(1);
    tx.user_points.findUnique.mockResolvedValue({ balance: 500 });
    // 邀请奖励发放：usageScope 只允许 image_generation/chat 等，明确不含 video_generation。
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'invite-reward',
        grantType: PointGrantType.GIFT,
        availableAmount: 500,
        frozenAmount: 0,
        expiresAt: new Date('2026-12-01T00:00:00.000Z'),
        usageScope: { allowedTaskTypes: ['image_generation', 'chat'] },
      },
    ]);
    const service = buildPointsService(createPrisma(tx));

    await expect(
      service.createHold('u1', {
        taskType: 'video_generation',
        taskId: 'video-1',
        amount: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.point_grants.updateMany).not.toHaveBeenCalled();
    expect(tx.point_hold_items.create).not.toHaveBeenCalled();
  });

  it('P1-1: rejects hold and rolls back when conditional grant update claims 0 rows', async () => {
    const tx = createTx();
    tx.point_grants.count.mockResolvedValue(1);
    tx.user_points.findUnique.mockResolvedValue({ balance: 200 });
    tx.point_grants.findMany.mockResolvedValue([
      {
        id: 'gift',
        grantType: PointGrantType.GIFT,
        availableAmount: 200,
        frozenAmount: 0,
        expiresAt: null,
      },
    ]);
    tx.point_holds.create.mockResolvedValue({ id: 'hold-1' });
    // 模拟并发抢占：updateMany 命中行数为 0
    tx.point_grants.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = buildPointsService(createPrisma(tx));

    await expect(
      service.createHold('u1', {
        taskType: 'image_generation',
        taskId: 'gen-1',
        amount: 60,
      }),
    ).rejects.toThrow(/INSUFFICIENT_GRANT/);
    expect(tx.point_hold_items.create).not.toHaveBeenCalled();
    expect(tx.user_points.updateMany).not.toHaveBeenCalled();
  });

  it('confirms a hold and refunds unused frozen points', async () => {
    const tx = createTx();
    tx.point_holds.findUnique.mockResolvedValue({
      id: 'hold-1',
      userId: 'u1',
      taskType: 'video_generation',
      taskId: 'gen-1',
      estimatedAmount: 100,
      status: PointHoldStatus.PROCESSING,
      items: [
        {
          grantId: 'gift',
          grantType: PointGrantType.GIFT,
          amount: 40,
        },
        {
          grantId: 'sub',
          grantType: PointGrantType.SUBSCRIPTION,
          amount: 60,
        },
      ],
    });
    tx.user_points.findUniqueOrThrow.mockResolvedValue({ balance: 20 });
    tx.point_holds.update.mockResolvedValue({ id: 'hold-1', status: PointHoldStatus.PARTIALLY_REFUNDED });
    const service = buildPointsService(createPrisma(tx));

    const result = await service.confirmHold('hold-1', 80);

    expect(tx.point_holds.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'hold-1',
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      data: { status: PointHoldStatus.PROCESSING },
    });
    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'gift', frozenAmount: { gte: 40 } },
      data: {
        frozenAmount: { decrement: 40 },
        consumedAmount: { increment: 40 },
      },
    });
    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'sub', frozenAmount: { gte: 60 } },
      data: {
        frozenAmount: { decrement: 60 },
        consumedAmount: { increment: 40 },
        availableAmount: { increment: 20 },
      },
    });
    expect(tx.user_points.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        frozenBalance: { gte: 100 },
        giftBalance: { gte: 40 },
        subscriptionBalance: { gte: 40 },
      },
      data: expect.objectContaining({
        frozenBalance: { decrement: 100 },
        availableBalance: { increment: 20 },
        balance: { increment: 20 },
        totalBalance: { decrement: 80 },
        giftBalance: { decrement: 40 },
        subscriptionBalance: { decrement: 40 },
      }),
    });
    expect(tx.points_records.updateMany).toHaveBeenCalledWith({
      where: { holdId: 'hold-1', status: 'PENDING' },
      data: {
        status: 'CONFIRMED',
        amount: 80,
        balance: 20,
        remark: PointLedgerEventType.generation_cost,
      },
    });
    expect(tx.points_records.create).not.toHaveBeenCalled();
    expect(result.confirmed).toBe(true);
  });

  it('returns idempotently when confirm already reached a terminal status', async () => {
    const tx = createTx();
    tx.point_holds.updateMany.mockResolvedValue({ count: 0 });
    tx.point_holds.findUnique.mockResolvedValue({
      id: 'hold-1',
      status: PointHoldStatus.CONFIRMED,
      items: [],
    });
    const service = buildPointsService(createPrisma(tx));

    const result = await service.confirmHold('hold-1');

    expect(result.confirmed).toBe(false);
    expect(tx.point_grants.updateMany).not.toHaveBeenCalled();
    expect(tx.user_points.updateMany).not.toHaveBeenCalled();
  });

  it('refunds a pending hold with guarded grant and frozen balance updates', async () => {
    const tx = createTx();
    tx.point_holds.findUnique.mockResolvedValue({
      id: 'hold-1',
      userId: 'u1',
      taskType: 'video_generation',
      taskId: 'gen-1',
      estimatedAmount: 100,
      status: PointHoldStatus.PROCESSING,
      items: [
        {
          grantId: 'gift',
          grantType: PointGrantType.GIFT,
          amount: 40,
        },
        {
          grantId: 'sub',
          grantType: PointGrantType.SUBSCRIPTION,
          amount: 60,
        },
      ],
    });
    tx.user_points.findUniqueOrThrow.mockResolvedValue({ balance: 100 });
    tx.point_holds.update.mockResolvedValue({
      id: 'hold-1',
      status: PointHoldStatus.REFUNDED,
    });
    const service = buildPointsService(createPrisma(tx));

    const result = await service.refundHold('hold-1', 'provider failed');

    expect(tx.point_holds.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'hold-1',
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      data: { status: PointHoldStatus.PROCESSING },
    });
    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'gift', frozenAmount: { gte: 40 } },
      data: {
        frozenAmount: { decrement: 40 },
        availableAmount: { increment: 40 },
      },
    });
    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'sub', frozenAmount: { gte: 60 } },
      data: {
        frozenAmount: { decrement: 60 },
        availableAmount: { increment: 60 },
      },
    });
    expect(tx.user_points.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', frozenBalance: { gte: 100 } },
      data: {
        balance: { increment: 100 },
        availableBalance: { increment: 100 },
        frozenBalance: { decrement: 100 },
      },
    });
    expect(tx.points_records.updateMany).toHaveBeenCalledWith({
      where: { holdId: 'hold-1', status: 'PENDING' },
      data: {
        status: 'REFUNDED',
        balance: 100,
        remark: 'refund: provider failed',
      },
    });
    expect(tx.points_records.create).not.toHaveBeenCalled();
    expect(result.refunded).toBe(true);
    expect(result.amount).toBe(100);
  });

  it('returns idempotently when refund already reached REFUNDED', async () => {
    const tx = createTx();
    tx.point_holds.updateMany.mockResolvedValue({ count: 0 });
    tx.point_holds.findUnique.mockResolvedValue({
      id: 'hold-1',
      status: PointHoldStatus.REFUNDED,
      items: [],
    });
    const service = buildPointsService(createPrisma(tx));

    const result = await service.refundHold('hold-1', 'retry');

    expect(result.refunded).toBe(false);
    expect(tx.point_grants.updateMany).not.toHaveBeenCalled();
    expect(tx.user_points.updateMany).not.toHaveBeenCalled();
  });
});

describe('PointsService.quoteHoldFromSnapshot', () => {
  it('delegates to PointsHoldService.quoteHoldFromSnapshot, reading the hold via the repository', async () => {
    const tx = createTx();
    tx.point_holds.findUnique.mockResolvedValue({
      id: 'hold-1',
      estimatedAmount: 100,
      pricingSnapshot: {
        schemaVersion: 1,
        modelConfigId: 'model-1',
        modelSchema: { terms: [{ id: 'base', op: 'add', const: 60 }] },
        taskFixedSchema: null,
        multiplier: 1,
        discountFactor: 1,
        discountCode: null,
        params: {},
      },
    });
    const service = buildPointsService(createPrisma(tx));

    const result = await service.quoteHoldFromSnapshot('hold-1', {});

    expect(tx.point_holds.findUnique).toHaveBeenCalledWith({ where: { id: 'hold-1' } });
    expect(result).toBe(60);
  });

  it('propagates the BadRequestException for a missing hold instead of returning a fallback price', async () => {
    const tx = createTx();
    tx.point_holds.findUnique.mockResolvedValue(null);
    const service = buildPointsService(createPrisma(tx));

    await expect(service.quoteHoldFromSnapshot('missing', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('PointsService.estimateCost — new engine', () => {
  it('delegates to TaskPricingEstimatorService with the new input shape', async () => {
    const estimateCost = vi.fn().mockResolvedValue({
      estimatedCost: 90,
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      breakdown: [],
      pricingSnapshot: {} as never,
    });
    const service = buildPointsServiceWithTaskPricing({ estimateCost } as never);

    const result = await service.estimateCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'medium' },
    });

    expect(estimateCost).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'medium' },
    });
    expect(result.estimatedCost).toBe(90);
  });

  it('propagates the BadRequestException thrown by the new engine instead of returning a fallback price', async () => {
    const estimateCost = vi
      .fn()
      .mockRejectedValue(new BadRequestException('模型未配置计价规则(pricingSchema): model-1'));
    const service = buildPointsServiceWithTaskPricing({ estimateCost } as never);

    await expect(
      service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

});
