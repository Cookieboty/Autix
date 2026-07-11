import { TaskPricingRepository } from './task-pricing.repository';

function buildPrisma() {
  return {
    task_definitions: { findUnique: jest.fn(), findMany: jest.fn() },
    task_model_bindings: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
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
    const bindingRow = {
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      isDefault: false,
      isActive: true,
    };
    prisma.task_model_bindings.findUnique.mockResolvedValue(bindingRow);
    const repo = new TaskPricingRepository(prisma as never);

    const result = await repo.findBinding('image_generation', 'model-1');

    expect(prisma.task_model_bindings.findUnique).toHaveBeenCalledWith({
      where: { taskType_modelConfigId: { taskType: 'image_generation', modelConfigId: 'model-1' } },
    });
    expect(result).toEqual(bindingRow);
  });

  it('findDefaultBinding does not filter on isActive, so a deactivated default is still returned', async () => {
    const prisma = buildPrisma();
    const deactivatedDefault = {
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      isDefault: true,
      isActive: false,
    };
    prisma.task_model_bindings.findFirst.mockResolvedValue(deactivatedDefault);
    const repo = new TaskPricingRepository(prisma as never);

    const result = await repo.findDefaultBinding('image_generation');

    // The partial unique index task_model_bindings_one_default_per_task only
    // constrains isDefault, not isActive — a row can legally be
    // isDefault: true, isActive: false. Filtering isActive here would collapse
    // "no default configured" and "default exists but deactivated" into the
    // same null result. Callers must see isActive themselves to tell those apart.
    expect(prisma.task_model_bindings.findFirst).toHaveBeenCalledWith({
      where: { taskType: 'image_generation', isDefault: true },
    });
    expect(result).not.toBeNull();
    expect(result!.isDefault).toBe(true);
    expect(result!.isActive).toBe(false);
  });

  it('findModelPricingConfig selects only pricing fields', async () => {
    const prisma = buildPrisma();
    const configRow = {
      id: 'model-1',
      name: 'gpt-x',
      paramsSchema: { foo: 'bar' },
      pricingSchema: { rate: 1 },
      schemaVersion: 1,
    };
    prisma.model_configs.findUnique.mockResolvedValue(configRow);
    const repo = new TaskPricingRepository(prisma as never);

    const result = await repo.findModelPricingConfig('model-1');

    expect(prisma.model_configs.findUnique).toHaveBeenCalledWith({
      where: { id: 'model-1' },
      select: { id: true, name: true, paramsSchema: true, pricingSchema: true, schemaVersion: true },
    });
    expect(result).toEqual(configRow);
  });

  it('findModelPricingConfig passes through NULL schemas as null, not {}', async () => {
    const prisma = buildPrisma();
    const configRow = {
      id: 'model-1',
      name: 'gpt-x',
      paramsSchema: null,
      pricingSchema: null,
      schemaVersion: 1,
    };
    prisma.model_configs.findUnique.mockResolvedValue(configRow);
    const repo = new TaskPricingRepository(prisma as never);

    const result = await repo.findModelPricingConfig('model-1');

    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toEqual(Object.keys(configRow));
    expect(result!.paramsSchema).toBeNull();
    expect(result!.pricingSchema).toBeNull();
    // NULL means "not configured". A future "helpful" `?? {}` would make
    // evaluatePricing({ terms: [] }) return total: 0 — silently free generation.
    // toBeNull() already rejects {} (it is not null), but pin the deep-equality
    // guard explicitly so intent survives even if the toBeNull() assertion above
    // is ever weakened.
    expect(result!.pricingSchema).not.toEqual({});
    expect(result!.paramsSchema).not.toEqual({});
  });

  it('findModelPricingConfig returns null when no row exists (missing model, not unconfigured)', async () => {
    const prisma = buildPrisma();
    prisma.model_configs.findUnique.mockResolvedValue(null);
    const repo = new TaskPricingRepository(prisma as never);

    const result = await repo.findModelPricingConfig('missing-model');

    expect(result).toBeNull();
  });

  it('findActiveDiscounts filters by isActive and effective window', async () => {
    const prisma = buildPrisma();
    const discountRow = {
      id: 'discount-1',
      isActive: true,
      effectiveFrom: null,
      effectiveTo: null,
    };
    prisma.pricing_discounts.findMany.mockResolvedValue([discountRow]);
    const repo = new TaskPricingRepository(prisma as never);
    const now = new Date('2026-07-09T00:00:00.000Z');

    const result = await repo.findActiveDiscounts(now);

    expect(prisma.pricing_discounts.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }],
      },
    });
    expect(result).toEqual([discountRow]);
  });

  it('findActiveTaskDefinitions orders by sort', async () => {
    const prisma = buildPrisma();
    const repo = new TaskPricingRepository(prisma as never);

    await repo.findActiveTaskDefinitions();

    expect(prisma.task_definitions.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sort: 'asc' },
    });
  });

  it('findBindingsForTask joins model config pricing + membership fields', async () => {
    const prisma = buildPrisma();
    const repo = new TaskPricingRepository(prisma as never);

    await repo.findBindingsForTask('image_generation');

    expect(prisma.task_model_bindings.findMany).toHaveBeenCalledWith({
      // 除了绑定活跃，模型本身也必须公开且活跃(匿名公开接口不能泄露 private/inactive 模型)。
      where: {
        taskType: 'image_generation',
        isActive: true,
        modelConfig: { is: { visibility: 'public', isActive: true } },
      },
      orderBy: { sort: 'asc' },
      include: {
        modelConfig: {
          select: {
            id: true,
            name: true,
            provider: true,
            visibility: true,
            paramsSchema: true,
            pricingSchema: true,
            description: true,
            allowedMembershipLevels: { select: { levelId: true } },
          },
        },
      },
    });
  });
});
