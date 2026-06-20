import { BadRequestException } from '@nestjs/common';
import { CallBillingService, InsufficientPointsError } from './call-billing.service';

function createRepository() {
  return {
    findUserPoints: jest.fn(),
    findPendingAgentCallPointRecords: jest.fn(),
    findPointHold: jest.fn().mockResolvedValue(null),
  };
}

function createPointsService() {
  return {
    estimateCost: jest.fn(),
    createHold: jest.fn(),
    confirmHold: jest.fn(),
    refundHold: jest.fn(),
  };
}

describe('CallBillingService', () => {
  it('delegates hold to points ledger and returns ledger hold id', async () => {
    const repository = createRepository();
    const points = createPointsService();
    points.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 30 });
    const service = new CallBillingService(repository as never, points as never);

    const { holdId, balance } = await service.hold('u1', 70, {
      runId: 'run-1',
      modelName: 'Fast',
    });

    expect(points.createHold).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        taskType: 'agent_call',
        taskId: 'run-1',
        amount: 70,
      }),
    );
    expect(holdId).toBe('hold-1');
    expect(balance).toBe(30);
  });

  it('uses a custom ledger remark when provided', async () => {
    const repository = createRepository();
    const points = createPointsService();
    points.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 85 });
    const service = new CallBillingService(repository as never, points as never);

    await service.hold('u1', 15, {
      modelName: 'gpt-4o-mini',
      remark: 'Artifact 文档 AI 优化 · openai-official/gpt-4o-mini',
    });

    expect(points.createHold).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        remark: 'Artifact 文档 AI 优化 · openai-official/gpt-4o-mini',
      }),
    );
  });

  it('estimates chat points from configurable pricing rules before creating a hold', async () => {
    const repository = createRepository();
    const points = createPointsService();
    points.estimateCost.mockResolvedValue({
      estimatedCost: 8,
      taskType: 'chat_message_standard',
      pricingSnapshot: { ruleId: 'rule-chat' },
      refundPolicy: { systemFailed: 'full_refund' },
    });
    points.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 92 });
    const service = new CallBillingService(repository as never, points as never);

    const result = await service.hold('u1', 70, {
      runId: 'run-1',
      modelConfigId: 'model-1',
      modelName: 'gpt-4o',
      pricing: {
        taskType: 'chat_message_standard',
        modelProvider: 'openai-official',
        modelName: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      },
    });

    expect(points.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'chat_message_standard',
        inputTokens: 1000,
        outputTokens: 500,
      }),
    );
    expect(points.createHold).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        taskType: 'chat_message_standard',
        amount: 8,
        pricingSnapshot: { ruleId: 'rule-chat' },
      }),
    );
    expect(result).toEqual({ holdId: 'hold-1', balance: 92 });
  });

  it('throws InsufficientPointsError when ledger rejects for insufficient points', async () => {
    const repository = createRepository();
    const points = createPointsService();
    points.createHold.mockRejectedValue(new BadRequestException('积分余额不足'));
    repository.findUserPoints.mockResolvedValue({ balance: 10 });
    const service = new CallBillingService(repository as never, points as never);

    await expect(service.hold('u1', 70, {})).rejects.toBeInstanceOf(
      InsufficientPointsError,
    );
  });

  it('delegates confirm and refund to points ledger', async () => {
    const repository = createRepository();
    const points = createPointsService();
    const service = new CallBillingService(repository as never, points as never);

    await service.confirm('hold-1');
    await service.refund('hold-1');

    expect(points.confirmHold).toHaveBeenCalledWith('hold-1');
    expect(points.refundHold).toHaveBeenCalledWith('hold-1', 'agent call failed');
  });

  it('confirms with actual chat token cost when usage metadata is available', async () => {
    const repository = createRepository();
    const points = createPointsService();
    points.estimateCost.mockResolvedValue({
      estimatedCost: 5,
      taskType: 'chat_message_fast',
      pricingSnapshot: { ruleId: 'rule-fast' },
    });
    repository.findPointHold.mockResolvedValue({ estimatedAmount: 10 });
    const service = new CallBillingService(repository as never, points as never);

    await service.confirm('hold-1', {
      taskType: 'chat_message_fast',
      inputTokens: 400,
      outputTokens: 300,
    });

    expect(points.confirmHold).toHaveBeenCalledWith('hold-1', 5);
  });

  it('caps actual confirmation at the frozen estimate', async () => {
    const repository = createRepository();
    const points = createPointsService();
    points.estimateCost
      .mockResolvedValueOnce({
        estimatedCost: 8,
        taskType: 'chat_message_standard',
        pricingSnapshot: { ruleId: 'estimate' },
      })
      .mockResolvedValueOnce({
        estimatedCost: 20,
        taskType: 'chat_message_standard',
        pricingSnapshot: { ruleId: 'actual' },
      });
    points.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 92 });
    repository.findPointHold.mockResolvedValue({ estimatedAmount: 8 });
    const service = new CallBillingService(repository as never, points as never);

    await service.hold('u1', 70, {
      pricing: { taskType: 'chat_message_standard' },
    });
    await service.confirm('hold-1', {
      taskType: 'chat_message_standard',
      inputTokens: 10_000,
      outputTokens: 5_000,
    });

    expect(points.confirmHold).toHaveBeenCalledWith('hold-1', 8);
  });

  it('confirms the frozen estimate when actual usage pricing is temporarily unavailable', async () => {
    const repository = createRepository();
    const points = createPointsService();
    points.estimateCost
      .mockResolvedValueOnce({
        estimatedCost: 8,
        taskType: 'chat_message_standard',
        pricingSnapshot: { ruleId: 'estimate' },
      })
      .mockRejectedValueOnce(new BadRequestException('未配置计费规则'));
    points.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 92 });
    repository.findPointHold.mockResolvedValue({ estimatedAmount: 8 });
    const service = new CallBillingService(repository as never, points as never);

    await service.hold('u1', 70, {
      pricing: { taskType: 'chat_message_standard' },
    });
    await service.confirm('hold-1', {
      taskType: 'chat_message_standard',
      inputTokens: 400,
      outputTokens: 300,
    });

    expect(points.confirmHold).toHaveBeenCalledWith('hold-1');
  });
});
