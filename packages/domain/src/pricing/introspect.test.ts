import { describe, expect, it } from 'vitest';
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
    // multiplier(3) * discountFactor(0.5) = 1.5 — deliberately not 1, so this
    // test actually detects an implementation that ignores ctx.
    const scaledCtx = { multiplier: 3, discountFactor: 0.5 };
    const result = priceOptions(paramsSchema, pricingSchema, { quality: 'medium', resolution: '1K' }, scaledCtx);

    // Model-side total (base=1, resolution=1K=1x) per candidate, then × 1.5, then ceil:
    //   low:    1 * 15  * 1 = 15  → 15  * 1.5 = 22.5 → ceil 23
    //   medium: 1 * 90  * 1 = 90  → 90  * 1.5 = 135  → ceil 135
    //   high:   1 * 350 * 1 = 350 → 350 * 1.5 = 525  → ceil 525
    expect(result.quality).toEqual({ low: 23, medium: 135, high: 525 });

    // Must differ from the 1/1 baseline, or a regression to "ignore ctx" would pass silently.
    const baseline = priceOptions(paramsSchema, pricingSchema, { quality: 'medium', resolution: '1K' }, ctx);
    expect(result.quality).not.toEqual(baseline.quality);
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
    // 用一个真正会产生非零 taskFixedCost 的 schema，证明 priceOptions 的结果
    // 等于「不带 taskFixedSchema」的 quoteTask 总价，而不是「带 taskFixedSchema」的总价。
    const taskFixedSchema: PricingSchema = {
      terms: [
        { id: 'taskBase', op: 'add', const: 0 },
        { id: 'toolCalls', op: 'add', perUnit: { param: 'toolCalls', unitCost: 2 } },
      ],
    };

    const params = { quality: 'medium', resolution: '1K' };

    const withoutFixed = quoteTask({
      modelSchema: pricingSchema, multiplier: 1, discountFactor: 1, params,
    });
    const withFixed = quoteTask({
      modelSchema: pricingSchema, multiplier: 1, discountFactor: 1,
      taskFixedSchema, params, usage: { toolCalls: 5 },
    });

    // 先证明这个 fixture 真的会产生 taskFixedCost（否则下面的比对没有意义）。
    expect(withFixed.total).not.toBe(withoutFixed.total);
    expect(withFixed.total).toBe(withoutFixed.total + 10); // 0 + 5 * 2 = 10

    const result = priceOptions(paramsSchema, pricingSchema, params, ctx);
    expect(result.quality.medium).toBe(withoutFixed.total);
    expect(result.quality.medium).not.toBe(withFixed.total);
  });

  it('does not price options for a wire-role param', () => {
    const schema: ParamsSchema = {
      type: 'object',
      properties: {
        size: { type: 'string', enum: ['1024x1024@1K', '2048x2048@2K'],
                'x-ui': { role: 'wire', control: 'size-grid' } },
        resolution: { type: 'string', enum: ['1K', '2K'],
                      'x-ui': { role: 'derived', control: 'hidden',
                                derivedFrom: { param: 'size', via: 'imagePricingResolution' } } },
      },
    };
    // 'size' 必须真的出现在 affectedParams 里（比如误挂了一条按 size 查表的 term），
    // 否则这个用例测不到 wire 跳过逻辑 —— priceOptions 本来就不会碰一个 pricingSchema
    // 没引用的参数。
    const wireAffectingPricing: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 1 },
        { id: 'size', op: 'mul', table: { param: 'size', values: { '1024x1024@1K': 1, '2048x2048@2K': 4 } } },
      ],
    };
    const priced = priceOptions(schema, wireAffectingPricing, { size: '1024x1024@1K' }, ctx);
    expect(priced.size).toBeUndefined();
  });
});
