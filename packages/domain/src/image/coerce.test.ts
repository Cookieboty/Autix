import { describe, expect, it } from 'vitest';
import {
  IMAGE_MODEL_CAPABILITIES,
  type ImageModelCapability,
} from './capabilities';
import {
  DEFAULT_ADVANCED_FALLBACKS,
  coerceClientSettings,
  coerceImageParams,
  mapEquivalentSize,
  type ImageStudioSettingsShape,
} from './coerce';

const baseSettings = (overrides: Partial<ImageStudioSettingsShape> = {}): ImageStudioSettingsShape => ({
  size: '1024x1024',
  quality: 'standard',
  count: 1,
  guidanceScale: 7,
  steps: 30,
  seed: '',
  promptTuning: '',
  stylePreset: '',
  negativePrompt: '',
  ...overrides,
});

const gptImage = IMAGE_MODEL_CAPABILITIES['gpt-image'];
const geminiFlash = IMAGE_MODEL_CAPABILITIES['gemini-flash-image'];
const gemini3Pro = IMAGE_MODEL_CAPABILITIES['gemini-3-pro-image'];
const compat = IMAGE_MODEL_CAPABILITIES['compatible'];

describe('mapEquivalentSize', () => {
  it('falls back to defaults.size when input is auto but capability has no auto', () => {
    // 没有任何 capability 再提供 'auto' 选项，因此所有模型都走这条回退。
    expect(mapEquivalentSize('auto', gptImage)).toBe(gptImage.defaults.size);
    expect(mapEquivalentSize('auto', geminiFlash)).toBe(geminiFlash.defaults.size);
  });

  it('returns auto when the capability does offer auto', () => {
    // mapEquivalentSize 仍保留「双方都支持 auto 时透传」的分支，但当前
    // IMAGE_MODEL_CAPABILITIES 里已无一个模型提供 auto，故用构造的 capability 覆盖它。
    const withAuto: ImageModelCapability = {
      ...gptImage,
      sizes: [{ label: '自动', value: 'auto' }, ...gptImage.sizes],
    };
    expect(mapEquivalentSize('auto', withAuto)).toBe('auto');
  });

  it('falls back to defaults.size when input is unparseable', () => {
    expect(mapEquivalentSize('garbage', compat)).toBe(compat.defaults.size);
  });

  it('maps 16:9 (1792x1024) from compatible to the gpt-image nearest 16:9 size', () => {
    expect(mapEquivalentSize('1792x1024', gptImage)).toBe('2048x1152');
  });

  it('maps 9:16 (1024x1792) from compatible to the gpt-image nearest 9:16 size', () => {
    expect(mapEquivalentSize('1024x1792', gptImage)).toBe('2160x3840');
  });

  it('keeps the value when it already belongs to the whitelist', () => {
    expect(mapEquivalentSize('1024x1024', geminiFlash)).toBe('1024x1024');
  });

  it('keeps gemini 3 encoded size tokens when they already belong to the whitelist', () => {
    expect(mapEquivalentSize('2048x2048@2K', gemini3Pro)).toBe('2048x2048@2K');
  });

  it('maps 4:3 (1024x768) coming from gemini to gpt-image (nearest is 3:2 = 1536x1024)', () => {
    // Gemini 4:3 = 1.333; candidates in gpt-image: 1.0, 1.5, 0.667 → 1.5 wins
    expect(mapEquivalentSize('1024x768', gptImage)).toBe('1536x1024');
  });
});

describe('coerceClientSettings', () => {
  it('passes through legal settings without changes for gpt-image', () => {
    const result = coerceClientSettings(
      baseSettings({ size: gptImage.defaults.size, quality: 'medium', count: 1 }),
      gptImage,
    );
    expect(result.changed).toEqual([]);
    expect(result.settings.size).toBe(gptImage.defaults.size);
    expect(result.settings.quality).toBe('medium');
    expect(result.settings.count).toBe(1);
  });

  it('remaps illegal size and records the change', () => {
    const result = coerceClientSettings(baseSettings({ size: '1792x1024', quality: 'medium' }), gptImage);
    expect(result.changed).toContain('尺寸');
    expect(result.settings.size).toBe('2048x1152');
  });

  it('falls back to default quality when the value is not on the whitelist', () => {
    const result = coerceClientSettings(baseSettings({ size: 'auto', quality: 'standard' }), gptImage);
    expect(result.changed).toContain('质量');
    expect(result.settings.quality).toBe(gptImage.defaults.quality);
  });

  it('silently strips quality for capabilities that have no quality dimension', () => {
    const result = coerceClientSettings(baseSettings({ size: '1024x1024', quality: 'hd' }), geminiFlash);
    expect(result.changed).not.toContain('质量');
    expect(result.settings.quality).toBe('');
  });

  it('clamps count to maxCount without exposing it as a client setting change', () => {
    const result = coerceClientSettings(
      baseSettings({ size: gptImage.defaults.size, quality: 'medium', count: 999 }),
      gptImage,
    );
    expect(result.changed).toEqual([]);
    expect(result.settings.count).toBe(gptImage.maxCount);
  });

  it('clamps count to 1 when negative without exposing it as a client setting change', () => {
    const result = coerceClientSettings(
      baseSettings({ size: gptImage.defaults.size, quality: 'medium', count: -3 }),
      gptImage,
    );
    expect(result.changed).toEqual([]);
    expect(result.settings.count).toBe(1);
  });

  it('silently resets advanced sliders when capability hides them', () => {
    const result = coerceClientSettings(
      baseSettings({
        size: 'auto',
        quality: 'medium',
        guidanceScale: 12,
        steps: 60,
        seed: '42',
      }),
      gptImage,
    );
    expect(result.changed).not.toContain('高级参数' as never);
    expect(result.settings.guidanceScale).toBe(DEFAULT_ADVANCED_FALLBACKS.guidanceScale);
    expect(result.settings.steps).toBe(DEFAULT_ADVANCED_FALLBACKS.steps);
    expect(result.settings.seed).toBe(DEFAULT_ADVANCED_FALLBACKS.seed);
  });

  it('preserves advanced sliders for compatible capability', () => {
    const result = coerceClientSettings(
      baseSettings({ guidanceScale: 10, steps: 50, seed: '42' }),
      compat,
    );
    expect(result.settings.guidanceScale).toBe(10);
    expect(result.settings.steps).toBe(50);
    expect(result.settings.seed).toBe('42');
  });

  it('drops negativePrompt when capability is "none"', () => {
    const fakeCap: ImageModelCapability = { ...compat, supportsNegativePrompt: 'none' };
    const result = coerceClientSettings(
      baseSettings({ negativePrompt: 'no people' }),
      fakeCap,
    );
    expect(result.changed).toContain('反向提示词');
    expect(result.settings.negativePrompt).toBe('');
  });

  it('honors caller-supplied advancedDefaults', () => {
    const result = coerceClientSettings(
      baseSettings({ size: 'auto', quality: 'medium' }),
      gptImage,
      { guidanceScale: 1.5, steps: 12, seed: 'abc' },
    );
    expect(result.settings.guidanceScale).toBe(1.5);
    expect(result.settings.steps).toBe(12);
    expect(result.settings.seed).toBe('abc');
  });
});

describe('coerceImageParams', () => {
  it('keeps legal gpt-image input untouched', () => {
    const out = coerceImageParams({
      kind: 'gpt-image',
      size: gptImage.defaults.size,
      quality: 'medium',
      count: 1,
    });
    expect(out.notes).toEqual([]);
    expect(out.size).toBe(gptImage.defaults.size);
    expect(out.quality).toBe('medium');
    expect(out.count).toBe(1);
  });

  it('remaps illegal size for gpt-image', () => {
    const out = coerceImageParams({ kind: 'gpt-image', size: '1792x1024' });
    expect(out.size).toBe('2048x1152');
    expect(out.notes.join('\n')).toMatch(/size .* → 2048x1152/);
  });

  it('drops quality when kind has no quality dimension (gemini flash)', () => {
    const out = coerceImageParams({ kind: 'gemini-flash-image', size: '1024x1024', quality: 'hd', count: 1 });
    expect(out.quality).toBeUndefined();
    expect(out.notes.join('\n')).toMatch(/quality hd dropped/);
  });

  it('falls back to default quality for compatible when input is invalid', () => {
    const out = coerceImageParams({ kind: 'compatible', size: '1024x1024', quality: 'ultra', count: 1 });
    expect(out.quality).toBe('standard');
    expect(out.notes.join('\n')).toMatch(/quality ultra → standard/);
  });

  it('clamps count above maxCount', () => {
    const out = coerceImageParams({ kind: 'gemini-flash-image', size: '1024x1024', count: 99 });
    expect(out.count).toBe(geminiFlash.maxCount);
    expect(out.notes.join('\n')).toMatch(/clamped to maxCount/);
  });

  it('clamps count below 1', () => {
    const out = coerceImageParams({ kind: 'compatible', size: '1024x1024', count: 0 });
    expect(out.count).toBe(1);
    expect(out.notes.join('\n')).toMatch(/clamped to minimum/);
  });

  it('uses defaults when no input is provided', () => {
    const out = coerceImageParams({ kind: 'compatible' });
    expect(out.size).toBe(compat.defaults.size);
    expect(out.quality).toBe(compat.defaults.quality);
    expect(out.count).toBe(compat.defaults.count);
    expect(out.notes).toEqual([]);
  });
});
