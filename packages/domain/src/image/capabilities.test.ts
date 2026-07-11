import { describe, expect, it } from 'vitest';
import {
  IMAGE_MODEL_CAPABILITIES,
  detectImageModelKind,
  getImageCapability,
  type ImageModelKind,
} from './capabilities';

describe('detectImageModelKind', () => {
  const cases: Array<{ hint: { provider?: string | null; model?: string | null }; expected: ImageModelKind }> = [
    { hint: { provider: 'openai', model: 'gpt-image-2' }, expected: 'gpt-image' },
    { hint: { provider: 'azure-openai', model: 'GPT-Image-1' }, expected: 'gpt-image' },
    { hint: { provider: 'google', model: 'gemini-2.5-flash-image' }, expected: 'gemini-flash-image' },
    { hint: { provider: 'google', model: 'gemini-3-pro-image' }, expected: 'gemini-3-pro-image' },
    { hint: { provider: 'google', model: 'gemini-3.1-flash-image' }, expected: 'gemini-3-flash-image' },
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
    expect(detectImageModelKind({ provider: 'custom-proxy', model: 'gpt-image-2' })).toBe('gpt-image');
  });

  it('matches gemini flash image even when only provider carries the signal', () => {
    expect(detectImageModelKind({ provider: 'gemini', model: 'unknown' })).toBe('gemini-flash-image');
  });

  it('prefers configured metadata kind over provider/model heuristics', () => {
    expect(
      detectImageModelKind({
        provider: 'custom-proxy',
        model: 'gpt-image-compatible-name',
        metadata: { imageModelKind: 'compatible' },
      }),
    ).toBe('compatible');
    expect(
      detectImageModelKind({
        provider: 'custom',
        model: 'not-gemini',
        metadata: { imageModelKind: 'gemini-3-pro-image' },
      }),
    ).toBe('gemini-3-pro-image');
  });
});

describe('IMAGE_MODEL_CAPABILITIES', () => {
  it('exposes exactly five known kinds', () => {
    expect(Object.keys(IMAGE_MODEL_CAPABILITIES).sort()).toEqual([
      'compatible',
      'gemini-3-flash-image',
      'gemini-3-pro-image',
      'gemini-flash-image',
      'gpt-image',
    ]);
  });

  it('gpt-image lists only officially supported sizes', () => {
    const sizes = IMAGE_MODEL_CAPABILITIES['gpt-image'].sizes.map((s) => s.value);
    expect(sizes).toEqual([
      '1024x1024',
      '1536x1024',
      '1024x1536',
      '2048x2048',
      '2048x1152',
      '3840x2160',
      '2160x3840',
    ]);
  });

  it('gpt-image lists only officially supported qualities', () => {
    const q = IMAGE_MODEL_CAPABILITIES['gpt-image'].qualities;
    expect(q).toEqual(['low', 'medium', 'high']);
  });

  it('gemini 2.5 flash exposes the 10 common aspect ratios with no quality dimension', () => {
    const sizes = IMAGE_MODEL_CAPABILITIES['gemini-flash-image'].sizes.map((s) => s.value);
    expect(sizes).toHaveLength(10);
    expect(sizes).toContain('1024x1024');
    expect(sizes).toContain('1536x672');
    expect(IMAGE_MODEL_CAPABILITIES['gemini-flash-image'].qualities).toEqual([]);
  });

  it('gemini 3 pro exposes common ratios across 1K, 2K, and 4K image sizes', () => {
    const sizes = IMAGE_MODEL_CAPABILITIES['gemini-3-pro-image'].sizes.map((s) => s.value);
    expect(sizes).toHaveLength(30);
    expect(sizes).toContain('1024x1024@1K');
    expect(sizes).toContain('5504x3072@4K');
    expect(sizes).not.toContain('256x1024@512px');
  });

  it('gemini 3.1 flash exposes extended ratios and 512px image size', () => {
    const sizes = IMAGE_MODEL_CAPABILITIES['gemini-3-flash-image'].sizes.map((s) => s.value);
    expect(sizes).toHaveLength(56);
    expect(sizes).toContain('256x1024@512px');
    expect(sizes).toContain('8192x2048@4K');
  });

  it('every capability default size/quality belongs to its own whitelist', () => {
    for (const cap of Object.values(IMAGE_MODEL_CAPABILITIES)) {
      const sizeValues = cap.sizes.map((s) => s.value);
      expect(sizeValues).toContain(cap.defaults.size);
      if (cap.qualities.length > 0) {
        expect(cap.qualities).toContain(cap.defaults.quality);
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
