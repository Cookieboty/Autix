import { describe, expect, it } from 'vitest';
import { evaluatePricing } from './evaluate';
import { affectedParams, priceOptions } from './introspect';
import { quoteTask } from './quote';
import type { ParamsSchema, PricingSchema } from './types';

describe('affectedParams', () => {
  it('returns an empty list for a const-only schema', () => {
    expect(affectedParams({ terms: [{ id: 'base', op: 'add', const: 90 }] })).toEqual([]);
  });

  it('collects params from table, perUnit and when', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 1 },
        { id: 'quality', op: 'mul', table: { param: 'quality', values: { low: 15 } } },
        { id: 'refs', op: 'add', perUnit: { param: 'referenceImages', unitCost: 5 } },
        { id: 'prio', op: 'mul', const: 1.5, when: { all: [{ param: 'priority', op: 'eq', value: true }] } },
      ],
    };
    expect(affectedParams(schema)).toEqual(['quality', 'referenceImages', 'priority']);
  });

  it('deduplicates a param referenced from several places', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 1 },
        { id: 'a', op: 'mul', table: { param: 'resolution', values: { '4K': 4 } } },
        { id: 'b', op: 'add', const: 50, when: { all: [{ param: 'resolution', op: 'eq', value: '4K' }] } },
      ],
    };
    expect(affectedParams(schema)).toEqual(['resolution']);
  });
});

const paramsSchema: ParamsSchema = {
  type: 'object',
  properties: {
    quality: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium', 'x-ui': { control: 'chips' } },
    resolution: { type: 'string', enum: ['1K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
    style: { type: 'string', enum: ['anime', 'photo'], default: 'photo', 'x-ui': { control: 'select' } },
  },
};

const pricingSchema: PricingSchema = {
  terms: [
    { id: 'base', op: 'add', const: 1 },
    { id: 'quality', op: 'mul', table: { param: 'quality', values: { low: 15, medium: 90, high: 350 } } },
    { id: 'resolution', op: 'mul', table: { param: 'resolution', values: { '1K': 1, '4K': 4 } } },
  ],
};

const ctx = { multiplier: 1, discountFactor: 1 };

describe('priceOptions', () => {
  it('prices every enum option of every price-affecting param', () => {
    const result = priceOptions(paramsSchema, pricingSchema, { quality: 'medium', resolution: '1K' }, ctx);
    expect(result.quality).toEqual({ low: 15, medium: 90, high: 350 });
    expect(result.resolution).toEqual({ '1K': 90, '4K': 360 });
  });

  it('holds the other params at their current values', () => {
    const result = priceOptions(paramsSchema, pricingSchema, { quality: 'high', resolution: '1K' }, ctx);
    expect(result.resolution).toEqual({ '1K': 350, '4K': 1400 });
  });

  it('omits params that do not affect price', () => {
    const result = priceOptions(paramsSchema, pricingSchema, { quality: 'low', resolution: '1K' }, ctx);
    expect(result.style).toBeUndefined();
  });

  it('omits non-enum params even when they affect price', () => {
    const withSeconds: PricingSchema = {
      terms: [...pricingSchema.terms, { id: 'dur', op: 'mul', perUnit: { param: 'seconds', unitCost: 1 } }],
    };
    const result = priceOptions(paramsSchema, withSeconds, { quality: 'low', resolution: '1K', seconds: 5 }, ctx);
    expect(result.seconds).toBeUndefined();
  });

  it('applies multiplier and discount', () => {
    const result = priceOptions(paramsSchema, pricingSchema, { quality: 'medium', resolution: '1K' }, {
      multiplier: 2, discountFactor: 0.5,
    });
    expect(result.quality).toEqual({ low: 15, medium: 90, high: 350 });
  });

  it('agrees with quoteTask for each option', () => {
    const result = priceOptions(paramsSchema, pricingSchema, { quality: 'medium', resolution: '4K' }, ctx);
    for (const [value, price] of Object.entries(result.quality)) {
      const expected = quoteTask({
        modelSchema: pricingSchema, multiplier: 1, discountFactor: 1,
        params: { quality: value, resolution: '4K' },
      }).total;
      expect(price).toBe(expected);
    }
  });

  it('excludes taskFixedCost from every option price', () => {
    // 防止后来者「顺手」把 taskFixedSchema 加进 priceOptions。
    // 直接算出模型侧应有的价格，逐个比对——若实现里混入了任务侧开销，这里必红。
    const result = priceOptions(paramsSchema, pricingSchema, { quality: 'medium', resolution: '1K' }, ctx);

    for (const [value, price] of Object.entries(result.quality)) {
      const modelOnly = evaluatePricing(pricingSchema, {
        quality: value,
        resolution: '1K',
      }).total * ctx.multiplier * ctx.discountFactor;
      expect(price, `quality=${value}`).toBe(Math.ceil(modelOnly));
    }
  });
});
