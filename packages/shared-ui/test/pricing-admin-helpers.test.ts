import { describe, expect, test } from 'bun:test';
import { buildDryRunPayload, parseJsonOrNull } from '../src/admin/pricing/pricing-admin-helpers';

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
