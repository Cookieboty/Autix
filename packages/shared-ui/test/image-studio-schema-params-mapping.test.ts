import { describe, expect, test } from 'bun:test';
import { IMAGE_MODEL_CAPABILITIES } from '@autix/domain/image';
import { schemaParamsToImageSettings } from '../src/image/studio/schema-params-mapping';

const gemini3Pro = IMAGE_MODEL_CAPABILITIES['gemini-3-pro-image'];
const compatible = IMAGE_MODEL_CAPABILITIES['compatible'];

describe('schemaParamsToImageSettings', () => {
  test('translates quality/resolution/quantity into quality/size/count (task 7 DoD example)', () => {
    const result = schemaParamsToImageSettings(
      { quality: 'high', resolution: '2K', quantity: 4 },
      gemini3Pro.defaults.size, // '1024x1024@1K'
      gemini3Pro,
    );
    // resolution tier '2K' at the current 1:1 aspect maps to the real
    // capability size '2048x2048@2K' (packages/domain/src/image/size-selection.ts,
    // buildImageSizeResolutionGroups + selectImageSizeResolution) — not a
    // renamed-but-unchanged '2K' string, and not dropped.
    expect(result).toEqual({ quality: 'high', size: '2048x2048@2K', count: 4 });
  });

  test('resolution tier maps to the concrete size for the current aspect ratio, not just a rename', () => {
    expect(
      schemaParamsToImageSettings({ resolution: '4K' }, gemini3Pro.defaults.size, gemini3Pro),
    ).toEqual({ size: '4096x4096@4K' });

    // Switch aspect first (settings already at 16:9 @ 1K), then request 4K —
    // the aspect must be preserved, proving this isn't a static lookup table.
    expect(
      schemaParamsToImageSettings({ resolution: '4K' }, '1376x768@1K', gemini3Pro),
    ).toEqual({ size: '5504x3072@4K' });
  });

  test('capabilities with a single inferred resolution tier (no real resolution axis) keep size unchanged instead of writing a bogus value', () => {
    // `compatible` only ever infers one '1K'-tier group (longer side < 1900px
    // for every listed size) — selecting '4K' has nothing to switch to.
    expect(
      schemaParamsToImageSettings({ resolution: '4K' }, compatible.defaults.size, compatible),
    ).toEqual({ size: compatible.defaults.size });
  });

  test('an implementation that drops resolution (orphan key) or writes the raw tier string under `size` must fail this test', () => {
    const result = schemaParamsToImageSettings(
      { resolution: '2K' },
      gemini3Pro.defaults.size,
      gemini3Pro,
    );
    expect(result).not.toHaveProperty('resolution');
    expect(result.size).not.toBe('2K');
    expect(result.size).toBe('2048x2048@2K');
  });

  test('quantity renames to count unchanged; quality renames to quality unchanged', () => {
    expect(schemaParamsToImageSettings({ quantity: 3 }, gemini3Pro.defaults.size, gemini3Pro)).toEqual({
      count: 3,
    });
    expect(schemaParamsToImageSettings({ quality: 'low' }, gemini3Pro.defaults.size, gemini3Pro)).toEqual({
      quality: 'low',
    });
  });

  test('ignores unrelated/absent keys and does not choke on referenceImages', () => {
    expect(
      schemaParamsToImageSettings({ referenceImages: 2 }, gemini3Pro.defaults.size, gemini3Pro),
    ).toEqual({});
  });
});
