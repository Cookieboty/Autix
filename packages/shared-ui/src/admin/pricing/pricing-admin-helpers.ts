import type {
  DryRunPricingInput,
  ParamsSchema,
  PricingDiscount,
  PricingSchema,
  TaskModelBinding,
} from '@autix/shared-store';

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

// ---------------------------------------------------------------------------------------------
// Degraded Excel (spec §5.3): unlike the old task-costs-bulk-excel.tsx, which imports/exports
// whole pricing rules (conditions + components) via a server-side .xlsx round trip, this Excel
// only round-trips the two scalar knobs left after the pricing-decoupling refactor:
// `task_model_bindings.multiplier` and `pricing_discounts.factor`. `isDefault`/`isActive`/`sort`
// on bindings and every other discount field stay out of the CSV — they're still edited through
// TaskBindingsView / DiscountsView.
// ---------------------------------------------------------------------------------------------

export interface BindingRow {
  taskType: string;
  modelConfigId: string;
  multiplier: number;
}

export interface DiscountRow {
  code: string;
  factor: number;
}

/**
 * Reads a value that may already be a `number` (e.g. round-tripped straight from `bindingsToRows`
 * in a test, or fed back through `rowsToBindingPatches` twice) or a raw CSV cell (always a
 * `string`, possibly blank or garbage) and returns a finite number, or `null` if it can't be
 * trusted. Deliberately rejects `''`/whitespace-only strings even though `Number('')` is `0` in
 * JS — a blank multiplier/factor cell in an uploaded sheet must be treated as missing data, not
 * silently coerced into zeroing out a price.
 */
function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * `TaskModelBinding.multiplier` arrives over the wire as a STRING — Prisma's `Decimal` serializes
 * via decimal.js's `toString()`/`toJSON()` over HTTP (see the comment on `TaskModelBinding` in
 * `packages/sdk/src/client.ts`). A CSV/spreadsheet cell has to hold a plain number, not a
 * decimal-string artifact like `"1.200"`, so this always converts with `Number(...)` rather than
 * passing the wire value through unchanged.
 */
export function bindingsToRows(
  bindings: Array<Pick<TaskModelBinding, 'taskType' | 'modelConfigId' | 'multiplier'>>,
): BindingRow[] {
  return bindings.map(({ taskType, modelConfigId, multiplier }) => ({
    taskType,
    modelConfigId,
    multiplier: Number(multiplier),
  }));
}

/**
 * Turns parsed rows (CSV cells, or a `BindingRow[]` round-tripped in-memory) back into binding
 * patches. Rows whose `multiplier` isn't a trustworthy finite number are DROPPED rather than
 * coerced to `0` — silently zeroing a price multiplier because of a typo in an uploaded sheet
 * would be a billing incident, not a validation nicety.
 */
export function rowsToBindingPatches(
  rows: Array<{ taskType?: unknown; modelConfigId?: unknown; multiplier?: unknown }>,
): BindingRow[] {
  const patches: BindingRow[] = [];
  for (const row of rows) {
    if (typeof row.taskType !== 'string' || row.taskType.trim() === '') continue;
    if (typeof row.modelConfigId !== 'string' || row.modelConfigId.trim() === '') continue;
    const multiplier = coerceFiniteNumber(row.multiplier);
    if (multiplier === null) continue;
    patches.push({ taskType: row.taskType, modelConfigId: row.modelConfigId, multiplier });
  }
  return patches;
}

/**
 * `PricingDiscount.factor` is the same Prisma `Decimal` situation as `TaskModelBinding.multiplier`
 * above: it's a wire-format STRING, converted to a number for the CSV cell.
 */
export function discountsToRows(
  discounts: Array<Pick<PricingDiscount, 'code' | 'factor'>>,
): DiscountRow[] {
  return discounts.map(({ code, factor }) => ({ code, factor: Number(factor) }));
}

/** Mirrors `rowsToBindingPatches`: drops rows with a non-numeric `factor` instead of zeroing it. */
export function rowsToDiscountPatches(
  rows: Array<{ code?: unknown; factor?: unknown }>,
): DiscountRow[] {
  const patches: DiscountRow[] = [];
  for (const row of rows) {
    if (typeof row.code !== 'string' || row.code.trim() === '') continue;
    const factor = coerceFiniteNumber(row.factor);
    if (factor === null) continue;
    patches.push({ code: row.code, factor });
  }
  return patches;
}
