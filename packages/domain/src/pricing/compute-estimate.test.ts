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
      multiplier: 3,
      discountFactor: 0.5,
      taskFixedSchema: null,
      params: { quality: 'high' },
    });
    // base(1) × quality(100) = 100；× multiplier 3 × discount 0.5 = 150
    // 乘积刻意不为 1，否则实现忽略这两个入参也测不出来。
    expect(result.violations).toHaveLength(0);
    expect(result.total).toBe(150);
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

  // defaults 必须早于 derive：派生源 size 本身有 default，调用方不传 size 时，
  // 只有先补默认值、再派生，resolution 才算得出来。顺序反了 resolution 缺失 → violations。
  const derivedParamsSchema: ParamsSchema = {
    type: 'object',
    required: ['quality', 'resolution'],
    properties: {
      size: {
        type: 'string',
        enum: ['1024x1024@1K', '4096x4096@4K'],
        default: '4096x4096@4K',
        'x-ui': { control: 'hidden', role: 'wire' },
      },
      quality: {
        type: 'string',
        enum: ['low', 'high'],
        default: 'low',
        'x-ui': { control: 'chips', role: 'both' },
      },
      resolution: {
        type: 'string',
        enum: ['1K', '4K'],
        'x-ui': {
          control: 'hidden',
          role: 'derived',
          derivedFrom: { param: 'size', via: 'imagePricingResolution' },
        },
      },
    },
  };

  const derivedPricingSchema: PricingSchema = {
    terms: [
      { id: 'base', op: 'add', const: 1 },
      { id: 'res', op: 'mul', table: { param: 'resolution', values: { '1K': 10, '4K': 40 } } },
    ],
  };

  it('defaults 早于 derive：不传 size 也能派生出 resolution 并按其计价', () => {
    const result = computeTaskEstimate({
      pricingSchema: derivedPricingSchema,
      paramsSchema: derivedParamsSchema,
      multiplier: 1,
      discountFactor: 1,
      taskFixedSchema: null,
      params: { quality: 'high' },
    });

    expect(result.violations).toHaveLength(0);
    expect(result.params.resolution).toBe('4K');
    expect(result.total).toBe(40);
  });

  it('derive 覆盖调用方传入的派生参数（防止按低档计价）', () => {
    const result = computeTaskEstimate({
      pricingSchema: derivedPricingSchema,
      paramsSchema: derivedParamsSchema,
      multiplier: 1,
      discountFactor: 1,
      taskFixedSchema: null,
      params: { quality: 'high', size: '4096x4096@4K', resolution: '1K' },
    });

    expect(result.params.resolution).toBe('4K');
    expect(result.total).toBe(40);
  });

  it('与手动跑同一顺序结果一致（锁死编排）', () => {
    const raw = { quality: 'high' };
    const manual = quoteTask({
      modelSchema: derivedPricingSchema,
      multiplier: 3,
      discountFactor: 1,
      taskFixedSchema: null,
      params: deriveParams(derivedParamsSchema, applyParamDefaults(derivedParamsSchema, raw)),
    });
    const viaCompute = computeTaskEstimate({
      pricingSchema: derivedPricingSchema,
      paramsSchema: derivedParamsSchema,
      multiplier: 3,
      discountFactor: 1,
      taskFixedSchema: null,
      params: raw,
    });
    expect(viaCompute.total).toBe(manual.total);
    expect(viaCompute.total).toBeGreaterThan(0);
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
