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

  it('reports all three first-term violations independently when first term violates all three rules', () => {
    const schema: PricingSchema = {
      terms: [
        {
          id: 'broken',
          op: 'mul',
          when: { all: [{ param: 'p', op: 'eq', value: true }] },
          table: { param: 'q', values: { a: 1 } },
        },
      ],
    } as unknown as PricingSchema;
    const violations = validatePricingSchema(schema);
    expect(violations.map((v) => v.code)).toContain('FIRST_TERM_MUST_BE_ADD');
    expect(violations.map((v) => v.code)).toContain('FIRST_TERM_MUST_BE_UNCONDITIONAL');
    expect(violations.map((v) => v.code)).toContain('FIRST_TERM_MUST_BE_CONST');
  });

  it('returns exactly one MALFORMED_TERM for a null first term (not two)', () => {
    const schema = { terms: [null] } as unknown as PricingSchema;
    const violations = validatePricingSchema(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MALFORMED_TERM');
  });

  it('returns exactly one MALFORMED_TERM for an undefined first term', () => {
    const schema = { terms: [undefined] } as unknown as PricingSchema;
    const violations = validatePricingSchema(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MALFORMED_TERM');
  });

  it('returns exactly one MALFORMED_TERM when first term is a string', () => {
    const schema = { terms: ['invalid'] } as unknown as PricingSchema;
    const violations = validatePricingSchema(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MALFORMED_TERM');
  });

  it('returns exactly one MALFORMED_TERM when first term is a number', () => {
    const schema = { terms: [42] } as unknown as PricingSchema;
    const violations = validatePricingSchema(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MALFORMED_TERM');
  });

  it('returns exactly one MALFORMED_TERM for a malformed second term after a valid first term', () => {
    const schema = {
      terms: [{ id: 'base', op: 'add', const: 1 }, undefined],
    } as unknown as PricingSchema;
    const violations = validatePricingSchema(schema);
    const malformedViolations = violations.filter((v) => v.code === 'MALFORMED_TERM');
    expect(malformedViolations).toHaveLength(1);
  });

  it('returns exactly one MALFORMED_TERM for each malformed term in a multi-term schema', () => {
    const schema = {
      terms: [{ id: 'base', op: 'add', const: 1 }, null, undefined],
    } as unknown as PricingSchema;
    const violations = validatePricingSchema(schema);
    const malformedViolations = violations.filter((v) => v.code === 'MALFORMED_TERM');
    expect(malformedViolations).toHaveLength(2);
  });
});
