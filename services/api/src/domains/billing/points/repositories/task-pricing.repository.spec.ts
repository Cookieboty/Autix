import { TaskPricingRepository } from './task-pricing.repository';

function buildPrisma() {
  return {
    task_definitions: { findUnique: jest.fn() },
    task_model_bindings: { findUnique: jest.fn(), findFirst: jest.fn() },
    model_configs: { findUnique: jest.fn() },
    pricing_discounts: { findMany: jest.fn() },
  };
}

describe('TaskPricingRepository', () => {
  it('findTaskDefinition queries by taskType', async () => {
    const prisma = buildPrisma();
    prisma.task_definitions.findUnique.mockResolvedValue({ taskType: 'image_generation' });
    const repo = new TaskPricingRepository(prisma as never);

    const result = await repo.findTaskDefinition('image_generation');

    expect(prisma.task_definitions.findUnique).toHaveBeenCalledWith({
      where: { taskType: 'image_generation' },
    });
    expect(result).toEqual({ taskType: 'image_generation' });
  });

  it('findBinding queries by composite key', async () => {
    const prisma = buildPrisma();
    const repo = new TaskPricingRepository(prisma as never);

    await repo.findBinding('image_generation', 'model-1');

    expect(prisma.task_model_bindings.findUnique).toHaveBeenCalledWith({
      where: { taskType_modelConfigId: { taskType: 'image_generation', modelConfigId: 'model-1' } },
    });
  });

  it('findDefaultBinding filters isDefault and isActive', async () => {
    const prisma = buildPrisma();
    const repo = new TaskPricingRepository(prisma as never);

    await repo.findDefaultBinding('image_generation');

    expect(prisma.task_model_bindings.findFirst).toHaveBeenCalledWith({
      where: { taskType: 'image_generation', isDefault: true, isActive: true },
    });
  });

  it('findModelPricingConfig selects only pricing fields', async () => {
    const prisma = buildPrisma();
    const repo = new TaskPricingRepository(prisma as never);

    await repo.findModelPricingConfig('model-1');

    expect(prisma.model_configs.findUnique).toHaveBeenCalledWith({
      where: { id: 'model-1' },
      select: { id: true, name: true, paramsSchema: true, pricingSchema: true, schemaVersion: true },
    });
  });

  it('findActiveDiscounts filters by isActive and effective window', async () => {
    const prisma = buildPrisma();
    const repo = new TaskPricingRepository(prisma as never);
    const now = new Date('2026-07-09T00:00:00.000Z');

    await repo.findActiveDiscounts(now);

    expect(prisma.pricing_discounts.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }],
      },
    });
  });
});
