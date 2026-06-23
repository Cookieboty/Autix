import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { VideoTemplatesService } from './video-templates.service';

function createMocks() {
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
      pricingSnapshot: { ruleId: 'rule-video' },
      refundPolicy: { systemFailed: 'full_refund' },
    })),
    createHold: jest.fn(async () => ({ hold: { id: 'hold-1' }, balance: 4900 })),
    confirmHold: jest.fn(),
    refundHold: jest.fn(),
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
  const resources = {
    delegateFor: jest.fn(() => prisma.video_templates),
  };
  const service = new VideoTemplatesService(
    new ResourceInteractionRepository(prisma as never),
    resources as never,
    points as never,
    models as never,
    generations as never,
  );
  return { service, tx, points, generations, resources };
}

describe('VideoTemplatesService.createGeneration billing', () => {
  it('freezes configurable template video points with duration and confirms after record creation', async () => {
    const { service, points, generations } = createMocks();

    const gen = await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'seedance-pro',
      variables: { subject: 'shoe' },
      referenceImage: 'https://img.test/ref.png',
    });

    expect(points.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'video_generation',
        modelName: 'seedance-pro',
        seconds: 5,
        referenceImages: 1,
        usesTemplate: true,
      }),
    );
    expect(points.createHold).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        taskType: 'video_generation',
        amount: 1600,
        taskId: gen.id,
      }),
    );
    expect(generations.createVideoGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        id: gen.id,
        resolvedPrompt: 'Animate shoe',
      }),
    );
    expect(points.confirmHold).toHaveBeenCalledWith('hold-1');
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
