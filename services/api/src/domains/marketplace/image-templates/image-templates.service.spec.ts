import { BadRequestException } from '@nestjs/common';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { ImageTemplatesService } from './image-templates.service';

interface BuildOverrides {
  pointsService?: Partial<{ estimateCost: jest.Mock }>;
}

function createMocks(overrides: BuildOverrides = {}) {
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
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      breakdown: [],
      pricingSnapshot: { ruleId: 'rule-image' },
    })),
    createHold: jest.fn(async (_userId: string, _input: unknown) => ({ hold: { id: 'hold-1' }, balance: 910 })),
    confirmHold: jest.fn(),
    refundHold: jest.fn(),
    ...overrides.pointsService,
  };
  const models = {
    getConfigForOrchestrator: jest.fn(),
  };
  const generations = {
    createImageGeneration: jest.fn(async (args: any) => ({
      id: args.id,
      ...args,
      status: 'pending',
    })),
  };
  const membership = {
    resolveActiveMembershipLevel: jest.fn().mockResolvedValue(2),
  };
  const resources = {
    delegateFor: jest.fn(() => prisma.image_templates),
  };
  const service = new ImageTemplatesService(
    new ResourceInteractionRepository(prisma as never),
    resources as never,
    {} as never,
    points as never,
    models as never,
    generations as never,
    membership as never,
    {} as never,
  );
  return { service, prisma, tx, points, models, generations, resources, membership };
}

function buildImageTemplatesService(overrides: BuildOverrides = {}) {
  return createMocks(overrides).service;
}

describe('ImageTemplatesService.createGeneration billing', () => {
  it('freezes configurable template image points and confirms after record creation', async () => {
    const { service, points, generations } = createMocks();

    const gen = await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'gpt-image-2',
      modelConfigId: 'model-1',
      variables: { subject: 'shoe' },
      referenceImage: 'https://img.test/ref.png',
    });

    expect(points.estimateCost).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { referenceImages: 1 },
      membershipLevel: 2,
    });

    const holdArgs = points.createHold.mock.calls[0][1];
    expect(holdArgs).toEqual(
      expect.objectContaining({
        taskType: 'image_generation',
        amount: 90,
        taskId: gen.id,
        pricingSnapshot: { ruleId: 'rule-image' },
      }),
    );
    expect(holdArgs).not.toHaveProperty('refundPolicySnapshot');

    expect(generations.createImageGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        id: gen.id,
        resolvedPrompt: 'Make shoe',
      }),
    );
    expect(points.confirmHold).toHaveBeenCalledWith('hold-1');
  });

  it('omits modelConfigId from the estimate call when the generation has none', async () => {
    const { service, points } = createMocks();

    await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'gpt-image-2',
      variables: { subject: 'shoe' },
    });

    const estimateArgs = points.estimateCost.mock.calls[0][0];
    expect(estimateArgs).not.toHaveProperty('modelConfigId');
    expect(estimateArgs).toEqual({
      taskType: 'image_generation',
      params: { referenceImages: 0 },
      membershipLevel: 2,
    });
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

describe('ImageTemplatesService.estimateTemplateGenerationCost — new engine', () => {
  it('passes taskType, modelConfigId and params.referenceImages', async () => {
    const estimateCost = jest.fn().mockResolvedValue({
      taskType: 'image_generation',
      estimatedCost: 45,
      pricingSnapshot: {},
    });
    const service = buildImageTemplatesService({ pointsService: { estimateCost } });

    await (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      referenceImages: 1,
      membershipLevel: 2,
    });

    expect(estimateCost).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { referenceImages: 1 },
      membershipLevel: 2,
    });
  });

  it('omits modelConfigId entirely when not provided (no bogus fallback)', async () => {
    const estimateCost = jest.fn().mockResolvedValue({
      taskType: 'image_generation',
      estimatedCost: 45,
      pricingSnapshot: {},
    });
    const service = buildImageTemplatesService({ pointsService: { estimateCost } });

    await (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
      taskType: 'image_generation',
      referenceImages: 0,
      membershipLevel: 0,
    });

    const args = estimateCost.mock.calls[0][0];
    expect(args).not.toHaveProperty('modelConfigId');
    expect(args).toEqual({
      taskType: 'image_generation',
      params: { referenceImages: 0 },
      membershipLevel: 0,
    });
  });

  it('propagates the estimator rejection without a metered fallback', async () => {
    const estimateCost = jest.fn().mockRejectedValue(new BadRequestException('模型未绑定任务'));
    const service = buildImageTemplatesService({ pointsService: { estimateCost } });

    await expect(
      (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        referenceImages: 0,
      }),
    ).rejects.toThrow('模型未绑定任务');
  });
});
