import { BadRequestException } from '@nestjs/common';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { VideoTemplatesService } from './video-templates.service';

interface BuildOverrides {
  pointsService?: Partial<{ estimateCost: jest.Mock }>;
}

function createMocks(overrides: BuildOverrides = {}) {
  const template = {
    id: 'tpl-1',
    prompt: 'Animate {{subject}}',
    title: 'Clip',
    authorId: 'author-1',
    durationSec: 5,
  };
  const tx = {
    video_generations: {
      create: jest.fn(async (args: any) => ({ id: args.data.id, ...args.data })),
    },
    video_templates: {
      update: jest.fn(async () => ({})),
    },
  };
  const prisma = {
    video_templates: {
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
      estimatedCost: 1600,
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      breakdown: [],
      pricingSnapshot: { ruleId: 'rule-video' },
    })),
    createHold: jest.fn(async (_userId: string, _input: unknown) => ({ hold: { id: 'hold-1' }, balance: 4900 })),
    confirmHold: jest.fn(),
    refundHold: jest.fn(),
    ...overrides.pointsService,
  };
  const models = {
    getConfigForOrchestrator: jest.fn(),
  };
  const generations = {
    createVideoGeneration: jest.fn(async (args: any) => ({
      id: args.id,
      ...args,
      status: 'pending',
    })),
  };
  const membership = {
    resolveActiveMembershipLevel: jest.fn().mockResolvedValue(2),
  };
  const resources = {
    delegateFor: jest.fn(() => prisma.video_templates),
  };
  const service = new VideoTemplatesService(
    new ResourceInteractionRepository(prisma as never),
    resources as never,
    points as never,
    models as never,
    generations as never,
    membership as never,
    {} as never,
  );
  return { service, tx, points, models, generations, resources, membership };
}

function buildVideoTemplatesService(overrides: BuildOverrides = {}) {
  return createMocks(overrides).service;
}

describe('VideoTemplatesService.createGeneration billing', () => {
  it('freezes configurable template video points with duration and confirms after record creation', async () => {
    const { service, points, generations } = createMocks();

    const gen = await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'seedance-pro',
      modelConfigId: 'model-1',
      variables: { subject: 'shoe' },
      referenceImage: 'https://img.test/ref.png',
    });

    expect(points.estimateCost).toHaveBeenCalledWith({
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      params: { referenceImages: 1, seconds: 5 },
      membershipLevel: 2,
    });

    const holdArgs = points.createHold.mock.calls[0][1];
    expect(holdArgs).toEqual(
      expect.objectContaining({
        taskType: 'video_generation',
        amount: 1600,
        taskId: gen.id,
        pricingSnapshot: { ruleId: 'rule-video' },
      }),
    );
    expect(holdArgs).not.toHaveProperty('refundPolicySnapshot');

    expect(generations.createVideoGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        id: gen.id,
        resolvedPrompt: 'Animate shoe',
      }),
    );
    expect(points.confirmHold).toHaveBeenCalledWith('hold-1');
  });

  it('omits modelConfigId from the estimate call when the generation has none', async () => {
    const { service, points } = createMocks();

    await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'seedance-pro',
      variables: { subject: 'shoe' },
    });

    const estimateArgs = points.estimateCost.mock.calls[0][0];
    expect(estimateArgs).not.toHaveProperty('modelConfigId');
    expect(estimateArgs).toEqual({
      taskType: 'video_generation',
      params: { referenceImages: 0, seconds: 5 },
      membershipLevel: 2,
    });
  });

  it('refunds the hold when generation record creation fails', async () => {
    const { service, generations, points } = createMocks();
    generations.createVideoGeneration.mockRejectedValue(new Error('db fail'));

    await expect(
      service.createGeneration('tpl-1', 'u1', {
        modelUsed: 'seedance-pro',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow('db fail');

    expect(points.refundHold).toHaveBeenCalledWith(
      'hold-1',
      'video template generation creation failed',
    );
    expect(points.confirmHold).not.toHaveBeenCalled();
  });
});

describe('VideoTemplatesService.estimateTemplateGenerationCost — new engine', () => {
  it('packs seconds/resolution/referenceImages into params', async () => {
    const estimateCost = jest.fn().mockResolvedValue({
      taskType: 'video_generation',
      estimatedCost: 320,
      pricingSnapshot: {},
    });
    const service = buildVideoTemplatesService({ pointsService: { estimateCost } });

    await (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      seconds: 5,
      resolution: '720p',
      referenceImages: 0,
      membershipLevel: 0,
    });

    expect(estimateCost).toHaveBeenCalledWith({
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      params: { seconds: 5, resolution: '720p', referenceImages: 0 },
      membershipLevel: 0,
    });
  });

  it('omits modelConfigId entirely when not provided (no bogus fallback)', async () => {
    const estimateCost = jest.fn().mockResolvedValue({
      taskType: 'video_generation',
      estimatedCost: 320,
      pricingSnapshot: {},
    });
    const service = buildVideoTemplatesService({ pointsService: { estimateCost } });

    await (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
      taskType: 'video_generation',
      seconds: 5,
      resolution: '720p',
      referenceImages: 0,
    });

    const args = estimateCost.mock.calls[0][0];
    expect(args).not.toHaveProperty('modelConfigId');
    expect(args).toEqual({
      taskType: 'video_generation',
      params: { seconds: 5, resolution: '720p', referenceImages: 0 },
    });
  });

  it('propagates the estimator rejection without a metered fallback', async () => {
    const estimateCost = jest.fn().mockRejectedValue(new BadRequestException('模型未绑定任务'));
    const service = buildVideoTemplatesService({ pointsService: { estimateCost } });

    await expect(
      (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
        taskType: 'video_generation',
        modelConfigId: 'model-1',
        seconds: 5,
        resolution: '720p',
      }),
    ).rejects.toThrow('模型未绑定任务');
  });
});
