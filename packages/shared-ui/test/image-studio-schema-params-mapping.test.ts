import { describe, expect, test } from 'bun:test';
import { IMAGE_MODEL_CAPABILITIES } from '@autix/domain/image';
import {
  imageSettingsToSchemaParams,
  schemaParamsToImageSettings,
} from '../src/image/studio/schema-params-mapping';

const gemini3Pro = IMAGE_MODEL_CAPABILITIES['gemini-3-pro-image'];
const compatible = IMAGE_MODEL_CAPABILITIES['compatible'];

describe('schemaParamsToImageSettings', () => {
  test('translates quality/resolution into quality/size (quantity removed — count is not a schema param)', () => {
    const result = schemaParamsToImageSettings(
      { quality: 'high', resolution: '2K', quantity: 4 },
      gemini3Pro.defaults.size, // '1024x1024@1K'
      gemini3Pro,
    );
    // resolution tier '2K' at the current 1:1 aspect maps to the real
    // capability size '2048x2048@2K' (packages/domain/src/image/size-selection.ts,
    // buildImageSizeResolutionGroups + selectImageSizeResolution) — not a
    // renamed-but-unchanged '2K' string, and not dropped. quantity is ignored:
    // 生成张数已从图像 schema 移除，不再写 count。
    expect(result).toEqual({ quality: 'high', size: '2048x2048@2K' });
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

  test('quantity is ignored (no longer a schema param); quality renames to quality unchanged', () => {
    expect(schemaParamsToImageSettings({ quantity: 3 }, gemini3Pro.defaults.size, gemini3Pro)).toEqual({});
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

describe('imageSettingsToSchemaParams (reverse, P1-3 form init/sync)', () => {
  test('maps size->resolution tier and quality (quantity/count removed from schema)', () => {
    expect(
      imageSettingsToSchemaParams({ size: '2048x2048@2K', quality: 'high' }),
    ).toEqual({ resolution: '2K', quality: 'high' });
  });

  test('every size infers a tier (falls back to 1K); quality passes through', () => {
    expect(imageSettingsToSchemaParams({ size: '512x512', quality: 'low' })).toEqual({
      resolution: '1K',
      quality: 'low',
    });
  });

  test('omits quality when absent/empty (does not emit undefined keys)', () => {
    expect(imageSettingsToSchemaParams({ size: '1024x1024@1K', quality: '' })).toEqual({
      resolution: '1K',
    });
  });

  // The round-trip must be idempotent: reverse(settings) -> forward(...) -> the
  // same settings. This is exactly what stops useSchemaFormExternalSync from
  // looping (settings -> form -> settings -> ...) and what stops the mount sync
  // from overwriting existing settings with schema defaults. count 不参与（已从
  // schema 移除），只往返 size/quality。
  test('round-trip settings -> schema params -> settings is stable', () => {
    for (const settings of [
      { size: '2048x2048@2K', quality: 'high' },
      { size: '4096x4096@4K', quality: 'medium' },
      { size: '1376x768@1K', quality: 'low' },
    ]) {
      const schemaParams = imageSettingsToSchemaParams(settings);
      const back = schemaParamsToImageSettings(schemaParams, settings.size, gemini3Pro);
      expect(back).toEqual(settings);
    }
  });
});
