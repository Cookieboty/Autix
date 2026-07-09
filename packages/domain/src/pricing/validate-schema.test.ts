import { describe, expect, it } from 'vitest';
import { validatePricingSchema } from './validate-schema';
import type { PricingSchema } from './types';

const codes = (schema: PricingSchema) => validatePricingSchema(schema).map((v) => v.code);

describe('validatePricingSchema', () => {
  it('accepts a schema whose first term is an unconditional const add', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 90 },
        { id: 'res', op: 'mul', table: { param: 'resolution', values: { '1K': 1 } } },
      ],
    };
    expect(validatePricingSchema(schema)).toEqual([]);
  });

  it('rejects an empty terms array', () => {
    expect(codes({ terms: [] })).toContain('EMPTY_TERMS');
  });

  it('rejects a first term that is a mul', () => {
    const schema: PricingSchema = { terms: [{ id: 'x', op: 'mul', const: 2 }] };
    expect(codes(schema)).toContain('FIRST_TERM_MUST_BE_ADD');
  });

  it('rejects a first term carrying a when predicate', () => {
    const schema: PricingSchema = {
      terms: [{ id: 'x', op: 'add', const: 2, when: { all: [{ param: 'p', op: 'eq', value: true }] } }],
    };
    expect(codes(schema)).toContain('FIRST_TERM_MUST_BE_UNCONDITIONAL');
  });

  it('rejects a first term whose source is table or perUnit', () => {
    const tableFirst: PricingSchema = {
      terms: [{ id: 'x', op: 'add', table: { param: 'q', values: { a: 1 } } }],
    };
    expect(codes(tableFirst)).toContain('FIRST_TERM_MUST_BE_CONST');

    const perUnitFirst: PricingSchema = {
      terms: [{ id: 'x', op: 'add', perUnit: { param: 'n', unitCost: 1 } }],
    };
    expect(codes(perUnitFirst)).toContain('FIRST_TERM_MUST_BE_CONST');
  });

  it('rejects duplicate term ids', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 1 },
        { id: 'base', op: 'add', const: 2 },
      ],
    };
    expect(codes(schema)).toContain('DUPLICATE_TERM_ID');
  });

  it('rejects a term with zero or multiple value sources', () => {
    const none = { terms: [{ id: 'a', op: 'add' }] } as unknown as PricingSchema;
    expect(codes(none)).toContain('TERM_NEEDS_EXACTLY_ONE_SOURCE');

    const two = {
      terms: [{ id: 'a', op: 'add', const: 1, perUnit: { param: 'n', unitCost: 1 } }],
    } as unknown as PricingSchema;
    expect(codes(two)).toContain('TERM_NEEDS_EXACTLY_ONE_SOURCE');
  });

  it('rejects a perUnit divisor of zero', () => {
    const schema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 1 },
        { id: 'n', op: 'add', perUnit: { param: 'n', unitCost: 1, divisor: 0 } },
      ],
    };
    expect(codes(schema)).toContain('ZERO_DIVISOR');
  });
});
