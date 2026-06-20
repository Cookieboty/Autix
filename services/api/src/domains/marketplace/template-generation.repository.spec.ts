import { ResourceType } from '../platform/prisma/generated';
import { TemplateGenerationRepository } from './template-generation.repository';

function createPrisma() {
  const tx = {
    image_generations: {
      create: jest.fn(async (args: any) => ({ id: args.data.id, ...args.data })),
    },
    image_templates: {
      update: jest.fn(async () => ({})),
    },
    video_generations: {
      create: jest.fn(async (args: any) => ({ id: args.data.id, ...args.data })),
    },
    video_templates: {
      update: jest.fn(async () => ({})),
    },
  };

  const prisma = {
    image_generations: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    video_generations: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    generation_turns: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };

  return { prisma, tx };
}

describe('TemplateGenerationRepository', () => {
  it('creates an image generation and increments template use count atomically', async () => {
    const { prisma, tx } = createPrisma();
    const repository = new TemplateGenerationRepository(prisma as never);

    const generation = await repository.createImageGeneration({
      id: 'gen-1',
      templateId: 'tpl-1',
      userId: 'u1',
      modelUsed: 'gpt-image-2',
      resolvedPrompt: 'Make shoe',
      variables: { subject: 'shoe' } as never,
      referenceImage: 'https://img.test/ref.png',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.image_generations.create).toHaveBeenCalledWith({
      data: {
        id: 'gen-1',
        templateId: 'tpl-1',
        userId: 'u1',
        modelUsed: 'gpt-image-2',
        resolvedPrompt: 'Make shoe',
        variables: { subject: 'shoe' },
        referenceImage: 'https://img.test/ref.png',
        status: 'pending',
      },
    });
    expect(tx.image_templates.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { useCount: { increment: 1 } },
    });
    expect(generation).toEqual(
      expect.objectContaining({ id: 'gen-1', status: 'pending' }),
    );
  });

  it('creates a video generation and increments template use count atomically', async () => {
    const { prisma, tx } = createPrisma();
    const repository = new TemplateGenerationRepository(prisma as never);

    await repository.createVideoGeneration({
      id: 'gen-2',
      templateId: 'tpl-2',
      userId: 'u1',
      modelUsed: 'seedance-pro',
      resolvedPrompt: 'Animate shoe',
      variables: { subject: 'shoe' } as never,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.video_generations.create).toHaveBeenCalledWith({
      data: {
        id: 'gen-2',
        templateId: 'tpl-2',
        userId: 'u1',
        modelUsed: 'seedance-pro',
        resolvedPrompt: 'Animate shoe',
        variables: { subject: 'shoe' },
        referenceImage: undefined,
        status: 'pending',
      },
    });
    expect(tx.video_templates.update).toHaveBeenCalledWith({
      where: { id: 'tpl-2' },
      data: { useCount: { increment: 1 } },
    });
  });

  it('uses resource type when appending generation turns', async () => {
    const { prisma } = createPrisma();
    prisma.generation_turns.create.mockResolvedValue({ id: 'turn-1' });
    const repository = new TemplateGenerationRepository(prisma as never);

    await repository.addTurn(ResourceType.IMAGE_TEMPLATE, 'gen-1', {
      role: 'USER',
      content: 'try brighter',
      images: ['https://img.test/a.png'],
    });

    expect(prisma.generation_turns.create).toHaveBeenCalledWith({
      data: {
        generationType: ResourceType.IMAGE_TEMPLATE,
        generationId: 'gen-1',
        role: 'USER',
        content: 'try brighter',
        images: ['https://img.test/a.png'],
      },
    });
  });
});
