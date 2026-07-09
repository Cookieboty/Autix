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
