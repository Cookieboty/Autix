import { describe, expect, it } from 'vitest';
import {
  IMAGE_MODEL_CAPABILITIES,
  detectImageModelKind,
  getImageCapability,
  type ImageModelKind,
} from './image-capabilities';

describe('detectImageModelKind', () => {
  const cases: Array<{ hint: { provider?: string | null; model?: string | null }; expected: ImageModelKind }> = [
    { hint: { provider: 'openai', model: 'gpt-image-1' }, expected: 'gpt-image' },
    { hint: { provider: 'azure-openai', model: 'GPT-Image-1' }, expected: 'gpt-image' },
    { hint: { provider: 'google', model: 'gemini-2.5-flash-image' }, expected: 'gemini-nano' },
    { hint: { provider: 'google', model: 'gemini-3-pro-image' }, expected: 'gemini-nano' },
    { hint: { provider: 'google', model: 'gemini-3.1-flash-image' }, expected: 'gemini-nano' },
    { hint: { provider: 'replicate', model: 'sdxl-1.0' }, expected: 'compatible' },
    { hint: { provider: 'flux', model: 'flux-pro' }, expected: 'compatible' },
    { hint: { provider: null, model: null }, expected: 'compatible' },
    { hint: {}, expected: 'compatible' },
  ];

  it.each(cases)('detects $hint.provider/$hint.model as $expected', ({ hint, expected }) => {
    expect(detectImageModelKind(hint)).toBe(expected);
  });

  it('treats undefined hint as compatible', () => {
    expect(detectImageModelKind(undefined)).toBe('compatible');
    expect(detectImageModelKind(null)).toBe('compatible');
  });

  it('matches gpt-image even when only model carries the signal', () => {
    expect(detectImageModelKind({ provider: 'custom-proxy', model: 'gpt-image-1' })).toBe('gpt-image');
  });

  it('matches gemini-nano even when only provider carries the signal', () => {
    expect(detectImageModelKind({ provider: 'gemini', model: 'unknown' })).toBe('gemini-nano');
  });
});

describe('IMAGE_MODEL_CAPABILITIES', () => {
  it('exposes exactly three known kinds', () => {
    expect(Object.keys(IMAGE_MODEL_CAPABILITIES).sort()).toEqual(['compatible', 'gemini-nano', 'gpt-image']);
  });

  it('gpt-image lists only officially supported sizes', () => {
    const sizes = IMAGE_MODEL_CAPABILITIES['gpt-image'].sizes.map((s) => s.value);
    expect(sizes).toEqual(['auto', '1024x1024', '1536x1024', '1024x1536']);
  });

  it('gpt-image lists only officially supported qualities', () => {
    const q = IMAGE_MODEL_CAPABILITIES['gpt-image'].qualities.map((s) => s.value);
    expect(q).toEqual(['auto', 'low', 'medium', 'high']);
  });

  it('gemini-nano exposes the 10 common aspect ratios with no quality dimension', () => {
    const sizes = IMAGE_MODEL_CAPABILITIES['gemini-nano'].sizes.map((s) => s.value);
    expect(sizes).toHaveLength(10);
    expect(sizes).toContain('1024x1024');
    expect(sizes).toContain('2016x864');
    expect(IMAGE_MODEL_CAPABILITIES['gemini-nano'].qualities).toEqual([]);
  });

  it('every capability default size/quality belongs to its own whitelist', () => {
    for (const cap of Object.values(IMAGE_MODEL_CAPABILITIES)) {
      const sizeValues = cap.sizes.map((s) => s.value);
      expect(sizeValues).toContain(cap.defaults.size);
      if (cap.qualities.length > 0) {
        const qualityValues = cap.qualities.map((q) => q.value);
        expect(qualityValues).toContain(cap.defaults.quality);
      } else {
        expect(cap.defaults.quality).toBe('');
      }
      expect(cap.defaults.count).toBeGreaterThanOrEqual(1);
      expect(cap.defaults.count).toBeLessThanOrEqual(cap.maxCount);
    }
  });

  it('getImageCapability returns the same object as the table lookup', () => {
    for (const kind of Object.keys(IMAGE_MODEL_CAPABILITIES) as ImageModelKind[]) {
      expect(getImageCapability(kind)).toBe(IMAGE_MODEL_CAPABILITIES[kind]);
    }
  });
});
