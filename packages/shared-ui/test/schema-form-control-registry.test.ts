import { describe, expect, test } from 'bun:test';
import type { XUiControl } from '@autix/domain/pricing';
import { CONTROL_REGISTRY } from '../src/pricing/SchemaForm/controlRegistry';

/**
 * `XUiControl` is a compile-time-only union (domain has no runtime enum/const
 * for it), so there is no importable runtime value to enumerate here. This
 * object's type — `Record<Exclude<XUiControl, 'hidden'>, true>` — pins its key
 * set to the domain type instead: adding, removing, or renaming a member of
 * `XUiControl` (other than `hidden`) makes this literal fail `tsc` (missing or
 * excess property) until it's updated, so the expected set can't silently
 * drift from the domain type on `bun run --cwd packages/shared-ui typecheck`.
 * (`bun test` itself only strips types — it never runs tsc — so this
 * assertion doesn't fail this file directly, but the mismatch is exactly what
 * the typecheck step in Definition of Done exists to catch, and this file is
 * the single hardcoded key list in the whole check — `CONTROL_REGISTRY`
 * itself has no independent key list to drift against.)
 */
const EXPECTED_CONTROLS: Record<Exclude<XUiControl, 'hidden'>, true> = {
  chips: true,
  select: true,
  'size-grid': true,
  slider: true,
  stepper: true,
  switch: true,
  text: true,
  textarea: true,
};

describe('CONTROL_REGISTRY', () => {
  test('has an entry for every non-hidden x-ui.control', () => {
    expect(Object.keys(CONTROL_REGISTRY).sort()).toEqual(Object.keys(EXPECTED_CONTROLS).sort());
  });

  test('does not register a hidden control — hidden is never rendered', () => {
    expect('hidden' in CONTROL_REGISTRY).toBe(false);
  });
});
