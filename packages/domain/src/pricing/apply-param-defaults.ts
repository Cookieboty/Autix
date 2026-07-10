import type { ParamsSchema } from './types';

/**
 * Fills every property in `paramsSchema.properties` that declares a `default`
 * and is absent from `params`. Pure, zero-dependency (the module has no
 * runtime import beyond `./types`) so it can run in the frontend bundle, not
 * just the backend.
 *
 * This exists because `validateParams` is ajv in full strict mode and never
 * fills defaults itself — a caller that only knows part of a task's params
 * (canvas has no quality/resolution picker; a template's params are fixed by
 * its author) must have the rest filled in *before* validation, or every
 * such call 400s on `required`.
 *
 * Semantics, pinned deliberately:
 * - `{ quality: undefined }` is treated as absent and gets the default. This
 *   is what an optional caller field looks like in JS (e.g. a destructured
 *   value nobody set) — undefined never survives a real JSON boundary, so
 *   there is no meaningful "the caller explicitly chose undefined" case to
 *   protect.
 * - `{ quality: null }` is treated as present and is left alone. `null` is a
 *   real JSON value a caller can deliberately send; overwriting it with the
 *   default would hide a caller bug (or a deliberate "explicitly nothing")
 *   behind a silently-chosen price. It is passed through unchanged and, if
 *   the schema's `type` does not allow null, `validateParams` will reject it
 *   — which is the correct outcome, not this function's problem to solve.
 * - Properties without a `default` are never invented, no matter how the
 *   pricing schema's `required` array reads — an absent required property
 *   with no default is a genuine caller error and must still 400.
 * - `allOf`/`if-then` narrowed constraints (e.g. video `resolution: '4k'`
 *   narrows `seconds` to `maximum: 8`) are deliberately NOT evaluated here.
 *   Doing so would mean re-implementing JSON Schema conditional evaluation
 *   in a zero-dependency module — exactly the ajv-shaped work this file is
 *   not allowed to depend on. It is safe today because every base `default`
 *   in `MODEL_PRESETS` already satisfies every narrowed constraint that can
 *   apply to it (video `seconds` default is 5, the 4k-narrowed maximum is
 *   8) — see apply-param-defaults.test.ts, which checks this against the
 *   real presets rather than assuming it. If a future preset's base default
 *   ever violated a narrowed constraint, `validateParams` still catches it
 *   after filling (same as it would with no defaults filled at all) — this
 *   function cannot make that case worse, only fail to make it better.
 * - `x-ui: { control: 'hidden' }` properties (e.g. `inputTokens`,
 *   `outputTokens`, default 0) are filled exactly like any other property.
 *   This function has no notion of "hidden" — that is a UI-layer concept,
 *   and special-casing it here would smuggle caller-specific policy back
 *   into a supposedly mechanical, schema-driven fill, which is what this
 *   refactor exists to get away from. It is also a no-op either way for the
 *   current text preset: those fields are only ever referenced by additive
 *   `perUnit` terms, and an absent `perUnit` param is skipped (contributes
 *   nothing) while a present `0` contributes `0 * unitCost` — identical to
 *   the accumulator. Settlement is unaffected because it always re-prices
 *   from the frozen `PricingSnapshot.params`, filled or not, by design —
 *   this function does not change what settlement re-prices from, only
 *   ensures the snapshot is well-formed at estimate time.
 */
export function applyParamDefaults(
  paramsSchema: ParamsSchema,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const filled: Record<string, unknown> = { ...params };

  for (const [name, property] of Object.entries(paramsSchema.properties)) {
    if (!('default' in property)) continue;
    const isAbsent = !(name in filled) || filled[name] === undefined;
    if (isAbsent) {
      filled[name] = property.default;
    }
  }

  return filled;
}
