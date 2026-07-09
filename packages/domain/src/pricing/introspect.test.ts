import { describe, expect, it } from 'vitest';
import { affectedParams } from './introspect';
import type { PricingSchema } from './types';

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
