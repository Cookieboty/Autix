import { BadRequestException } from '@nestjs/common';
import { ImageTemplatesService } from './image-templates.service';

function createMocks() {
  const template = {
    id: 'tpl-1',
    prompt: 'Make {{subject}}',
    title: 'Product',
    authorId: 'author-1',
  };
  const tx = {
    image_generations: {
      create: jest.fn(async (args: any) => ({ id: args.data.id, ...args.data })),
    },
    image_templates: {
      update: jest.fn(async () => ({})),
    },
  };
  const prisma = {
    image_templates: {
      findUnique: jest.fn(async () => template),
      update: jest.fn(),
    },
    resource_views: {
      count: jest.fn(async () => 0),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
  };
  const points = {
    estimateCost: jest.fn(async () => ({
      estimatedCost: 90,
      taskType: 'gpt_image_2_medium',
      pricingSnapshot: { ruleId: 'rule-image' },
      refundPolicy: { systemFailed: 'full_refund' },
    })),
    createHold: jest.fn(async () => ({ hold: { id: 'hold-1' }, balance: 910 })),
    confirmHold: jest.fn(),
    refundHold: jest.fn(),
  };
  const models = {
    getConfigForOrchestrator: jest.fn(),
  };
  const service = new ImageTemplatesService(
    prisma as never,
    {} as never,
    points as never,
    models as never,
  );
  return { service, prisma, tx, points, models };
}

describe('ImageTemplatesService.createGeneration billing', () => {
  it('freezes configurable template image points and confirms after record creation', async () => {
    const { service, points, tx } = createMocks();

    const gen = await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'gpt-image-2',
      variables: { subject: 'shoe' },
      referenceImage: 'https://img.test/ref.png',
    });

    expect(points.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'image_generation',
        modelName: 'gpt-image-2',
        quantity: 1,
        referenceImages: 1,
      }),
    );
    expect(points.createHold).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        taskType: 'gpt_image_2_medium',
        amount: 90,
        taskId: gen.id,
      }),
    );
    expect(tx.image_generations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: gen.id,
          resolvedPrompt: 'Make shoe',
        }),
      }),
    );
    expect(tx.image_templates.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { useCount: { increment: 1 } },
    });
    expect(points.confirmHold).toHaveBeenCalledWith('hold-1');
  });

  it('does not create a generation when point hold fails', async () => {
    const { service, points, tx } = createMocks();
    points.createHold.mockRejectedValue(new BadRequestException('积分余额不足'));

    await expect(
      service.createGeneration('tpl-1', 'u1', {
        modelUsed: 'gpt-image-2',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow('积分余额不足');

    expect(tx.image_generations.create).not.toHaveBeenCalled();
    expect(points.confirmHold).not.toHaveBeenCalled();
  });

  it('rejects generation when no pricing rule exists', async () => {
    const { service, points } = createMocks();
    points.estimateCost.mockRejectedValue(new BadRequestException('未配置计费规则'));

    await expect(
      service.createGeneration('tpl-1', 'u1', {
        modelUsed: 'gpt-image-2',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow('未配置计费规则');

    expect(points.createHold).not.toHaveBeenCalled();
  });
});
