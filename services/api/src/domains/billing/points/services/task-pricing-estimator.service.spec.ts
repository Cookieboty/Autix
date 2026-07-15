import type { Mocked } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MODEL_PRESETS, quoteTaskFromSnapshot } from '@autix/domain/pricing';
import { stripNonPricingParams, TaskPricingEstimatorService } from './task-pricing-estimator.service';
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

/**
 * 第 2 期翻转后的图片 schema 形状（见 services/api/scripts/seed-pricing.schemas.ts）：
 * size 是用户选的 wire 参数，resolution 由 size 派生、只计价。
 */
const SIZE_PARAMS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object' as const,
  required: ['size', 'quality', 'resolution'],
  properties: {
    size: {
      type: 'string' as const,
      enum: ['1024x1024@1K', '2048x2048@2K'],
      default: '1024x1024@1K',
      'x-ui': { role: 'wire' as const, control: 'size-grid' as const },
    },
    quality: {
      type: 'string' as const,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      'x-ui': { role: 'both' as const, control: 'chips' as const },
    },
    resolution: {
      type: 'string' as const,
      enum: ['1K', '2K'],
      default: '1K',
      'x-ui': {
        role: 'derived' as const,
        control: 'hidden' as const,
        derivedFrom: { param: 'size', via: 'imagePricingResolution' as const },
      },
    },
    referenceImages: {
      type: 'integer' as const,
      minimum: 0,
      maximum: 4,
      default: 0,
      'x-ui': { role: 'pricing' as const, control: 'hidden' as const },
    },
  },
};

const SIZE_PRICING_SCHEMA = {
  terms: [
    { id: 'base', op: 'add' as const, const: 1 },
    { id: 'quality', op: 'mul' as const, table: { param: 'quality', values: { low: 15, medium: 90, high: 350 } } },
    { id: 'resolution', op: 'mul' as const, table: { param: 'resolution', values: { '1K': 1, '2K': 2 } } },
    { id: 'referenceImages', op: 'add' as const, perUnit: { param: 'referenceImages', unitCost: 5 } },
  ],
};

/**
 * Finding 1（Task 9 review）：`SIZE_PARAMS_SCHEMA` 上面那份给 `resolution` 声明了
 * `default: '1K'` —— 今天所有 seeded schema 都这样，所以 `applyParamDefaults` 自己
 * 就能满足 `required: ['resolution']`，测试套件测不出 derive 是在 validate 之前还是
 * 之后跑：两种顺序下 resolution 都已经"存在"了，只是值可能不对。
 *
 * 这份 fixture 故意不给 resolution 声明 default —— 只有 deriveParams 先于
 * validateParams 跑，required 才能被满足；顺序反了就是 400（缺 resolution），
 * 不是"按错误档位收费"这种更隐蔽的失败。
 */
const SIZE_PARAMS_SCHEMA_NO_RESOLUTION_DEFAULT = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object' as const,
  required: ['size', 'quality', 'resolution'],
  properties: {
    size: {
      type: 'string' as const,
      enum: ['1024x1024@1K', '2048x2048@2K'],
      default: '1024x1024@1K',
      'x-ui': { role: 'wire' as const, control: 'size-grid' as const },
    },
    quality: {
      type: 'string' as const,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      'x-ui': { role: 'both' as const, control: 'chips' as const },
    },
    resolution: {
      // 无 default（此 fixture 存在的唯一理由）。
      type: 'string' as const,
      enum: ['1K', '2K'],
      'x-ui': {
        role: 'derived' as const,
        control: 'hidden' as const,
        derivedFrom: { param: 'size', via: 'imagePricingResolution' as const },
      },
    },
  },
};

const SIZE_PRICING_SCHEMA_NO_REFERENCE_IMAGES = {
  terms: [
    { id: 'base', op: 'add' as const, const: 1 },
    { id: 'quality', op: 'mul' as const, table: { param: 'quality', values: { low: 15, medium: 90, high: 350 } } },
    { id: 'resolution', op: 'mul' as const, table: { param: 'resolution', values: { '1K': 1, '2K': 2 } } },
  ],
};

/** quality medium(90) × resolution 2K(2) = 180；1K 则是 90。 */
const PRICE_AT_2K = 180;
const PRICE_AT_1K = 90;

function buildRepo(overrides: Partial<Mocked<TaskPricingRepository>> = {}) {
  return {
    findTaskDefinition: vi.fn().mockResolvedValue({
      taskType: 'image_generation',
      isActive: true,
      fixedCostSchema: null,
    }),
    findBinding: vi.fn().mockResolvedValue({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      multiplier: { toString: () => '1.000' },
      isActive: true,
      isDefault: false,
    }),
    findDefaultBinding: vi.fn().mockResolvedValue(null),
    findModelPricingConfig: vi.fn().mockResolvedValue({
      id: 'model-1',
      name: 'GPT Image',
      paramsSchema: PARAMS_SCHEMA,
      pricingSchema: PRICING_SCHEMA,
      schemaVersion: 1,
    }),
    findActiveDiscounts: vi.fn().mockResolvedValue([]),
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
      findDefaultBinding: vi.fn().mockResolvedValue({
        taskType: 'image_generation',
        modelConfigId: 'model-default',
        multiplier: { toString: () => '1.000' },
        isActive: true,
        isDefault: true,
      }),
      findModelPricingConfig: vi.fn().mockResolvedValue({
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
    const repo = buildRepo({ findTaskDefinition: vi.fn().mockResolvedValue(null) });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({ taskType: 'unknown_task', params: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when the task definition is inactive, with a message distinguishable from "missing"', async () => {
    const repo = buildRepo({
      findTaskDefinition: vi.fn().mockResolvedValue({
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
    const repo = buildRepo({ findBinding: vi.fn().mockResolvedValue(null) });
    const service = new TaskPricingEstimatorService(repo);

    await expect(
      service.estimateCost({ taskType: 'image_generation', modelConfigId: 'model-1', params: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when the explicit binding is deactivated, with a message distinguishable from "no binding"', async () => {
    const repoNoBinding = buildRepo({ findBinding: vi.fn().mockResolvedValue(null) });
    const repoDeactivated = buildRepo({
      findBinding: vi.fn().mockResolvedValue({
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
      findDefaultBinding: vi.fn().mockResolvedValue({
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
      findModelPricingConfig: vi.fn().mockResolvedValue({
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
      findModelPricingConfig: vi.fn().mockResolvedValue({
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
      findModelPricingConfig: vi.fn().mockResolvedValue({
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
      findModelPricingConfig: vi.fn().mockResolvedValue({
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
      findActiveDiscounts: vi.fn().mockResolvedValue([
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
      findActiveDiscounts: vi.fn().mockResolvedValue([
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
      findBinding: vi.fn().mockResolvedValue({
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
      findBinding: vi.fn().mockResolvedValue({
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
      findTaskDefinition: vi.fn().mockResolvedValue({
        taskType: 'image_generation',
        isActive: true,
        fixedCostSchema: { terms: [{ id: 'fixed', op: 'add', const: 3 }] },
      }),
      findModelPricingConfig: vi.fn().mockResolvedValue({
        id: 'model-1',
        name: 'Flat',
        paramsSchema: PARAMS_SCHEMA,
        pricingSchema: { terms: [{ id: 'base', op: 'add', const: 7 }] },
        schemaVersion: 1,
      }),
      findActiveDiscounts: vi.fn().mockResolvedValue([
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
      findModelPricingConfig: vi.fn().mockResolvedValue({
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

  describe('paramsSchema defaults — the production bug this suite exists to catch', () => {
    // Real presets, not a fixture: MODEL_PRESETS.image.paramsSchema declares
    // required: ['quality', 'resolution']. canvas-action.service.ts legitimately
    // calls estimateCost with only { quantity } — it has no quality/resolution
    // picker. Before the fix, ajv (full strict mode, no default-filling) 400s on
    // this every time in production; the mocked-estimator unit tests for the
    // caller never caught it because they never touch a real paramsSchema.
    it('fills required quality/resolution from the schema defaults, prices correctly, and stores the filled params in the snapshot', async () => {
      const repo = buildRepo({
        findModelPricingConfig: vi.fn().mockResolvedValue({
          id: 'model-1',
          name: 'Real Image Model',
          paramsSchema: MODEL_PRESETS.image.paramsSchema,
          pricingSchema: MODEL_PRESETS.image.pricingSchema,
          schemaVersion: 1,
        }),
      });
      const service = new TaskPricingEstimatorService(repo);

      const result = await service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        // Exactly what canvas-action.service.ts sends: no quality, no resolution.
        params: { quantity: 1 },
      });

      // base(1) * quality medium(90) * resolution 1K(1) = 90; + referenceImages(0 * 5) = 90.
      expect(result.estimatedCost).toBe(90);
      // quantity 是调用方传来的、schema 从未声明的键（张数已从图像 schema 移除）。
      // 快照是白名单 → 它不进快照。此前的黑名单实现会把它原样冻进去。
      expect(result.pricingSnapshot.params).toEqual({
        quality: 'medium',
        resolution: '1K',
        referenceImages: 0,
      });

      // Estimate and settlement must agree: settlement re-prices from the
      // *snapshot*, so if the snapshot held the caller's sparse { quantity: 1 }
      // instead of the filled params, this would re-price against a schema that
      // still fails required-property validation, or silently price differently.
      const settled = quoteTaskFromSnapshot(result.pricingSnapshot, {});
      expect(settled.total).toBe(result.estimatedCost);
    });

    it('fills required quality/resolution for a template-shaped call (only referenceImages known)', async () => {
      const repo = buildRepo({
        findModelPricingConfig: vi.fn().mockResolvedValue({
          id: 'model-1',
          name: 'Real Image Model',
          paramsSchema: MODEL_PRESETS.image.paramsSchema,
          pricingSchema: MODEL_PRESETS.image.pricingSchema,
          schemaVersion: 1,
        }),
      });
      const service = new TaskPricingEstimatorService(repo);

      const result = await service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        // Exactly what image-templates.service.ts / video-templates.service.ts send.
        params: { referenceImages: 2 },
      });

      // quantity 已从图像 schema 移除（张数由业务逻辑吃掉），故不再填 quantity 默认值。
      expect(result.pricingSnapshot.params).toEqual({
        quality: 'medium',
        resolution: '1K',
        referenceImages: 2,
      });
      const settled = quoteTaskFromSnapshot(result.pricingSnapshot, {});
      expect(settled.total).toBe(result.estimatedCost);
    });

    describe('text tasks — usage-source params (tokens) must not enter the frozen snapshot (spec §3.1.1.65)', () => {
      it('does not fill inputTokens/outputTokens defaults and excludes them from the snapshot', async () => {
        const repo = buildRepo({
          findTaskDefinition: vi.fn().mockResolvedValue({
            taskType: 'chat_message_standard',
            isActive: true,
            fixedCostSchema: { terms: [{ id: 'taskBase', op: 'add', const: 3 }] },
          }),
          findModelPricingConfig: vi.fn().mockResolvedValue({
            id: 'model-1',
            name: 'Real Text Model',
            paramsSchema: MODEL_PRESETS.text.paramsSchema,
            pricingSchema: MODEL_PRESETS.text.pricingSchema,
            schemaVersion: 1,
          }),
        });
        const service = new TaskPricingEstimatorService(repo);

        const result = await service.estimateCost({
          taskType: 'chat_message_standard',
          modelConfigId: 'model-1',
          params: {},
        });

        expect('inputTokens' in result.pricingSnapshot.params).toBe(false);
        expect('outputTokens' in result.pricingSnapshot.params).toBe(false);
        // temperature/maxTokens are valueSource: 'params' (default) — still filled.
        expect(result.pricingSnapshot.params.temperature).toBe(0.7);
        expect(result.pricingSnapshot.params.maxTokens).toBe(4096);
      });

      it('strips a caller-supplied token estimate from the snapshot even though it was used to compute the estimate', async () => {
        const repo = buildRepo({
          findTaskDefinition: vi.fn().mockResolvedValue({
            taskType: 'chat_message_standard',
            isActive: true,
            fixedCostSchema: { terms: [{ id: 'taskBase', op: 'add', const: 3 }] },
          }),
          findModelPricingConfig: vi.fn().mockResolvedValue({
            id: 'model-1',
            name: 'Real Text Model',
            paramsSchema: MODEL_PRESETS.text.paramsSchema,
            pricingSchema: MODEL_PRESETS.text.pricingSchema,
            schemaVersion: 1,
          }),
        });
        const service = new TaskPricingEstimatorService(repo);

        // Estimate-time token estimates, if a caller passes them, are used to
        // compute the estimate but must not be frozen (spec §3.1.1.65).
        const result = await service.estimateCost({
          taskType: 'chat_message_standard',
          modelConfigId: 'model-1',
          params: { inputTokens: 2000, outputTokens: 1000 },
        });

        // model side: 2000*1/1000 + 1000*5/1000 = 7; + taskFixed 3 = 10.
        expect(result.estimatedCost).toBe(10);
        expect('inputTokens' in result.pricingSnapshot.params).toBe(false);
        expect('outputTokens' in result.pricingSnapshot.params).toBe(false);
      });

      it('end-to-end: settlement with real usage prices correctly from the frozen snapshot, not the (absent) estimate-time tokens', async () => {
        const repo = buildRepo({
          findTaskDefinition: vi.fn().mockResolvedValue({
            taskType: 'chat_message_standard',
            isActive: true,
            fixedCostSchema: { terms: [{ id: 'taskBase', op: 'add', const: 3 }] },
          }),
          findModelPricingConfig: vi.fn().mockResolvedValue({
            id: 'model-1',
            name: 'Real Text Model',
            paramsSchema: MODEL_PRESETS.text.paramsSchema,
            pricingSchema: MODEL_PRESETS.text.pricingSchema,
            schemaVersion: 1,
          }),
        });
        const service = new TaskPricingEstimatorService(repo);

        const result = await service.estimateCost({
          taskType: 'chat_message_standard',
          modelConfigId: 'model-1',
          params: {},
        });

        const settled = quoteTaskFromSnapshot(result.pricingSnapshot, { inputTokens: 2000, outputTokens: 1000 });
        expect(settled.total).toBe(10);
        expect(settled.total).not.toBe(0);
      });
    });

    it('does not overwrite a caller-supplied value with the schema default, even when the caller passes the whole set explicitly', async () => {
      const repo = buildRepo({
        findModelPricingConfig: vi.fn().mockResolvedValue({
          id: 'model-1',
          name: 'Real Image Model',
          paramsSchema: MODEL_PRESETS.image.paramsSchema,
          pricingSchema: MODEL_PRESETS.image.pricingSchema,
          schemaVersion: 1,
        }),
      });
      const service = new TaskPricingEstimatorService(repo);

      const result = await service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: { quality: 'high', resolution: '4K', quantity: 3, referenceImages: 1 },
      });

      // quantity 未被 schema 声明 → 白名单投影丢弃；其余三个是调用方显式传的值，
      // 不得被 default 覆盖。
      expect(result.pricingSnapshot.params).toEqual({
        quality: 'high',
        resolution: '4K',
        referenceImages: 1,
      });
    });
  });

  describe('deriveParams — 权威扣费路径的派生（spec §6.2/§6.3）', () => {
    function buildSizeRepo() {
      return buildRepo({
        findModelPricingConfig: vi.fn().mockResolvedValue({
          id: 'model-1',
          name: 'Flipped Image Model',
          paramsSchema: SIZE_PARAMS_SCHEMA,
          pricingSchema: SIZE_PRICING_SCHEMA,
          schemaVersion: 1,
        }),
      });
    }

    it('derives resolution from size and overwrites a client-sent value', async () => {
      const service = new TaskPricingEstimatorService(buildSizeRepo());

      // 前端传 size=2K + resolution=1K（想按 1K 收费）→ 必须按 2K 结算（spec §6.3）
      const result = await service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: { size: '2048x2048@2K', resolution: '1K', quality: 'medium' },
      });

      expect(result.pricingSnapshot.params.resolution).toBe('2K');
      expect(result.estimatedCost).toBe(PRICE_AT_2K);
      expect(result.estimatedCost).not.toBe(PRICE_AT_1K);
    });

    it('freezes the derived resolution but not the wire-only size into the snapshot', async () => {
      const service = new TaskPricingEstimatorService(buildSizeRepo());

      const result = await service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: { size: '2048x2048@2K', quality: 'medium' },
      });

      expect(result.pricingSnapshot.params).toHaveProperty('resolution', '2K');
      expect(result.pricingSnapshot.params).not.toHaveProperty('size'); // role: wire → 墙 7
      expect(quoteTaskFromSnapshot(result.pricingSnapshot, {}).total).toBe(result.estimatedCost);
    });

    it('derives from the size default when the caller sends no size at all', async () => {
      const service = new TaskPricingEstimatorService(buildSizeRepo());

      // applyParamDefaults 先填 size=1024x1024@1K，deriveParams 才能从它算出 1K；
      // 顺序反了这里就会 400（缺少 required resolution）或按错误档位收费。
      const result = await service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: {},
      });

      expect(result.pricingSnapshot.params.resolution).toBe('1K');
      expect(result.estimatedCost).toBe(PRICE_AT_1K);
    });

    it('drops the dirty keys of a legacy settings bag instead of freezing them into the snapshot', async () => {
      const service = new TaskPricingEstimatorService(buildSizeRepo());

      const result = await service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: {
          size: '2048x2048@2K',
          quality: 'medium',
          referenceImages: 1,
          // 老前端发的、schema 从未声明的键：ajv 不带 additionalProperties:false，不会 400；
          // 但它们绝不能进快照 —— 结算期 mergeParamsAndUsage 的 key 冲突断言会 500。
          promptTuning: '自动优化',
          skipPromptTuning: true,
          stylePreset: 'cinematic',
        },
      });

      expect(result.pricingSnapshot.params).toEqual({
        quality: 'medium',
        resolution: '2K',
        referenceImages: 1,
      });
      expect(quoteTaskFromSnapshot(result.pricingSnapshot, {})).toBeDefined();
    });

    it('[discriminates derive-BEFORE-validate ordering] derives a required param that has NO schema default when the caller sends only size', async () => {
      // Finding 1（Task 9 review）：every other fixture in this file gives the
      // derived param a `default`, so applyParamDefaults alone already satisfies
      // `required`, and this suite never actually distinguished
      // "derive runs before validate" from "derive runs after validate" — the
      // ordering was pinned only by a source comment. This fixture has no
      // default on `resolution`, so ONLY a correctly-ordered pipeline
      // (applyParamDefaults → deriveParams → validateParams) can satisfy
      // `required: [..., 'resolution']` here.
      const repo = buildRepo({
        findModelPricingConfig: vi.fn().mockResolvedValue({
          id: 'model-1',
          name: 'No-default-resolution image model',
          paramsSchema: SIZE_PARAMS_SCHEMA_NO_RESOLUTION_DEFAULT,
          pricingSchema: SIZE_PRICING_SCHEMA_NO_REFERENCE_IMAGES,
          schemaVersion: 1,
        }),
      });
      const service = new TaskPricingEstimatorService(repo);

      // 调用方只传 size（quality 靠自己的 default 填），完全不传 resolution：
      // resolution 没有 default，required 里却有它——若 deriveParams 晚于
      // validateParams 跑，这里必 400（缺 required resolution）。
      const result = await service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: { size: '2048x2048@2K' },
      });

      expect(result.pricingSnapshot.params.resolution).toBe('2K');
      expect(result.estimatedCost).toBe(PRICE_AT_2K);
    });
  });
});

describe('stripNonPricingParams', () => {
  const SCHEMA = {
    type: 'object',
    properties: {
      quality: { type: 'string', 'x-ui': { control: 'chips', role: 'both' } },
      resolution: {
        type: 'string',
        'x-ui': {
          control: 'hidden',
          role: 'derived',
          derivedFrom: { param: 'size', via: 'imagePricingResolution' },
        },
      },
      referenceImages: { type: 'integer', 'x-ui': { control: 'hidden', role: 'pricing' } },
      size: { type: 'string', 'x-ui': { control: 'hidden', role: 'wire' } },
      seed: { type: 'string', 'x-ui': { control: 'text', role: 'wire' } },
      legacy: { type: 'string', 'x-ui': { control: 'text' } }, // 无 role → 缺省 both
      inputTokens: { type: 'integer', 'x-ui': { control: 'hidden', valueSource: 'usage' } },
    },
  } as never;

  const PARAMS = {
    quality: 'high',
    resolution: '2K',
    referenceImages: 2,
    size: '2048x2048@2K',
    seed: 'abc',
    legacy: 'keep-me',
    inputTokens: 0,
  };

  it('keeps pricing / both / derived params', () => {
    const frozen = stripNonPricingParams(SCHEMA, PARAMS);
    expect(frozen.quality).toBe('high');
    expect(frozen.resolution).toBe('2K');
    expect(frozen.referenceImages).toBe(2);
  });

  it('drops role: wire params — they do not affect price', () => {
    // 墙 7：applyParamDefaults 会给所有带 default 的属性填值，size/seed 会被冻进
    // PricingSnapshot.params。快照里塞不该有的 key 是在给 quote.ts 的
    // mergeParamsAndUsage「params/usage key 冲突即 throw」断言埋雷。
    const frozen = stripNonPricingParams(SCHEMA, PARAMS);
    expect('size' in frozen).toBe(false);
    expect('seed' in frozen).toBe(false);
  });

  it('treats an absent role as both — 存量 schema 一个字都不用改', () => {
    expect(stripNonPricingParams(SCHEMA, PARAMS).legacy).toBe('keep-me');
  });

  it('STILL drops valueSource: usage params — role 与 valueSource 是正交的两个轴', () => {
    // 删掉这条过滤会复活「frozen inputTokens:0 → 每次结算按 0 token 计价」
    // 那个真实的线上 bug（spec §3.1.1.65）。
    expect('inputTokens' in stripNonPricingParams(SCHEMA, PARAMS)).toBe(false);
  });

  it('drops a key the schema never declared — snapshot is a whitelist, not a blacklist', () => {
    // 老实现是 `{...params}` 再 delete：schema 未声明的键（老前端的 promptTuning /
    // skipPromptTuning / stylePreset）会原样冻进快照，给结算期
    // mergeParamsAndUsage 的「params/usage key 冲突即 throw」断言埋 500 的雷。
    const out = stripNonPricingParams(SCHEMA, {
      quality: 'high',
      skipPromptTuning: true,
      promptTuning: '自动优化',
    });
    expect(out).toEqual({ quality: 'high' });
  });

  it('does not invent a key the caller never sent, even though the schema declares it', () => {
    expect(stripNonPricingParams(SCHEMA, { quality: 'low' })).toEqual({ quality: 'low' });
  });

  it('drops a usage param even when it also declares a pricing role', () => {
    // 变异测试：如果实现把 role 过滤写成「取代」valueSource 过滤（而不是「叠加」），
    // 这条会红 —— 一个 role:'both' + valueSource:'usage' 的属性会被错误地冻进快照。
    const schema = {
      type: 'object',
      properties: {
        outputTokens: {
          type: 'integer',
          'x-ui': { control: 'hidden', role: 'both', valueSource: 'usage' },
        },
      },
    } as never;
    expect('outputTokens' in stripNonPricingParams(schema, { outputTokens: 0 })).toBe(false);
  });
});
