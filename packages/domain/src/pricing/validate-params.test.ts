import { describe, expect, it } from 'vitest';
import { validateParams } from './validate-params';
import type { ParamsSchema } from './types';

const schema: ParamsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['resolution'],
  properties: {
    resolution: { type: 'string', enum: ['512px', '1K', '2K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
  },
  allOf: [
    {
      if: { properties: { resolution: { const: '4K' } } },
      then: { properties: { seconds: { type: 'integer', maximum: 8 } } },
    },
  ],
};

const schemaWithUndeclaredThenType = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['resolution'],
  properties: {
    resolution: { type: 'string', enum: ['512px', '1K', '2K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
  },
  allOf: [
    { if: { properties: { resolution: { const: '4K' } } }, then: { properties: { seconds: { maximum: 8 } } } },
  ],
} as unknown as ParamsSchema;

describe('validateParams', () => {
  it('accepts valid params', () => {
    expect(validateParams(schema, { resolution: '1K', seconds: 12 })).toEqual([]);
  });

  it('rejects a value outside the enum', () => {
    const violations = validateParams(schema, { resolution: '8K' });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].path).toBe('/resolution');
  });

  it('rejects a missing required param', () => {
    expect(validateParams(schema, { seconds: 5 }).length).toBeGreaterThan(0);
  });

  it('rejects a number below the minimum', () => {
    const violations = validateParams(schema, { resolution: '1K', seconds: 2 });
    expect(violations[0].path).toBe('/seconds');
  });

  it('enforces the if-then constraint: 4K caps seconds at 8', () => {
    expect(validateParams(schema, { resolution: '4K', seconds: 8 })).toEqual([]);
    expect(validateParams(schema, { resolution: '4K', seconds: 12 }).length).toBeGreaterThan(0);
  });

  it('ignores the x-ui annotation rather than treating it as an unknown keyword', () => {
    expect(() => validateParams(schema, { resolution: '1K' })).not.toThrow();
  });

  it('rejects a then-branch constraint whose type is not declared', () => {
    expect(() =>
      validateParams(schemaWithUndeclaredThenType, { resolution: '4K', seconds: 8 }),
    ).toThrow(/strict mode/i);
  });
});
