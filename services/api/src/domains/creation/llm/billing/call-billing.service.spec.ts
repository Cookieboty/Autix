import { BadRequestException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
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

function createMembershipService() {
  return {
    resolveActiveMembershipLevel: jest.fn().mockResolvedValue(2),
  };
}

describe('CallBillingService', () => {
  it('holds using the estimated amount and estimated taskType from the pricing engine', async () => {
    const repository = createRepository();
    const points = createPointsService();
    const membership = createMembershipService();
    points.estimateCost.mockResolvedValue({
      estimatedCost: 8,
      taskType: 'chat_message_standard',
      modelConfigId: 'model-1',
      pricingSnapshot: { ruleId: 'rule-chat' },
    });
    points.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 92 });
    const service = new CallBillingService(repository as never, points as never, membership as never);

    const result = await service.hold('u1', 70, {
      runId: 'run-1',
      modelConfigId: 'model-1',
      modelName: 'gpt-4o',
      pricing: {
        taskType: 'chat_message_standard',
        modelConfigId: 'model-1',
        inputTokens: 1000,
        outputTokens: 500,
      },
    });

    expect(points.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'chat_message_standard',
        modelConfigId: 'model-1',
        params: {},
        usage: expect.objectContaining({ inputTokens: 1000, outputTokens: 500 }),
        membershipLevel: 2,
      }),
    );
    expect(points.createHold).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        taskType: 'chat_message_standard',
        taskId: 'run-1',
        amount: 8,
        pricingSnapshot: { ruleId: 'rule-chat' },
      }),
    );
    expect(result).toEqual({ holdId: 'hold-1', balance: 92 });
  });

  it('does not put refundPolicy on the createHold payload — the new engine has no such field', async () => {
    const repository = createRepository();
    const points = createPointsService();
    const membership = createMembershipService();
    points.estimateCost.mockResolvedValue({
      estimatedCost: 8,
      taskType: 'chat_message_standard',
      pricingSnapshot: { ruleId: 'rule-chat' },
    });
    points.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 92 });
    const service = new CallBillingService(repository as never, points as never, membership as never);

    await service.hold('u1', 0, { pricing: { taskType: 'chat_message_standard' } });

    const payload = points.createHold.mock.calls[0][1];
    expect(payload).not.toHaveProperty('refundPolicySnapshot');
  });

  it('uses a custom ledger remark when provided', async () => {
    const repository = createRepository();
    const points = createPointsService();
    const membership = createMembershipService();
    points.estimateCost.mockResolvedValue({
      estimatedCost: 15,
      taskType: 'chat_message_standard',
      pricingSnapshot: {},
    });
    points.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 85 });
    const service = new CallBillingService(repository as never, points as never, membership as never);

    await service.hold('u1', 15, {
      modelName: 'gpt-4o-mini',
      remark: 'Artifact 文档 AI 优化 · openai-official/gpt-4o-mini',
      pricing: { taskType: 'chat_message_standard' },
    });

    expect(points.createHold).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        remark: 'Artifact 文档 AI 优化 · openai-official/gpt-4o-mini',
      }),
    );
  });

  it('throws InsufficientPointsError when ledger rejects for insufficient points', async () => {
    const repository = createRepository();
    const points = createPointsService();
    const membership = createMembershipService();
    points.estimateCost.mockResolvedValue({
      estimatedCost: 70,
      taskType: 'chat_message_standard',
      pricingSnapshot: {},
    });
    points.createHold.mockRejectedValue(new BadRequestException('积分余额不足'));
    repository.findUserPoints.mockResolvedValue({ balance: 10 });
    const service = new CallBillingService(repository as never, points as never, membership as never);

    await expect(
      service.hold('u1', 70, { pricing: { taskType: 'chat_message_standard' } }),
    ).rejects.toBeInstanceOf(InsufficientPointsError);
  });

  it('delegates confirm and refund to points ledger', async () => {
    const repository = createRepository();
    const points = createPointsService();
    const membership = createMembershipService();
    const service = new CallBillingService(repository as never, points as never, membership as never);

    await service.confirm('hold-1');
    await service.refund('hold-1');

    expect(points.confirmHold).toHaveBeenCalledWith('hold-1');
    expect(points.refundHold).toHaveBeenCalledWith('hold-1', 'agent call failed');
  });

  it('confirms with actual chat token cost when usage metadata is available', async () => {
    const repository = createRepository();
    const points = createPointsService();
    const membership = createMembershipService();
    points.estimateCost.mockResolvedValue({
      estimatedCost: 5,
      taskType: 'chat_message_standard',
      pricingSnapshot: { ruleId: 'rule-fast' },
    });
    repository.findPointHold.mockResolvedValue({ estimatedAmount: 10 });
    const service = new CallBillingService(repository as never, points as never, membership as never);

    await service.confirm('hold-1', {
      taskType: 'chat_message_standard',
      inputTokens: 400,
      outputTokens: 300,
    });

    expect(points.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'chat_message_standard',
        usage: expect.objectContaining({ inputTokens: 400, outputTokens: 300 }),
      }),
    );
    expect(points.confirmHold).toHaveBeenCalledWith('hold-1', 5);
  });

  it('caps actual confirmation at the frozen estimate', async () => {
    const repository = createRepository();
    const points = createPointsService();
    const membership = createMembershipService();
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
    const service = new CallBillingService(repository as never, points as never, membership as never);

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
    const membership = createMembershipService();
    points.estimateCost
      .mockResolvedValueOnce({
        estimatedCost: 8,
        taskType: 'chat_message_standard',
        pricingSnapshot: { ruleId: 'estimate' },
      })
      .mockRejectedValueOnce(new BadRequestException('未配置计费规则'));
    points.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 92 });
    repository.findPointHold.mockResolvedValue({ estimatedAmount: 8 });
    const service = new CallBillingService(repository as never, points as never, membership as never);

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

  describe('hold — no pointCostWeight fallback (Task 11)', () => {
    it('propagates the estimateCost error instead of falling back to a caller-supplied point amount', async () => {
      const repository = createRepository();
      const points = createPointsService();
      const membership = createMembershipService();
      points.estimateCost.mockRejectedValue(new BadRequestException('未配置任务: agent_call'));
      const service = new CallBillingService(repository as never, points as never, membership as never);

      await expect(
        service.hold('user-1', 42, { pricing: { taskType: 'agent_call' } }),
      ).rejects.toThrow(BadRequestException);
      expect(points.createHold).not.toHaveBeenCalled();
    });

    it('rejects when no taskType is supplied at all — there is no implicit "agent_call" default anymore', async () => {
      const repository = createRepository();
      const points = createPointsService();
      const membership = createMembershipService();
      const service = new CallBillingService(repository as never, points as never, membership as never);

      await expect(service.hold('user-1', 42, {})).rejects.toThrow(BadRequestException);
      expect(points.estimateCost).not.toHaveBeenCalled();
      expect(points.createHold).not.toHaveBeenCalled();
    });
  });

  describe('hold — misconfiguration is logged loudly before it propagates (Task 10, folded into Task 11)', () => {
    it('logs an error naming the taskType and the caught error, then rejects — log before rejection', async () => {
      const repository = createRepository();
      const points = createPointsService();
      const membership = createMembershipService();
      const failure = new BadRequestException('未配置计费规则');
      points.estimateCost.mockRejectedValue(failure);
      const service = new CallBillingService(repository as never, points as never, membership as never);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      let rejected = false;
      const pending = service
        .hold('user-1', 42, { pricing: { taskType: 'chat_message_reasoning' } })
        .catch(() => {
          rejected = true;
        });

      await pending;

      // The log call must be observable, and it must have happened — by the time
      // the promise settles it already has, since the catch block logs
      // synchronously before re-throwing.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('chat_message_reasoning'),
      );
      expect(rejected).toBe(true);

      errorSpy.mockRestore();
    });
  });
});
