import { BadRequestException } from '@nestjs/common';
import { TaskPricingEstimatorService } from './task-pricing-estimator.service';
import type { TaskPricingRepository } from '../repositories/task-pricing.repository';

const PARAMS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object' as const,
  required: ['quality'],
  properties: {
    quality: {
      type: 'string' as const,
      enum: ['low', 'medium', 'high'],
      'x-ui': { control: 'chips' as const },
    },
  },
};

const PRICING_SCHEMA = {
  terms: [
    { id: 'base', op: 'add' as const, const: 1 },
    { id: 'quality', op: 'mul' as const, table: { param: 'quality', values: { low: 15, medium: 90, high: 350 } } },
  ],
};

function buildRepo(overrides: Partial<jest.Mocked<TaskPricingRepository>> = {}) {
  return {
    findTaskDefinition: jest.fn().mockResolvedValue({
      taskType: 'image_generation',
      isActive: true,
      fixedCostSchema: null,
    }),
    findBinding: jest.fn().mockResolvedValue({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      multiplier: { toString: () => '1.000' },
      isActive: true,
      isDefault: false,
    }),
    findDefaultBinding: jest.fn().mockResolvedValue(null),
    findModelPricingConfig: jest.fn().mockResolvedValue({
      id: 'model-1',
      name: 'GPT Image',
      paramsSchema: PARAMS_SCHEMA,
      pricingSchema: PRICING_SCHEMA,
      schemaVersion: 1,
    }),
    findActiveDiscounts: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as TaskPricingRepository;
}

describe('TaskPricingEstimatorService.estimateCost', () => {
  it('quotes using the bound model when modelConfigId is given', async () => {
    const repo = buildRepo();
    const service = new TaskPricingEstimatorService(repo);

    const result = await service.estimateCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'medium' },
    });

    expect(result.estimatedCost).toBe(90);
    expect(result.modelConfigId).toBe('model-1');
    expect(result.pricingSnapshot.modelConfigId).toBe('model-1');
    expect(result.pricingSnapshot.params).toEqual({ quality: 'medium' });
    expect(repo.findBinding).toHaveBeenCalledWith('image_generation', 'model-1');
  });

  it('resolves the default binding when modelConfigId is absent', async () => {
    const repo = buildRepo({
      findDefaultBinding: jest.fn().mockResolvedValue({
        taskType: 'image_generation',
        modelConfigId: 'model-default',
        multiplier: { toString: () => '1.000' },
        isActive: true,
        isDefault: true,
      }),
      findModelPricingConfig: jest.fn().mockResolvedValue({
        id: 'model-default',
        name: 'Default',
        paramsSchema: PARAMS_SCHEMA,
        pricingSchema: PRICING_SCHEMA,
        schemaVersion: 1,
      }),
    });
    const service = new TaskPricingEstimatorService(repo);

    const result = await service.estimateCost({
      taskType: 'image_generation',
      params: { quality: 'low' },
    });

    expect(result.modelConfigId).toBe('model-default');
    expect(repo.findDefaultBinding).toHaveBeenCalledWith('image_generation');
  });

  it('throws 400 when the task definition is missing', async () => {
    const repo = buildRepo({ findTaskDefinition: jest.fn().mockResolvedValue(null) });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({ taskType: 'unknown_task', params: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when the task definition is inactive, with a message distinguishable from "missing"', async () => {
    const repo = buildRepo({
      findTaskDefinition: jest.fn().mockResolvedValue({
        taskType: 'image_generation',
        isActive: false,
        fixedCostSchema: null,
      }),
    });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({ taskType: 'image_generation', params: {} }),
    ).rejects.toThrow(/停用/);
  });

  it('throws 400 when no binding exists for the resolved model', async () => {
    const repo = buildRepo({ findBinding: jest.fn().mockResolvedValue(null) });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({ taskType: 'image_generation', modelConfigId: 'model-1', params: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when the explicit binding is deactivated, with a message distinguishable from "no binding"', async () => {
    const repoNoBinding = buildRepo({ findBinding: jest.fn().mockResolvedValue(null) });
    const repoDeactivated = buildRepo({
      findBinding: jest.fn().mockResolvedValue({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        multiplier: { toString: () => '1.000' },
        isActive: false,
        isDefault: false,
      }),
    });
    const serviceNoBinding = new TaskPricingEstimatorService(repoNoBinding);
    const serviceDeactivated = new TaskPricingEstimatorService(repoDeactivated);

    let noBindingMessage = '';
    let deactivatedMessage = '';
    try {
      await serviceNoBinding.estimateCost({ taskType: 'image_generation', modelConfigId: 'model-1', params: {} });
    } catch (error) {
      noBindingMessage = (error as BadRequestException).message;
    }
    try {
      await serviceDeactivated.estimateCost({ taskType: 'image_generation', modelConfigId: 'model-1', params: {} });
    } catch (error) {
      deactivatedMessage = (error as BadRequestException).message;
    }

    expect(noBindingMessage).not.toBe('');
    expect(deactivatedMessage).not.toBe('');
    expect(noBindingMessage).not.toBe(deactivatedMessage);
  });

  it('throws 400 when no default binding exists and modelConfigId was omitted', async () => {
    const repo = buildRepo();
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({ taskType: 'image_generation', params: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('distinguishes "no default configured" from "default exists but deactivated"', async () => {
    const repoNoDefault = buildRepo(); // findDefaultBinding resolves null
    const repoDeactivatedDefault = buildRepo({
      findDefaultBinding: jest.fn().mockResolvedValue({
        taskType: 'image_generation',
        modelConfigId: 'model-default',
        multiplier: { toString: () => '1.000' },
        isActive: false,
        isDefault: true,
      }),
    });
    const serviceNoDefault = new TaskPricingEstimatorService(repoNoDefault);
    const serviceDeactivatedDefault = new TaskPricingEstimatorService(repoDeactivatedDefault);

    let noDefaultMessage = '';
    let deactivatedDefaultMessage = '';
    try {
      await serviceNoDefault.estimateCost({ taskType: 'image_generation', params: {} });
    } catch (error) {
      noDefaultMessage = (error as BadRequestException).message;
    }
    try {
      await serviceDeactivatedDefault.estimateCost({ taskType: 'image_generation', params: {} });
    } catch (error) {
      deactivatedDefaultMessage = (error as BadRequestException).message;
    }

    expect(noDefaultMessage).not.toBe('');
    expect(deactivatedDefaultMessage).not.toBe('');
    expect(noDefaultMessage).not.toBe(deactivatedDefaultMessage);
  });

  it('throws 400 when pricingSchema is NULL rather than computing 0', async () => {
    const repo = buildRepo({
      findModelPricingConfig: jest.fn().mockResolvedValue({
        id: 'model-1',
        name: 'Unconfigured',
        paramsSchema: null,
        pricingSchema: null,
        schemaVersion: 1,
      }),
    });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({ taskType: 'image_generation', modelConfigId: 'model-1', params: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when paramsSchema is NULL', async () => {
    const repo = buildRepo({
      findModelPricingConfig: jest.fn().mockResolvedValue({
        id: 'model-1',
        name: 'Half-configured',
        paramsSchema: null,
        pricingSchema: PRICING_SCHEMA,
        schemaVersion: 1,
      }),
    });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({ taskType: 'image_generation', modelConfigId: 'model-1', params: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 with ajv violations when params are invalid, surfacing the JSON Pointer path', async () => {
    const repo = buildRepo();
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: { quality: 'ultra' },
      }),
    ).rejects.toMatchObject({
      response: {
        violations: expect.arrayContaining([
          expect.objectContaining({ path: '/quality' }),
        ]),
      },
    });
  });

  it('rejects a structurally invalid stored pricingSchema instead of pricing with it (first term not add)', async () => {
    const repo = buildRepo({
      findModelPricingConfig: jest.fn().mockResolvedValue({
        id: 'model-1',
        name: 'Broken',
        paramsSchema: PARAMS_SCHEMA,
        pricingSchema: { terms: [{ id: 'x', op: 'mul', const: 5 }] },
        schemaVersion: 1,
      }),
    });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: { quality: 'medium' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when pricingSchema references a param missing from paramsSchema', async () => {
    const repo = buildRepo({
      findModelPricingConfig: jest.fn().mockResolvedValue({
        id: 'model-1',
        name: 'Mismatched',
        paramsSchema: PARAMS_SCHEMA,
        pricingSchema: {
          terms: [
            { id: 'base', op: 'add', const: 1 },
            { id: 'res', op: 'mul', table: { param: 'resolution', values: { low: 1, high: 2 } } },
          ],
        },
        schemaVersion: 1,
      }),
    });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: { quality: 'medium' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('applies the resolved discount factor and records it in the snapshot', async () => {
    const repo = buildRepo({
      findActiveDiscounts: jest.fn().mockResolvedValue([
        {
          id: 'd1',
          code: 'HALF',
          factor: { toString: () => '0.500' },
          scope: {},
          stackable: false,
          priority: 0,
          effectiveFrom: null,
          effectiveTo: null,
          isActive: true,
        },
      ]),
    });
    const service = new TaskPricingEstimatorService(repo);

    const result = await service.estimateCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'medium' },
    });

    expect(result.estimatedCost).toBe(45);
    expect(result.pricingSnapshot.discountFactor).toBe(0.5);
    expect(result.pricingSnapshot.discountCode).toBe('HALF');
  });

  it('defaults membershipLevel to 0 (non-member) for discount matching', async () => {
    const repo = buildRepo({
      findActiveDiscounts: jest.fn().mockResolvedValue([
        {
          id: 'd1',
          code: 'MEMBERS_ONLY',
          factor: { toString: () => '0.500' },
          scope: { membershipLevelNumbers: [1, 2] },
          stackable: false,
          priority: 0,
          effectiveFrom: null,
          effectiveTo: null,
          isActive: true,
        },
      ]),
    });
    const service = new TaskPricingEstimatorService(repo);

    const result = await service.estimateCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'medium' },
    });

    expect(result.pricingSnapshot.discountFactor).toBe(1);
  });

  it('applies a non-1 Decimal-like multiplier without producing NaN', async () => {
    const repo = buildRepo({
      findBinding: jest.fn().mockResolvedValue({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        multiplier: { toString: () => '2.000' },
        isActive: true,
        isDefault: false,
      }),
    });
    const service = new TaskPricingEstimatorService(repo);

    const result = await service.estimateCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'medium' },
    });

    // base(1) * quality(90) = 90 model total; * multiplier 2 * discount 1 = 180.
    expect(result.estimatedCost).toBe(180);
    expect(Number.isNaN(result.estimatedCost)).toBe(false);
    expect(result.pricingSnapshot.multiplier).toBe(2);
  });

  it('rejects a non-numeric Decimal-like multiplier instead of returning NaN', async () => {
    const repo = buildRepo({
      findBinding: jest.fn().mockResolvedValue({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        multiplier: { toString: () => 'not-a-number' },
        isActive: true,
        isDefault: false,
      }),
    });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: { quality: 'medium' },
      }),
    ).rejects.toThrow();
  });

  it('proves the fixed task cost escapes the discount multiplication: ceil(7 * 1 * 0.5) + 3 = 7', async () => {
    const repo = buildRepo({
      findTaskDefinition: jest.fn().mockResolvedValue({
        taskType: 'image_generation',
        isActive: true,
        fixedCostSchema: { terms: [{ id: 'fixed', op: 'add', const: 3 }] },
      }),
      findModelPricingConfig: jest.fn().mockResolvedValue({
        id: 'model-1',
        name: 'Flat',
        paramsSchema: PARAMS_SCHEMA,
        pricingSchema: { terms: [{ id: 'base', op: 'add', const: 7 }] },
        schemaVersion: 1,
      }),
      findActiveDiscounts: jest.fn().mockResolvedValue([
        {
          id: 'd1',
          code: 'HALF',
          factor: { toString: () => '0.500' },
          scope: {},
          stackable: false,
          priority: 0,
          effectiveFrom: null,
          effectiveTo: null,
          isActive: true,
        },
      ]),
    });
    const service = new TaskPricingEstimatorService(repo);

    const result = await service.estimateCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'medium' },
    });

    // If the implementation wrongly applied the discount to the fixed fee too,
    // this would be ceil(7*0.5 + 3*0.5) = ceil(5) = 5, not 7.
    expect(result.estimatedCost).toBe(7);
  });

  it('stores the pricing snapshot as a value copy: mutating the source schema after the call does not change it', async () => {
    const sourcePricingSchema = {
      terms: [
        { id: 'base', op: 'add' as const, const: 1 },
        { id: 'quality', op: 'mul' as const, table: { param: 'quality', values: { low: 15, medium: 90, high: 350 } } },
      ],
    };
    const sourceParams: Record<string, unknown> = { quality: 'medium' };
    const repo = buildRepo({
      findModelPricingConfig: jest.fn().mockResolvedValue({
        id: 'model-1',
        name: 'GPT Image',
        paramsSchema: PARAMS_SCHEMA,
        pricingSchema: sourcePricingSchema,
        schemaVersion: 1,
      }),
    });
    const service = new TaskPricingEstimatorService(repo);

    const result = await service.estimateCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: sourceParams,
    });

    const snapshotBefore = JSON.parse(JSON.stringify(result.pricingSnapshot));

    // Mutate the source objects after the call returned.
    sourcePricingSchema.terms[0].const = 999;
    (sourceParams as Record<string, unknown>).quality = 'high';

    expect(result.pricingSnapshot).toEqual(snapshotBefore);
    expect((result.pricingSnapshot.modelSchema.terms[0] as { const: number }).const).toBe(1);
    expect(result.pricingSnapshot.params.quality).toBe('medium');
  });
});
