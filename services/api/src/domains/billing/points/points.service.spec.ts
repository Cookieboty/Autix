import { BadRequestException } from '@nestjs/common';
import {
  PointGrantType,
  PointHoldStatus,
  PointLedgerEventType,
  PointsSource,
  PricingBaseUnit,
  PricingComponentType,
  Prisma,
  type generation_pricing_rule_components,
} from '../../platform/prisma/generated';
import { PointsService } from './points.service';
import { PointsRepository } from './repositories/points.repository';
import { PricingRuleRepository } from './repositories/pricing-rule.repository';
import { PointsLedgerService } from './services/points-ledger.service';
import { PointsHoldService } from './services/points-hold.service';
import { PricingEstimatorService } from './services/pricing-estimator.service';
import type { PricingRuleWithComponents } from './pricing-estimator';

function buildPointsService(prisma: unknown) {
  const pointsRepo = new PointsRepository(prisma as never);
  const pricingRuleRepo = new PricingRuleRepository(prisma as never);
  const ledgerService = new PointsLedgerService(pointsRepo);
  const holdService = new PointsHoldService(pointsRepo, ledgerService);
  const pricingService = new PricingEstimatorService(pricingRuleRepo);
  return new PointsService(pointsRepo, ledgerService, holdService, pricingService);
}

function createTx() {
  return {
    user_points: {
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ balance: 0 }),
    },
    points_records: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn(),
    },
    point_grants: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    point_holds: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    point_hold_items: {
      create: jest.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createTx>) {
  return {
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    generation_pricing_rules: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

function pricingRule(
  overrides: Partial<PricingRuleWithComponents> = {},
): PricingRuleWithComponents {
  return {
    id: 'rule-1',
    taskType: 'chat',
    name: 'Chat',
    baseUnit: PricingBaseUnit.message,
    priority: 0,
    conditions: null,
    refundPolicy: null,
    metadata: null,
    isActive: true,
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    components: [],
    ...overrides,
  };
}

function pricingComponent(
  componentType: PricingComponentType,
  values: Partial<generation_pricing_rule_components> = {},
): generation_pricing_rule_components {
  return {
    id: `component-${componentType}`,
    ruleId: 'rule-1',
    componentType,
    unitCost: null,
    multiplier: null,
    config: null,
    sort: 10,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...values,
  };
}

function amountComponent(
  componentType: PricingComponentType,
  unitCost: number,
  sort = 10,
) {
  return pricingComponent(componentType, {
    unitCost: new Prisma.Decimal(unitCost),
    sort,
  });
}

function multiplierComponent(
  componentType: PricingComponentType,
  multiplier: number,
  sort = 100,
) {
  return pricingComponent(componentType, {
    multiplier: new Prisma.Decimal(multiplier),
    sort,
  });
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
      where: { id: 'gift', availableAmount: { gte: 20 } },
      data: {
        availableAmount: { decrement: 20 },
        consumedAmount: { increment: 20 },
      },
    });
    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'purchased', availableAmount: { gte: 40 } },
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
      where: { id: 'gift', availableAmount: { gte: 30 } },
      data: {
        availableAmount: { decrement: 30 },
        frozenAmount: { increment: 30 },
      },
    });
    expect(tx.point_grants.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'sub', availableAmount: { gte: 30 } },
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
      where: { id: 'purchased', availableAmount: { gte: 100 } },
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

describe('PointsService.estimateCost', () => {
  it('estimates chat cost from base and token pricing', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      pricingRule({
        id: 'rule-chat',
        taskType: 'chat_message_fast',
        name: '普通快速对话',
        conditions: { modelTier: 'fast' },
        baseUnit: PricingBaseUnit.message,
        components: [
          amountComponent(PricingComponentType.base, 1, 10),
          amountComponent(PricingComponentType.input_token_per_1k, 0.5, 20),
          amountComponent(PricingComponentType.output_token_per_1k, 2, 30),
        ],
      }),
    ]);
    const service = buildPointsService(prisma);

    const estimate = await service.estimateCost({
      taskType: 'chat_message_fast',
      modelTier: 'fast',
      inputTokens: 500,
      outputTokens: 800,
    });

    expect(estimate.estimatedCost).toBe(3);
    expect(estimate.items).toEqual([
      { label: PricingComponentType.base, amount: 1 },
      { label: PricingComponentType.input_token_per_1k, amount: 0.25 },
      { label: PricingComponentType.output_token_per_1k, amount: 1.6 },
    ]);
  });

  it('estimates video cost by seconds', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      pricingRule({
        id: 'rule-video',
        taskType: 'video_generation',
        name: 'Seedance 720p',
        conditions: { resolution: '720p' },
        baseUnit: PricingBaseUnit.second,
        components: [
          amountComponent(PricingComponentType.per_second, 320, 10),
        ],
      }),
    ]);
    const service = buildPointsService(prisma);

    const estimate = await service.estimateCost({
      taskType: 'video_generation',
      resolution: '720p',
      seconds: 5,
    });

    expect(estimate.estimatedCost).toBe(1600);
  });

  it('uses the more specific video template rule when template usage is present', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      pricingRule({
        id: 'rule-video',
        taskType: 'video_generation',
        name: 'Video 720p',
        conditions: { resolution: '720p' },
        baseUnit: PricingBaseUnit.second,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        components: [
          amountComponent(PricingComponentType.per_second, 320, 10),
        ],
      }),
      pricingRule({
        id: 'rule-video-template',
        taskType: 'video_generation',
        name: 'Video template 720p',
        conditions: { resolution: '720p', usesTemplate: true },
        baseUnit: PricingBaseUnit.second,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        components: [
          amountComponent(PricingComponentType.per_second, 500, 10),
        ],
      }),
    ]);
    const service = buildPointsService(prisma);

    const estimate = await service.estimateCost({
      taskType: 'video_generation',
      resolution: '720p',
      seconds: 5,
      usesTemplate: true,
    });

    expect(estimate.taskType).toBe('video_generation');
    expect(estimate.estimatedCost).toBe(2500);
    expect(estimate.pricingSnapshot).toMatchObject({ ruleId: 'rule-video-template' });
  });

  it('throws when no active pricing rule is configured', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([]);
    const service = buildPointsService(prisma);

    await expect(
      service.estimateCost({ taskType: 'missing_rule' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('charges image quantity from per-image components', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      pricingRule({
        id: 'rule-image',
        taskType: 'image_gen',
        name: '图片生成',
        baseUnit: PricingBaseUnit.image,
        components: [
          amountComponent(PricingComponentType.per_image, 10, 10),
          amountComponent(PricingComponentType.fixed_extra, 5, 20),
        ],
      }),
    ]);
    const service = buildPointsService(prisma);

    const estimate = await service.estimateCost({ taskType: 'image_gen', quantity: 3 });

    expect(estimate.estimatedCost).toBe(35);
    expect(estimate.items).toEqual([
      { label: PricingComponentType.per_image, amount: 30 },
      { label: PricingComponentType.fixed_extra, amount: 5 },
    ]);
  });

  it('keeps per-second and fixed components together', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      pricingRule({
        id: 'rule-sec',
        taskType: 'tts',
        name: 'TTS',
        baseUnit: PricingBaseUnit.second,
        components: [
          amountComponent(PricingComponentType.per_second, 2, 10),
          amountComponent(PricingComponentType.fixed_extra, 4, 20),
        ],
      }),
    ]);
    const service = buildPointsService(prisma);

    const estimate = await service.estimateCost({ taskType: 'tts', seconds: 5 });

    expect(estimate.items).toEqual([
      { label: PricingComponentType.per_second, amount: 10 },
      { label: PricingComponentType.fixed_extra, amount: 4 },
    ]);
    expect(estimate.estimatedCost).toBe(14);
  });

  it('stacks multiple multipliers multiplicatively', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      pricingRule({
        id: 'rule-stack',
        taskType: 'reasoning_chat',
        name: '深度推理',
        baseUnit: PricingBaseUnit.message,
        components: [
          amountComponent(PricingComponentType.base, 10, 10),
          multiplierComponent(PricingComponentType.reasoning_multiplier, 2, 100),
          multiplierComponent(PricingComponentType.reference_image_multiplier, 1.5, 110),
          multiplierComponent(PricingComponentType.priority_multiplier, 2, 120),
        ],
      }),
    ]);
    const service = buildPointsService(prisma);

    const estimate = await service.estimateCost({
      taskType: 'reasoning_chat',
      referenceImages: 1,
      priority: true,
    });

    expect(estimate.multiplier).toBeCloseTo(6, 5);
    expect(estimate.estimatedCost).toBe(60);
  });

  it('rejects when membershipLevel does not match conditions', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      pricingRule({
        id: 'rule-vip-only',
        taskType: 'premium_task',
        name: 'VIP 专属',
        baseUnit: PricingBaseUnit.message,
        conditions: { membershipLevel: { in: [2, 3] } },
        components: [amountComponent(PricingComponentType.base, 1, 10)],
      }),
    ]);
    const service = buildPointsService(prisma);

    await expect(
      service.estimateCost({ taskType: 'premium_task', membershipLevel: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when grantType is excluded by conditions', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      pricingRule({
        id: 'rule-no-gift',
        taskType: 'premium_task',
        name: '禁赠送',
        baseUnit: PricingBaseUnit.message,
        conditions: { grantType: { notIn: [PointGrantType.GIFT] } },
        components: [amountComponent(PricingComponentType.base, 1, 10)],
      }),
    ]);
    const service = buildPointsService(prisma);

    await expect(
      service.estimateCost({
        taskType: 'premium_task',
        grantType: PointGrantType.GIFT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PointsService.previewPricingRule', () => {
  it('warns when a matched rule has no active components', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    const rule = pricingRule({
      id: 'rule-empty',
      taskType: 'empty_task',
      name: '空组件规则',
      components: [],
    });
    prisma.generation_pricing_rules.findMany.mockResolvedValue([rule]);
    prisma.generation_pricing_rules.findUnique.mockResolvedValue(rule);
    const service = buildPointsService(prisma);

    const preview = await service.previewPricingRule({ taskType: 'empty_task' });

    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NO_COMPONENTS', field: 'components' }),
        expect.objectContaining({ code: 'ZERO_ESTIMATED_COST' }),
      ]),
    );
  });

  it('validates component costs and multipliers in preview warnings', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    const rule = pricingRule({
      id: 'rule-invalid-components',
      taskType: 'invalid_components',
      name: '非法组件规则',
      components: [
        pricingComponent(PricingComponentType.base, {
          unitCost: new Prisma.Decimal(-1),
          sort: 10,
        }),
        pricingComponent(PricingComponentType.priority_multiplier, {
          multiplier: new Prisma.Decimal(-2),
          sort: 20,
        }),
      ],
    });
    prisma.generation_pricing_rules.findMany.mockResolvedValue([rule]);
    prisma.generation_pricing_rules.findUnique.mockResolvedValue(rule);
    const service = buildPointsService(prisma);

    const preview = await service.previewPricingRule({
      taskType: 'invalid_components',
      priority: true,
    });

    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_COMPONENT_UNIT_COST',
          field: `components.${PricingComponentType.base}.unitCost`,
        }),
        expect.objectContaining({
          code: 'INVALID_COMPONENT_MULTIPLIER',
          field: `components.${PricingComponentType.priority_multiplier}.multiplier`,
        }),
      ]),
    );
  });
});
