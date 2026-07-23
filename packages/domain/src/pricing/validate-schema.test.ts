import { describe, expect, it } from 'vitest';
import { validateParamsSchema, validatePricingSchema } from './validate-schema';
import type { ParamsSchema, PricingSchema } from './types';

const codes = (schema: PricingSchema) => validatePricingSchema(schema).map((v) => v.code);

const paramsCodes = (p: ParamsSchema, pr?: PricingSchema) =>
  validateParamsSchema(p, pr).map((v) => v.code);

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

  it('names the offending index for a malformed term at index 0', () => {
    const schema = { terms: [null] } as unknown as PricingSchema;
    const violations = validatePricingSchema(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MALFORMED_TERM');
    expect(violations[0].message).toContain('terms[0]');
  });

  it('names the offending index for a malformed term at index 1', () => {
    const schema = {
      terms: [{ id: 'base', op: 'add', const: 1 }, undefined],
    } as unknown as PricingSchema;
    const violations = validatePricingSchema(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MALFORMED_TERM');
    expect(violations[0].message).toContain('terms[1]');
  });

  describe('malformed top-level schema (does not throw)', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an array', []],
      ['a string', 'x'],
      ['a number', 42],
      ['a boolean', true],
    ])('returns exactly one MALFORMED_SCHEMA violation for %s', (_label, value) => {
      const violations = validatePricingSchema(value as unknown as PricingSchema);
      expect(violations).toEqual([{ code: 'MALFORMED_SCHEMA', message: expect.any(String) }]);
    });

    it('does not throw for any malformed top-level input', () => {
      for (const value of [null, undefined, [], 'x', 42, true]) {
        expect(() => validatePricingSchema(value as unknown as PricingSchema)).not.toThrow();
      }
    });
  });

  it('regression: { terms: null } is a well-formed object with a bad terms field, still yields EMPTY_TERMS', () => {
    const schema = { terms: null } as unknown as PricingSchema;
    expect(validatePricingSchema(schema)).toEqual([
      { code: 'EMPTY_TERMS', message: 'pricingSchema requires at least one term' },
    ]);
  });
});

describe('validateParamsSchema', () => {
  const valid: ParamsSchema = {
    type: 'object',
    properties: {
      resolution: { type: 'string', enum: ['1K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
      seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
      audio: { type: 'boolean', default: false, 'x-ui': { control: 'switch' } },
      inputTokens: { type: 'integer', minimum: 0, default: 0, 'x-ui': { control: 'hidden' } },
    },
  };

  it('accepts a well-formed schema', () => {
    expect(validateParamsSchema(valid)).toEqual([]);
  });

  it('requires x-ui on every property', () => {
    const schema = {
      type: 'object',
      properties: { r: { type: 'string', enum: ['a'] } },
    } as unknown as ParamsSchema;
    expect(paramsCodes(schema)).toContain('MISSING_X_UI');
  });

  it('requires enum for chips and select', () => {
    const schema: ParamsSchema = {
      type: 'object',
      properties: { r: { type: 'string', 'x-ui': { control: 'chips' } } },
    };
    expect(paramsCodes(schema)).toContain('CHOICE_CONTROL_NEEDS_ENUM');
  });

  it('requires minimum and maximum for slider and stepper (missing maximum)', () => {
    const schema: ParamsSchema = {
      type: 'object',
      properties: { n: { type: 'integer', minimum: 1, 'x-ui': { control: 'stepper' } } },
    };
    expect(paramsCodes(schema)).toContain('RANGE_CONTROL_NEEDS_BOUNDS');
  });

  it('requires minimum and maximum for slider and stepper (missing minimum)', () => {
    const schema: ParamsSchema = {
      type: 'object',
      properties: { n: { type: 'integer', maximum: 10, 'x-ui': { control: 'stepper' } } },
    };
    expect(paramsCodes(schema)).toContain('RANGE_CONTROL_NEEDS_BOUNDS');
  });

  it('requires boolean type for switch', () => {
    const schema: ParamsSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-ui': { control: 'switch' } } },
    };
    expect(paramsCodes(schema)).toContain('SWITCH_NEEDS_BOOLEAN');
  });

  it('allows hidden control on any type without enum or bounds', () => {
    const schema: ParamsSchema = {
      type: 'object',
      properties: { anything: { type: 'string', 'x-ui': { control: 'hidden' } } },
    };
    expect(validateParamsSchema(schema)).toEqual([]);
  });

  it('rejects a pricingSchema referencing a param that does not exist', () => {
    const pricing: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 1 },
        { id: 'style', op: 'mul', table: { param: 'style', values: { anime: 2 } } },
      ],
    };
    expect(paramsCodes(valid, pricing)).toContain('PRICING_REFERENCES_UNKNOWN_PARAM');
  });

  it('accepts a pricingSchema whose params all exist', () => {
    const pricing: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 1 },
        { id: 'res', op: 'mul', table: { param: 'resolution', values: { '1K': 1, '4K': 4 } } },
        { id: 'dur', op: 'mul', perUnit: { param: 'seconds', unitCost: 1 } },
      ],
    };
    expect(validateParamsSchema(valid, pricing)).toEqual([]);
  });

  it('returns exactly one MALFORMED_PROPERTY for a null property value (not a throw)', () => {
    const schema = { type: 'object', properties: { a: null } } as unknown as ParamsSchema;
    const violations = validateParamsSchema(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MALFORMED_PROPERTY');
    expect(violations[0].message).toContain('a');
  });

  it('returns exactly one MALFORMED_PROPERTY for a string property value', () => {
    const schema = { type: 'object', properties: { s: 'not an object' } } as unknown as ParamsSchema;
    const violations = validateParamsSchema(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MALFORMED_PROPERTY');
  });

  it('returns exactly one MALFORMED_PROPERTY for a number property value', () => {
    const schema = { type: 'object', properties: { n: 42 } } as unknown as ParamsSchema;
    const violations = validateParamsSchema(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MALFORMED_PROPERTY');
  });

  it('reports MALFORMED_PROPERTY for a malformed property while still checking a well-formed sibling', () => {
    const schema = {
      type: 'object',
      properties: {
        bad: null,
        good: { type: 'string', enum: ['a'] },
      },
    } as unknown as ParamsSchema;
    const violations = validateParamsSchema(schema);
    expect(violations).toEqual([
      { code: 'MALFORMED_PROPERTY', message: 'properties[bad] is not a valid object', termId: 'bad' },
      { code: 'MISSING_X_UI', message: 'Parameter good is missing x-ui', termId: 'good' },
    ]);
  });

  describe('malformed top-level schema (does not throw)', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an array', []],
      ['a string', 'x'],
      ['a number', 42],
      ['a boolean', true],
    ])('returns exactly one MALFORMED_SCHEMA violation for %s', (_label, value) => {
      const violations = validateParamsSchema(value as unknown as ParamsSchema);
      expect(violations).toEqual([{ code: 'MALFORMED_SCHEMA', message: expect.any(String) }]);
    });

    it('does not throw for any malformed top-level input', () => {
      for (const value of [null, undefined, [], 'x', 42, true]) {
        expect(() => validateParamsSchema(value as unknown as ParamsSchema)).not.toThrow();
      }
    });
  });

  it('regression: an empty properties map is valid', () => {
    expect(validateParamsSchema({} as unknown as ParamsSchema)).toEqual([]);
  });

  describe('malformed second argument (pricingSchema)', () => {
    it('does not throw when pricingSchema is null, and reports MALFORMED_SCHEMA instead of silently skipping cross-schema checks', () => {
      const violations = validateParamsSchema(valid, null as unknown as PricingSchema);
      expect(() => validateParamsSchema(valid, null as unknown as PricingSchema)).not.toThrow();
      expect(violations).toEqual([{ code: 'MALFORMED_SCHEMA', message: expect.any(String) }]);
    });

    it('does not throw when pricingSchema is a malformed primitive', () => {
      for (const bad of [[], 'x', 42, true]) {
        expect(() => validateParamsSchema(valid, bad as unknown as PricingSchema)).not.toThrow();
        expect(validateParamsSchema(valid, bad as unknown as PricingSchema)).toEqual([
          { code: 'MALFORMED_SCHEMA', message: expect.any(String) },
        ]);
      }
    });
  });
});

describe('validateParamsSchema x-ui role/derivedFrom whitelist', () => {
  // ajv 对 x-ui 内部是零校验的（validate-params.ts:26 的 addKeyword valid:true）。
  // 这几条是唯一拦得住 role 拼错的地方 —— 拼错会静默缺省成 'both'，
  // 把一个纯 wire 参数当成计价参数。
  const base = (property: Record<string, unknown>) =>
    ({
      type: 'object' as const,
      properties: { size: property },
    }) as never;

  it('rejects an unknown role', () => {
    const violations = validateParamsSchema(
      base({ type: 'string', 'x-ui': { control: 'hidden', role: 'wier' } }),
    );
    expect(violations.map((v) => v.code)).toContain('UNKNOWN_X_UI_ROLE');
  });

  it('accepts each of the four legal roles', () => {
    for (const role of ['pricing', 'wire', 'both', 'derived'] as const) {
      const property: Record<string, unknown> = {
        type: 'string',
        'x-ui': { control: 'hidden', role },
      };
      if (role === 'derived') {
        (property['x-ui'] as Record<string, unknown>).derivedFrom = {
          param: 'other',
          via: 'imagePricingResolution',
        };
      }
      const schema = {
        type: 'object' as const,
        properties: {
          size: property,
          other: { type: 'string', 'x-ui': { control: 'hidden' } },
        },
      } as never;
      expect(validateParamsSchema(schema).map((v) => v.code)).not.toContain('UNKNOWN_X_UI_ROLE');
    }
  });

  it('treats an absent role as legal (defaults to both, backward compatible)', () => {
    const violations = validateParamsSchema(base({ type: 'string', 'x-ui': { control: 'hidden' } }));
    expect(violations.map((v) => v.code)).not.toContain('UNKNOWN_X_UI_ROLE');
  });

  it('rejects role: derived without derivedFrom', () => {
    const violations = validateParamsSchema(
      base({ type: 'string', 'x-ui': { control: 'hidden', role: 'derived' } }),
    );
    expect(violations.map((v) => v.code)).toContain('DERIVED_NEEDS_DERIVED_FROM');
  });

  it('rejects an unknown derive function', () => {
    const violations = validateParamsSchema(
      base({
        type: 'string',
        'x-ui': {
          control: 'hidden',
          role: 'derived',
          derivedFrom: { param: 'other', via: 'notARealFunction' },
        },
      }),
    );
    expect(violations.map((v) => v.code)).toContain('UNKNOWN_DERIVE_FN');
  });

  it('rejects derivedFrom pointing at a param that does not exist in the same schema', () => {
    const violations = validateParamsSchema(
      base({
        type: 'string',
        'x-ui': {
          control: 'hidden',
          role: 'derived',
          derivedFrom: { param: 'ghost', via: 'imagePricingResolution' },
        },
      }),
    );
    expect(violations.map((v) => v.code)).toContain('DERIVED_FROM_UNKNOWN_PARAM');
  });

  it('rejects a self-referencing derivedFrom', () => {
    const violations = validateParamsSchema(
      base({
        type: 'string',
        'x-ui': {
          control: 'hidden',
          role: 'derived',
          derivedFrom: { param: 'size', via: 'imagePricingResolution' },
        },
      }),
    );
    expect(violations.map((v) => v.code)).toContain('DERIVED_FROM_SELF');
  });
});
