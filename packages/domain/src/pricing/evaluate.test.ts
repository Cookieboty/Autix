import { describe, expect, it } from 'vitest';
import { evaluatePricing } from './evaluate';
import type { PricingSchema } from './types';

describe('evaluatePricing — const terms', () => {
  it('sums a single add term', () => {
    const schema: PricingSchema = { terms: [{ id: 'base', op: 'add', const: 90 }] };
    expect(evaluatePricing(schema, {}).total).toBe(90);
  });

  it('applies add and mul in array order', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 10 },
        { id: 'extra', op: 'add', const: 5 },
        { id: 'double', op: 'mul', const: 2 },
      ],
    };
    // (0 + 10 + 5) * 2 = 30 —— 若顺序错成先乘则为 20
    expect(evaluatePricing(schema, {}).total).toBe(30);
  });

  it('does not round', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 15 },
        { id: 'half', op: 'mul', const: 0.5 },
      ],
    };
    expect(evaluatePricing(schema, {}).total).toBe(7.5);
  });

  it('reports a breakdown entry per applied term', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 10 },
        { id: 'double', op: 'mul', const: 2 },
      ],
    };
    expect(evaluatePricing(schema, {}).breakdown).toEqual([
      { id: 'base', op: 'add', contribution: 10, accumulatorAfter: 10 },
      { id: 'double', op: 'mul', contribution: 2, accumulatorAfter: 20 },
    ]);
  });
});

describe('evaluatePricing — table source', () => {
  const resolutionTerm = {
    id: 'resolution',
    op: 'mul' as const,
    table: { param: 'resolution', values: { '512px': 0.5, '1K': 1, '2K': 2, '4K': 4 } },
  };

  it('looks the multiplier up by param value', () => {
    const schema: PricingSchema = {
      terms: [{ id: 'base', op: 'add', const: 90 }, resolutionTerm],
    };
    expect(evaluatePricing(schema, { resolution: '4K' }).total).toBe(360);
    expect(evaluatePricing(schema, { resolution: '512px' }).total).toBe(45);
  });

  it('uses fallback when the value is not in the table', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 90 },
        { ...resolutionTerm, table: { ...resolutionTerm.table, fallback: 1 } },
      ],
    };
    expect(evaluatePricing(schema, { resolution: '8K' }).total).toBe(90);
  });

  it('skips the term when the value misses and there is no fallback', () => {
    const schema: PricingSchema = {
      terms: [{ id: 'base', op: 'add', const: 90 }, resolutionTerm],
    };
    const result = evaluatePricing(schema, { resolution: '8K' });
    expect(result.total).toBe(90);
    expect(result.breakdown.map((b) => b.id)).toEqual(['base']);
  });

  it('skips the term when the param is absent', () => {
    const schema: PricingSchema = {
      terms: [{ id: 'base', op: 'add', const: 90 }, resolutionTerm],
    };
    expect(evaluatePricing(schema, {}).total).toBe(90);
  });

  it('coerces numeric and boolean param values to table keys', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 10 },
        { id: 'tier', op: 'mul', table: { param: 'tier', values: { '2': 3 } } },
      ],
    };
    expect(evaluatePricing(schema, { tier: 2 }).total).toBe(30);
  });
});
