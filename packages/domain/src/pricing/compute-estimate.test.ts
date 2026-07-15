import { describe, expect, it } from 'vitest';
import { computeTaskEstimate } from './compute-estimate';
import { applyParamDefaults } from './apply-param-defaults';
import { deriveParams } from './derive';
import { quoteTask } from './quote';
import type { ParamsSchema, PricingSchema } from './types';

const paramsSchema: ParamsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['quality'],
  properties: {
    quality: {
      type: 'string',
      enum: ['low', 'high'],
      default: 'low',
      'x-ui': { role: 'both', control: 'chips' },
    },
  },
};

const pricingSchema: PricingSchema = {
  terms: [
    { id: 'base', op: 'add', const: 1 },
    { id: 'quality', op: 'mul', table: { param: 'quality', values: { low: 10, high: 100 } } },
  ],
};

describe('computeTaskEstimate', () => {
  it('runs defaults → derive → validate → quote and returns the total', () => {
    const result = computeTaskEstimate({
      pricingSchema,
      paramsSchema,
      multiplier: 2,
      discountFactor: 0.5,
      taskFixedSchema: null,
      params: { quality: 'high' },
    });
    // base(1) × quality(100) = 100；× multiplier 2 × discount 0.5 = 100
    expect(result.violations).toHaveLength(0);
    expect(result.total).toBe(100);
  });

  it('填充默认值：缺省 quality 时按 schema default(low) 计', () => {
    const result = computeTaskEstimate({
      pricingSchema,
      paramsSchema,
      multiplier: 1,
      discountFactor: 1,
      taskFixedSchema: null,
      params: {}, // 不传 quality → applyParamDefaults 补 low
    });
    // base(1) × quality(low=10) = 10
    expect(result.total).toBe(10);
    expect(result.params.quality).toBe('low');
  });

  it('与手动跑同一顺序结果一致（锁死编排）', () => {
    const raw = { quality: 'high' };
    const manual = quoteTask({
      modelSchema: pricingSchema,
      multiplier: 3,
      discountFactor: 1,
      taskFixedSchema: null,
      params: deriveParams(paramsSchema, applyParamDefaults(paramsSchema, raw)),
    });
    const viaCompute = computeTaskEstimate({
      pricingSchema,
      paramsSchema,
      multiplier: 3,
      discountFactor: 1,
      taskFixedSchema: null,
      params: raw,
    });
    expect(viaCompute.total).toBe(manual.total);
  });

  it('参数不合法：返回 violations、total 无意义（不抛异常）', () => {
    const result = computeTaskEstimate({
      pricingSchema,
      paramsSchema,
      multiplier: 1,
      discountFactor: 1,
      taskFixedSchema: null,
      params: { quality: 'ultra' }, // 不在 enum 里
    });
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
