import type { DryRunPricingInput, ParamsSchema, PricingSchema } from '@autix/shared-store';

/**
 * Parses admin-authored JSON (Monaco editor text) without throwing. `null` covers both
 * malformed JSON and any falsy-but-valid JSON (`null` literal) — callers treat both as
 * "nothing usable yet" and keep the previous state / show a validation hint instead of
 * crashing the editor.
 */
export function parseJsonOrNull(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Builds the `POST /admin/pricing/dry-run` request body. Shape matches `DryRunPricingInput`
 * (`packages/sdk/src/client.ts`) / `DryRunPricingDto` (services/api pricing-config-admin.dto.ts)
 * exactly: a flat `{ paramsSchema, pricingSchema, sampleParams }` object, not schemas nested
 * under a `schemas` key. The backend's `ValidationPipe({ whitelist: true })` silently strips any
 * property not declared on the DTO, so a nested `schemas` wrapper would be dropped in transit and
 * the request would fail schema validation with `paramsSchema`/`pricingSchema` missing.
 */
export function buildDryRunPayload(
  paramsSchema: ParamsSchema,
  pricingSchema: PricingSchema,
  sampleParams: Record<string, unknown>,
): DryRunPricingInput {
  return { paramsSchema, pricingSchema, sampleParams };
}
