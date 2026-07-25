import { quoteTaskFromSnapshot } from '@autix/domain/pricing';
import { TaskPricingEstimatorService } from './services/task-pricing-estimator.service';

/**
 * Task 24 (spec §9): integration tests locking the pricing cutover's core
 * invariants. These wire multiple REAL classes together — TaskPricingEstimatorService,
 * the pure quoteTask/quoteTaskFromSnapshot from @autix/domain/pricing, and
 * resolveDiscountFactor via the service's own call to it — with only the
 * repository's DB reads mocked. The point is to catch wiring errors that
 * per-unit mocks (see task-pricing-estimator.service.spec.ts) would hide.
 */

const PARAMS_SCHEMA = {
  type: 'object' as const,
  required: ['quality'],
  properties: {
    quality: { type: 'string' as const, enum: ['low', 'high'], 'x-ui': { control: 'chips' as const } },
  },
};
const PRICING_SCHEMA = {
  terms: [
    { id: 'base', op: 'add' as const, const: 1 },
    { id: 'quality', op: 'mul' as const, table: { param: 'quality', values: { low: 15, high: 350 } } },
  ],
};

function buildRepo() {
  return {
    findTaskDefinition: vi.fn().mockResolvedValue({ taskType: 'image_generation', isActive: true, fixedCostSchema: null }),
    findBinding: vi.fn().mockResolvedValue({
      taskType: 'image_generation', modelConfigId: 'model-1',
      multiplier: { toString: () => '1.000' }, isActive: true, isDefault: true,
    }),
    findDefaultBinding: vi.fn().mockResolvedValue(null),
    findModelPricingConfig: vi.fn().mockResolvedValue({
      id: 'model-1', name: 'GPT Image', paramsSchema: PARAMS_SCHEMA, pricingSchema: PRICING_SCHEMA, schemaVersion: 1,
    }),
    findActiveDiscounts: vi.fn().mockResolvedValue([]),
  };
}

describe('pricing cutover — server-side authority', () => {
  it('a client-supplied estimatedCost is never trusted; the server recomputes from DB schema', async () => {
    const service = new TaskPricingEstimatorService(buildRepo() as never);

    // 客户端"伪造"的入参里没有任何位置可以传 estimatedCost —— TaskEstimateInput 根本没有这个字段。
    const result = await service.estimateCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'high' },
    });

    expect(result.estimatedCost).toBe(350); // 1 * 350，与 DB schema 一致，不受客户端影响
  });
});

// 「改价不影响已建立的快照」由 services/task-pricing-estimator.service.spec.ts:550
// 覆盖——那里在调用返回后真的 mutate 源 schema 再断言快照不变。此处曾有一份同名测试，
// 但它全程没有发生任何改价（构造两个互不相干的字面量再断言二者不同），已删除。

describe('pricing cutover — ajv rejects out-of-range params', () => {
  it('rejects an enum value outside the declared set', async () => {
    const service = new TaskPricingEstimatorService(buildRepo() as never);

    await expect(
      service.estimateCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        params: { quality: 'ultra-high' },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a request missing a required param', async () => {
    const service = new TaskPricingEstimatorService(buildRepo() as never);

    await expect(
      service.estimateCost({ taskType: 'image_generation', modelConfigId: 'model-1', params: {} }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('pricing cutover — discount stacking end to end', () => {
  it('combines the best non-stackable discount with all stackable ones through TaskPricingEstimatorService', async () => {
    const repo = buildRepo();
    repo.findActiveDiscounts = vi.fn().mockResolvedValue([
      { id: 'a', code: 'A', factor: { toString: () => '0.900' }, scope: {}, stackable: false, priority: 0, effectiveFrom: null, effectiveTo: null, isActive: true },
      { id: 'b', code: 'B', factor: { toString: () => '0.700' }, scope: {}, stackable: false, priority: 0, effectiveFrom: null, effectiveTo: null, isActive: true },
      { id: 'c', code: 'C', factor: { toString: () => '0.950' }, scope: {}, stackable: true, priority: 0, effectiveFrom: null, effectiveTo: null, isActive: true },
    ]);
    const service = new TaskPricingEstimatorService(repo as never);

    const result = await service.estimateCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'high' },
      membershipLevel: 1,
    });

    // 非 stackable 取最优 0.7，再叠加 stackable 0.95 = 0.665；350 * 0.665 = 232.75 -> ceil 233
    expect(result.pricingSnapshot.discountFactor).toBeCloseTo(0.665);
    expect(result.estimatedCost).toBe(233);
  });
});

describe('pricing cutover — NULL pricingSchema is a hard 400, never a free generation', () => {
  it('never returns estimatedCost 0 due to an unconfigured model', async () => {
    const repo = buildRepo();
    repo.findModelPricingConfig = vi.fn().mockResolvedValue({
      id: 'model-1', name: 'Unconfigured', paramsSchema: null, pricingSchema: null, schemaVersion: 1,
    });
    const service = new TaskPricingEstimatorService(repo as never);

    await expect(
      service.estimateCost({ taskType: 'image_generation', modelConfigId: 'model-1', params: {} }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('never returns estimatedCost 0 due to a missing task-model binding', async () => {
    const repo = buildRepo();
    repo.findBinding = vi.fn().mockResolvedValue(null);
    const service = new TaskPricingEstimatorService(repo as never);

    await expect(
      service.estimateCost({ taskType: 'image_generation', modelConfigId: 'unbound-model', params: {} }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
