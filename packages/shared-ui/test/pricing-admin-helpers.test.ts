import {
  bindingsToRows,
  buildDryRunPayload,
  discountsToRows,
  parseJsonOrNull,
  rowsToBindingPatches,
  rowsToDiscountPatches,
} from '../src/admin/pricing/pricing-admin-helpers';

describe('parseJsonOrNull', () => {
  test('parses valid JSON', () => {
    expect(parseJsonOrNull('{"terms":[]}')).toEqual({ terms: [] });
  });

  test('returns null for invalid JSON instead of throwing', () => {
    expect(parseJsonOrNull('{terms:[]')).toBeNull();
  });
});

describe('buildDryRunPayload', () => {
  // Flat shape, matching the real DryRunPricingInput/DryRunPricingDto wire contract (verified
  // against services/api/.../pricing-config-admin.dto.ts) — NOT schemas nested under a
  // `schemas` key, since a `ValidationPipe({ whitelist: true })` on the backend would strip an
  // unrecognized `schemas` property and drop paramsSchema/pricingSchema from the request.
  test('bundles both schemas with sample params into the flat DryRunPricingInput shape', () => {
    const paramsSchema = { type: 'object' as const, properties: {} };
    const pricingSchema = { terms: [{ id: 'base', op: 'add' as const, const: 90 }] };
    const payload = buildDryRunPayload(paramsSchema, pricingSchema, { resolution: '1K' });
    expect(payload).toEqual({
      paramsSchema,
      pricingSchema,
      sampleParams: { resolution: '1K' },
    });
  });
});

// Degraded Excel (spec §5.3): the new import/export only round-trips two scalars —
// task_model_bindings.multiplier and pricing_discounts.factor — via a plain CSV row shape.
describe('bindingsToRows / rowsToBindingPatches', () => {
  // `TaskModelBinding.multiplier` is a Prisma Decimal, which arrives over the wire as a STRING
  // (e.g. "1.200"), never a number. This is the load-bearing assertion: if bindingsToRows ever
  // regressed to passing the wire value through unchanged, `toEqual` would fail because
  // "1.200" !== 1.2, and the typeof check would fail too.
  test('converts the wire-format Decimal string to a number, not a copy of the string', () => {
    const rows = bindingsToRows([{ taskType: 'image_generation', modelConfigId: 'm1', multiplier: '1.200' }]);
    expect(rows).toEqual([{ taskType: 'image_generation', modelConfigId: 'm1', multiplier: 1.2 }]);
    expect(typeof rows[0]?.multiplier).toBe('number');
  });

  test('round-trips a BindingRow (already-numeric multiplier) through rowsToBindingPatches unchanged', () => {
    const rows = bindingsToRows([{ taskType: 'image_generation', modelConfigId: 'm1', multiplier: '1.2' }]);
    expect(rowsToBindingPatches(rows)).toEqual([{ taskType: 'image_generation', modelConfigId: 'm1', multiplier: 1.2 }]);
  });

  test('parses a raw CSV cell (string multiplier) into a numeric patch', () => {
    const patches = rowsToBindingPatches([{ taskType: 'image_generation', modelConfigId: 'm1', multiplier: '2.5' }]);
    expect(patches).toEqual([{ taskType: 'image_generation', modelConfigId: 'm1', multiplier: 2.5 }]);
  });

  test('drops rows with a non-numeric multiplier rather than silently coercing to 0', () => {
    const patches = rowsToBindingPatches([{ taskType: 'image_generation', modelConfigId: 'm1', multiplier: 'oops' }]);
    expect(patches).toEqual([]);
  });

  // Number('') === 0 in plain JS — this guards against that landmine turning a blank cell into a
  // silently-applied 0x multiplier.
  test('drops rows with a blank multiplier cell instead of treating it as 0', () => {
    const patches = rowsToBindingPatches([{ taskType: 'image_generation', modelConfigId: 'm1', multiplier: '' }]);
    expect(patches).toEqual([]);
  });

  test('drops rows missing taskType or modelConfigId', () => {
    expect(rowsToBindingPatches([{ modelConfigId: 'm1', multiplier: 1 }])).toEqual([]);
    expect(rowsToBindingPatches([{ taskType: 'image_generation', multiplier: 1 }])).toEqual([]);
  });
});

describe('discountsToRows / rowsToDiscountPatches', () => {
  // `PricingDiscount.factor` is the same Decimal-as-string situation as multiplier above.
  test('converts the wire-format Decimal string to a number, not a copy of the string', () => {
    const rows = discountsToRows([{ code: 'NEWYEAR', factor: '0.800' }]);
    expect(rows).toEqual([{ code: 'NEWYEAR', factor: 0.8 }]);
    expect(typeof rows[0]?.factor).toBe('number');
  });

  test('round-trips a DiscountRow through rowsToDiscountPatches unchanged', () => {
    const rows = discountsToRows([{ code: 'NEWYEAR', factor: '0.8' }]);
    expect(rowsToDiscountPatches(rows)).toEqual([{ code: 'NEWYEAR', factor: 0.8 }]);
  });

  test('parses a raw CSV cell (string factor) into a numeric patch', () => {
    const patches = rowsToDiscountPatches([{ code: 'NEWYEAR', factor: '0.75' }]);
    expect(patches).toEqual([{ code: 'NEWYEAR', factor: 0.75 }]);
  });

  test('drops rows with a non-numeric factor rather than silently coercing to 0', () => {
    const patches = rowsToDiscountPatches([{ code: 'NEWYEAR', factor: 'oops' }]);
    expect(patches).toEqual([]);
  });

  test('drops rows missing a code', () => {
    expect(rowsToDiscountPatches([{ factor: 0.8 }])).toEqual([]);
  });
});
