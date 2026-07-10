import { BadRequestException } from '@nestjs/common';
import { TasksController } from './tasks.controller';

describe('TasksController.listTasks / listModels', () => {
  it('listTasks delegates to TasksService', async () => {
    const tasksService = { listTasks: jest.fn().mockResolvedValue([{ taskType: 'image_generation' }]) };
    const controller = new TasksController(tasksService as never, {} as never, {} as never);

    expect(await controller.listTasks()).toEqual([{ taskType: 'image_generation' }]);
  });

  it('listModels resolves the caller (optional) and the Accept-Language locale before delegating', async () => {
    const tasksService = { listModelsForTask: jest.fn().mockResolvedValue([]) };
    const controller = new TasksController(tasksService as never, {} as never, {} as never);

    await controller.listModels('image_generation', { id: 'user-1' } as never, 'zh-CN,zh;q=0.9');

    expect(tasksService.listModelsForTask).toHaveBeenCalledWith('image_generation', {
      userId: 'user-1',
      locale: 'zh-CN',
    });
  });

  it('listModels passes userId: undefined for an anonymous caller and defaults locale to en', async () => {
    const tasksService = { listModelsForTask: jest.fn().mockResolvedValue([]) };
    const controller = new TasksController(tasksService as never, {} as never, {} as never);

    await controller.listModels('image_generation', undefined, undefined);

    expect(tasksService.listModelsForTask).toHaveBeenCalledWith('image_generation', {
      userId: undefined,
      locale: 'en',
    });
  });
});

describe('TasksController.quote', () => {
  it('resolves the caller membership level before estimating', async () => {
    const estimateCost = jest.fn().mockResolvedValue({ estimatedCost: 1, breakdown: [], pricingSnapshot: {} });
    const membershipService = { resolveActiveMembershipLevel: jest.fn().mockResolvedValue(2) };
    const controller = new TasksController(
      {} as never,
      { estimateCost } as never,
      membershipService as never,
    );

    await controller.quote('image_generation', { params: {} } as never, { id: 'user-1' } as never);

    expect(membershipService.resolveActiveMembershipLevel).toHaveBeenCalledWith('user-1');
    expect(estimateCost).toHaveBeenCalledWith(expect.objectContaining({ membershipLevel: 2 }));
  });

  it('defaults to membershipLevel 0 for anonymous callers', async () => {
    const estimateCost = jest.fn().mockResolvedValue({ estimatedCost: 1, breakdown: [], pricingSnapshot: {} });
    const membershipService = { resolveActiveMembershipLevel: jest.fn() };
    const controller = new TasksController(
      {} as never,
      { estimateCost } as never,
      membershipService as never,
    );

    await controller.quote('image_generation', { params: {} } as never, undefined);

    expect(membershipService.resolveActiveMembershipLevel).not.toHaveBeenCalled();
    expect(estimateCost).toHaveBeenCalledWith(expect.objectContaining({ membershipLevel: 0 }));
  });

  it('returns total/breakdown/snapshot mapped from PointsService.estimateCost, and forwards modelConfigId/params/usage', async () => {
    const snapshot = { schemaVersion: 1, modelConfigId: 'model-1' };
    const estimateCost = jest.fn().mockResolvedValue({
      estimatedCost: 42,
      breakdown: [{ id: 'base', amount: 42 }],
      pricingSnapshot: snapshot,
    });
    const membershipService = { resolveActiveMembershipLevel: jest.fn().mockResolvedValue(0) };
    const controller = new TasksController(
      {} as never,
      { estimateCost } as never,
      membershipService as never,
    );

    const result = await controller.quote(
      'image_generation',
      { modelConfigId: 'model-1', params: { quality: 'high' }, usage: { inputTokens: 10 } } as never,
      undefined,
    );

    expect(estimateCost).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'high' },
      usage: { inputTokens: 10 },
      membershipLevel: 0,
    });
    expect(result).toEqual({ total: 42, breakdown: [{ id: 'base', amount: 42 }], snapshot });
  });

  it('never creates a hold — quote is display-only pricing, not a real charge', async () => {
    const createHold = jest.fn();
    const pointsService = {
      estimateCost: jest.fn().mockResolvedValue({ estimatedCost: 1, breakdown: [], pricingSnapshot: {} }),
      createHold,
    };
    const membershipService = { resolveActiveMembershipLevel: jest.fn().mockResolvedValue(0) };
    const controller = new TasksController({} as never, pointsService as never, membershipService as never);

    await controller.quote('image_generation', { params: {} } as never, undefined);

    expect(createHold).not.toHaveBeenCalled();
  });

  it('propagates a pricing rejection (invalid params, unknown task, missing binding) as-is — no invented price', async () => {
    const rejection = new BadRequestException({ message: '参数不合法', violations: ['quality'] });
    const estimateCost = jest.fn().mockRejectedValue(rejection);
    const membershipService = { resolveActiveMembershipLevel: jest.fn().mockResolvedValue(0) };
    const controller = new TasksController(
      {} as never,
      { estimateCost } as never,
      membershipService as never,
    );

    await expect(
      controller.quote('image_generation', { params: { quality: 'invalid' } } as never, undefined),
    ).rejects.toBe(rejection);
  });
});
