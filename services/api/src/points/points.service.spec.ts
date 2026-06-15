import { BadRequestException } from '@nestjs/common';
import {
  PointGrantType,
  PointHoldStatus,
  PointLedgerEventType,
  PointsSource,
} from '../prisma/generated';
import { PointsService } from './points.service';

function createTx() {
  return {
    user_points: {
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
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
    },
  };
}

describe('PointsService.deductPoints (atomic legacy compatibility)', () => {
  it('deducts via guarded conditional update and records CONSUME', async () => {
    const tx = createTx();
    tx.user_points.updateMany.mockResolvedValue({ count: 1 });
    tx.user_points.findUniqueOrThrow.mockResolvedValue({ balance: 40 });
    const service = new PointsService(createPrisma(tx) as never);

    const balance = await service.deductPoints(
      'u1',
      60,
      PointsSource.TASK,
      undefined,
      'remark',
    );

    expect(tx.user_points.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', balance: { gte: 60 } },
      data: {
        balance: { decrement: 60 },
        availableBalance: { decrement: 60 },
        totalBalance: { decrement: 60 },
      },
    });
    expect(tx.points_records.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'CONSUME', amount: 60, balance: 40 }),
      }),
    );
    expect(balance).toBe(40);
  });

  it('rejects (no record) when guarded update affects no rows', async () => {
    const tx = createTx();
    tx.user_points.updateMany.mockResolvedValue({ count: 0 });
    const service = new PointsService(createPrisma(tx) as never);

    await expect(
      service.deductPoints('u1', 60, PointsSource.TASK),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.points_records.create).not.toHaveBeenCalled();
  });
});

describe('PointsService grant and hold ledger', () => {
  it('grants points into a batch and updates split balances', async () => {
    const tx = createTx();
    tx.point_grants.create.mockResolvedValue({ id: 'grant-1' });
    tx.user_points.upsert.mockResolvedValue({ balance: 100 });
    const service = new PointsService(createPrisma(tx) as never);

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
    tx.user_points.update.mockResolvedValue({ balance: 60 });
    const service = new PointsService(createPrisma(tx) as never);

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
    const service = new PointsService(createPrisma(tx) as never);

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
        usageScope: { excludedTaskPrefixes: ['seedance_'] },
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
    tx.user_points.update.mockResolvedValue({ balance: 120 });
    const service = new PointsService(createPrisma(tx) as never);

    await service.createHold('u1', {
      taskType: 'seedance_720p',
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
    // 邀请奖励发放：usageScope 只允许 image_generation/chat 等，明确不含 seedance_*
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
    const service = new PointsService(createPrisma(tx) as never);

    await expect(
      service.createHold('u1', {
        taskType: 'seedance_720p',
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
    const service = new PointsService(createPrisma(tx) as never);

    await expect(
      service.createHold('u1', {
        taskType: 'image_generation',
        taskId: 'gen-1',
        amount: 60,
      }),
    ).rejects.toThrow(/INSUFFICIENT_GRANT/);
    expect(tx.point_hold_items.create).not.toHaveBeenCalled();
    expect(tx.user_points.update).not.toHaveBeenCalled();
  });

  it('confirms a hold and refunds unused frozen points', async () => {
    const tx = createTx();
    tx.point_holds.findUnique.mockResolvedValue({
      id: 'hold-1',
      userId: 'u1',
      taskType: 'video_generation',
      taskId: 'gen-1',
      estimatedAmount: 100,
      status: PointHoldStatus.PENDING,
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
    tx.user_points.update.mockResolvedValue({ balance: 20 });
    tx.point_holds.update.mockResolvedValue({ id: 'hold-1', status: PointHoldStatus.PARTIALLY_REFUNDED });
    const service = new PointsService(createPrisma(tx) as never);

    const result = await service.confirmHold('hold-1', 80);

    expect(tx.point_grants.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'gift' },
      data: {
        frozenAmount: { decrement: 40 },
        consumedAmount: { increment: 40 },
        availableAmount: undefined,
      },
    });
    expect(tx.point_grants.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'sub' },
      data: {
        frozenAmount: { decrement: 60 },
        consumedAmount: { increment: 40 },
        availableAmount: { increment: 20 },
      },
    });
    expect(tx.user_points.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: expect.objectContaining({
        frozenBalance: { decrement: 100 },
        availableBalance: { increment: 20 },
        balance: { increment: 20 },
        totalBalance: { decrement: 80 },
        giftBalance: { decrement: 40 },
        subscriptionBalance: { decrement: 40 },
      }),
    });
    expect(result.confirmed).toBe(true);
  });
});

describe('PointsService.estimateCost', () => {
  it('estimates chat cost from base and token pricing', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      {
        id: 'rule-chat',
        taskType: 'chat_message_fast',
        name: '普通快速对话',
        modelProvider: null,
        modelName: null,
        quality: null,
        resolution: null,
        modelTier: 'fast',
        baseUnit: 'message',
        baseCost: 1,
        fixedExtraCost: 0,
        inputTokenCostPerK: 0.5,
        outputTokenCostPerK: 2,
        contextTokenCostPerK: null,
        reasoningMultiplier: 1,
        toolCallCost: null,
        batchUnitCost: null,
        referenceImageFixedCost: null,
        referenceImageMultiplier: null,
        videoInputMultiplier: null,
        audioInputMultiplier: null,
        priorityMultiplier: null,
        refundPolicy: null,
        minDurationSeconds: null,
        maxDurationSeconds: null,
      },
    ]);
    const service = new PointsService(prisma as never);

    const estimate = await service.estimateCost({
      taskType: 'chat_message_fast',
      modelTier: 'fast',
      inputTokens: 500,
      outputTokens: 800,
    });

    expect(estimate.estimatedCost).toBe(4);
    expect(estimate.items).toEqual([
      { label: 'baseCost', amount: 1 },
      { label: 'inputTokens', amount: 1 },
      { label: 'outputTokens', amount: 2 },
    ]);
  });

  it('estimates video cost by seconds', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      {
        id: 'rule-video',
        taskType: 'seedance_720p',
        name: 'Seedance 720p',
        modelProvider: null,
        modelName: null,
        quality: null,
        resolution: '720p',
        modelTier: null,
        baseUnit: 'second',
        baseCost: 320,
        fixedExtraCost: 0,
        inputTokenCostPerK: null,
        outputTokenCostPerK: null,
        contextTokenCostPerK: null,
        reasoningMultiplier: 1,
        toolCallCost: null,
        batchUnitCost: null,
        referenceImageFixedCost: null,
        referenceImageMultiplier: null,
        videoInputMultiplier: null,
        audioInputMultiplier: null,
        priorityMultiplier: null,
        refundPolicy: null,
        minDurationSeconds: null,
        maxDurationSeconds: null,
      },
    ]);
    const service = new PointsService(prisma as never);

    const estimate = await service.estimateCost({
      taskType: 'seedance_720p',
      resolution: '720p',
      seconds: 5,
    });

    expect(estimate.estimatedCost).toBe(1600);
  });

  it('throws when no active pricing rule is configured', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([]);
    const service = new PointsService(prisma as never);

    await expect(
      service.estimateCost({ taskType: 'missing_rule' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('P1-2: image baseUnit charges baseCost * quantity (no double-counting baseCost)', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      {
        id: 'rule-image',
        taskType: 'image_gen',
        name: '图片生成',
        modelProvider: null,
        modelName: null,
        quality: null,
        resolution: null,
        modelTier: null,
        baseUnit: 'image',
        baseCost: 10,
        fixedExtraCost: 5,
        inputTokenCostPerK: null,
        outputTokenCostPerK: null,
        contextTokenCostPerK: null,
        reasoningMultiplier: 1,
        toolCallCost: null,
        batchUnitCost: null,
        referenceImageFixedCost: null,
        referenceImageMultiplier: null,
        videoInputMultiplier: null,
        audioInputMultiplier: null,
        priorityMultiplier: null,
        refundPolicy: null,
        minDurationSeconds: null,
        maxDurationSeconds: null,
      },
    ]);
    const service = new PointsService(prisma as never);

    const estimate = await service.estimateCost({ taskType: 'image_gen', quantity: 3 });

    // baseCost*quantity = 30；fixedExtraCost = 5；不应再额外计入 baseCost
    expect(estimate.estimatedCost).toBe(35);
    expect(estimate.items).toEqual([
      { label: 'imageQuantity', amount: 30 },
      { label: 'fixedExtraCost', amount: 5 },
    ]);
  });

  it('P1-2: second baseUnit no longer wipes prior items and keeps fixedExtraCost', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      {
        id: 'rule-sec',
        taskType: 'tts',
        name: 'TTS',
        modelProvider: null,
        modelName: null,
        quality: null,
        resolution: null,
        modelTier: null,
        baseUnit: 'second',
        baseCost: 2,
        fixedExtraCost: 4,
        inputTokenCostPerK: null,
        outputTokenCostPerK: null,
        contextTokenCostPerK: null,
        reasoningMultiplier: 1,
        toolCallCost: null,
        batchUnitCost: null,
        referenceImageFixedCost: null,
        referenceImageMultiplier: null,
        videoInputMultiplier: null,
        audioInputMultiplier: null,
        priorityMultiplier: null,
        refundPolicy: null,
        minDurationSeconds: null,
        maxDurationSeconds: null,
      },
    ]);
    const service = new PointsService(prisma as never);

    const estimate = await service.estimateCost({ taskType: 'tts', seconds: 5 });

    expect(estimate.items).toEqual([
      { label: 'seconds', amount: 10 },
      { label: 'fixedExtraCost', amount: 4 },
    ]);
    expect(estimate.estimatedCost).toBe(14);
  });

  it('P1-2: stacks multiple multipliers multiplicatively (reasoning * reference * priority)', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      {
        id: 'rule-stack',
        taskType: 'reasoning_chat',
        name: '深度推理',
        modelProvider: null,
        modelName: null,
        quality: null,
        resolution: null,
        modelTier: null,
        baseUnit: 'message',
        baseCost: 10,
        fixedExtraCost: 0,
        inputTokenCostPerK: null,
        outputTokenCostPerK: null,
        contextTokenCostPerK: null,
        reasoningMultiplier: 2,
        toolCallCost: null,
        batchUnitCost: null,
        referenceImageFixedCost: null,
        referenceImageMultiplier: 1.5,
        videoInputMultiplier: null,
        audioInputMultiplier: null,
        priorityMultiplier: 2,
        refundPolicy: null,
        minDurationSeconds: null,
        maxDurationSeconds: null,
      },
    ]);
    const service = new PointsService(prisma as never);

    const estimate = await service.estimateCost({
      taskType: 'reasoning_chat',
      referenceImages: 1,
      priority: true,
    });

    // subtotal=10 + refImage(0)+...，multiplier=2*1.5*2=6 -> 10*6=60
    expect(estimate.multiplier).toBeCloseTo(6, 5);
    expect(estimate.estimatedCost).toBe(60);
  });

  it('P1-2: rejects when membershipLevel is not in allowedMembershipLevels', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      {
        id: 'rule-vip-only',
        taskType: 'premium_task',
        name: 'VIP 专属',
        modelProvider: null,
        modelName: null,
        quality: null,
        resolution: null,
        modelTier: null,
        baseUnit: 'message',
        baseCost: 1,
        fixedExtraCost: 0,
        inputTokenCostPerK: null,
        outputTokenCostPerK: null,
        contextTokenCostPerK: null,
        reasoningMultiplier: 1,
        toolCallCost: null,
        batchUnitCost: null,
        referenceImageFixedCost: null,
        referenceImageMultiplier: null,
        videoInputMultiplier: null,
        audioInputMultiplier: null,
        priorityMultiplier: null,
        refundPolicy: null,
        minDurationSeconds: null,
        maxDurationSeconds: null,
        allowedMembershipLevels: [2, 3],
        disallowedGrantTypes: [],
      },
    ]);
    const service = new PointsService(prisma as never);

    await expect(
      service.estimateCost({ taskType: 'premium_task', membershipLevel: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('P1-2: rejects when grantType is in disallowedGrantTypes', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.generation_pricing_rules.findMany.mockResolvedValue([
      {
        id: 'rule-no-gift',
        taskType: 'premium_task',
        name: '禁赠送',
        modelProvider: null,
        modelName: null,
        quality: null,
        resolution: null,
        modelTier: null,
        baseUnit: 'message',
        baseCost: 1,
        fixedExtraCost: 0,
        inputTokenCostPerK: null,
        outputTokenCostPerK: null,
        contextTokenCostPerK: null,
        reasoningMultiplier: 1,
        toolCallCost: null,
        batchUnitCost: null,
        referenceImageFixedCost: null,
        referenceImageMultiplier: null,
        videoInputMultiplier: null,
        audioInputMultiplier: null,
        priorityMultiplier: null,
        refundPolicy: null,
        minDurationSeconds: null,
        maxDurationSeconds: null,
        allowedMembershipLevels: [],
        disallowedGrantTypes: ['GIFT'],
      },
    ]);
    const service = new PointsService(prisma as never);

    await expect(
      service.estimateCost({
        taskType: 'premium_task',
        grantType: PointGrantType.GIFT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
