import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL_CAPABILITIES } from './capabilities';
import {
  buildImageSizeResolutionGroups,
  buildImageSizeView,
  getUniqueImageAspectOptions,
  resolveImageSizeSelection,
  resolveImagePricingResolution,
  selectImageSizeAspect,
  selectImageSizeResolution,
} from './size-selection';

describe('image size selection helpers', () => {
  it('groups gpt-image sizes by inferred resolution before aspect ratio', () => {
    const groups = buildImageSizeResolutionGroups(IMAGE_MODEL_CAPABILITIES['gpt-image']);

    expect(groups.map((group) => group.value)).toEqual(['auto', '1K', '2K', '4K']);
    expect(groups.find((group) => group.value === '1K')?.options.map((option) => option.label)).toEqual([
      '1:1',
      '3:2',
      '2:3',
    ]);
    expect(groups.find((group) => group.value === '4K')?.options.map((option) => option.value)).toEqual([
      '3840x2160',
      '2160x3840',
    ]);
  });

  it('groups gemini 3.1 flash official sizes by image_size tiers', () => {
    const groups = buildImageSizeResolutionGroups(IMAGE_MODEL_CAPABILITIES['gemini-3-flash-image']);

    expect(groups.map((group) => group.value)).toEqual(['512px', '1K', '2K', '4K']);
    expect(groups.find((group) => group.value === '512px')?.options).toContainEqual(
      expect.objectContaining({ label: '1:4', value: '256x1024@512px' }),
    );
    expect(groups.find((group) => group.value === '2K')?.options).toContainEqual(
      expect.objectContaining({ label: '16:9', value: '2752x1536@2K' }),
    );
  });

  it('resolves the selected group and aspect option from the stored size token', () => {
    const groups = buildImageSizeResolutionGroups(IMAGE_MODEL_CAPABILITIES['gemini-3-pro-image']);

    expect(resolveImageSizeSelection('2752x1536@2K', groups)).toMatchObject({
      group: { value: '2K' },
      option: { label: '16:9', value: '2752x1536@2K' },
    });
  });

  it('preserves the current aspect ratio when switching resolution groups', () => {
    const groups = buildImageSizeResolutionGroups(IMAGE_MODEL_CAPABILITIES['gemini-3-flash-image']);

    expect(selectImageSizeResolution('256x1024@512px', '2K', groups)).toBe('1024x4096@2K');
    expect(selectImageSizeResolution('2752x1536@2K', '4K', groups)).toBe('5504x3072@4K');
  });

  it('falls back to the first available aspect when the new resolution lacks the current ratio', () => {
    const groups = buildImageSizeResolutionGroups(IMAGE_MODEL_CAPABILITIES['gpt-image']);

    expect(selectImageSizeResolution('2160x3840', '2K', groups)).toBe('2048x2048');
  });

  it('preserves the current resolution tier when switching aspect ratio', () => {
    const geminiGroups = buildImageSizeResolutionGroups(IMAGE_MODEL_CAPABILITIES['gemini-3-flash-image']);
    // 2K + 16:9 → switch to 1:1 stays in 2K
    expect(selectImageSizeAspect('2752x1536@2K', '1:1', geminiGroups)).toBe('2048x2048@2K');

    // gpt-image 4K only has 16:9 / 9:16 → switching to 1:1 falls back to a tier that has it
    const gptGroups = buildImageSizeResolutionGroups(IMAGE_MODEL_CAPABILITIES['gpt-image']);
    expect(selectImageSizeAspect('3840x2160', '1:1', gptGroups)).toBe('1024x1024');
  });

  it('lists one entry per distinct aspect ratio (aspect-first pivot)', () => {
    const groups = buildImageSizeResolutionGroups(IMAGE_MODEL_CAPABILITIES['gemini-3-flash-image']);
    const aspects = getUniqueImageAspectOptions(groups);

    // 14 aspect ratios, deduped across the 4 tiers
    expect(aspects.map((option) => option.aspectValue)).toEqual([
      '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9',
    ]);
  });

  describe('buildImageSizeView', () => {
    it('exposes tiers, selection and summary label for a valid stored value', () => {
      const view = buildImageSizeView(IMAGE_MODEL_CAPABILITIES['gemini-3-flash-image'], '2752x1536@2K');

      expect(view.isValid).toBe(true);
      expect(view.value).toBe('2752x1536@2K');
      expect(view.hasResolutionTiers).toBe(true);
      expect(view.selectedTier?.value).toBe('2K');
      expect(view.selectedAspect?.label).toBe('16:9');
      expect(view.displayLabel).toBe('16:9 2K');
    });

    it('bound actions keep aspect across tiers and tier across aspects', () => {
      const view = buildImageSizeView(IMAGE_MODEL_CAPABILITIES['gemini-3-flash-image'], '2752x1536@2K');

      expect(view.pickResolution('4K')).toBe('5504x3072@4K');
      expect(view.pickAspect('1:1')).toBe('2048x2048@2K');
    });

    it('normalizes an illegal value to the nearest aspect instead of hard-resetting', () => {
      // a Gemini 2.5 value (no @tier) selected, then model switched to gpt-image
      const view = buildImageSizeView(IMAGE_MODEL_CAPABILITIES['gpt-image'], '1344x768');

      expect(view.isValid).toBe(false);
      // 16:9-ish → nearest gpt-image aspect, NOT the default 'auto'
      expect(view.value).not.toBe('auto');
      expect(view.selectedAspect?.value).toBe(view.value);
    });

    it('reports a single group with no resolution tiers for gemini 2.5 flash', () => {
      const view = buildImageSizeView(IMAGE_MODEL_CAPABILITIES['gemini-flash-image'], '1024x1024');

      expect(view.hasResolutionTiers).toBe(false);
      expect(view.selectedAspect?.label).toBe('1:1');
    });
  });

  it('normalizes concrete image sizes to pricing resolution tiers', () => {
    expect(resolveImagePricingResolution('auto')).toBeUndefined();
    expect(resolveImagePricingResolution('1024x1024')).toBe('1K');
    expect(resolveImagePricingResolution('2048x1152')).toBe('2K');
    expect(resolveImagePricingResolution('3840x2160')).toBe('4K');
    expect(resolveImagePricingResolution('256x1024@512px')).toBe('512px');
    expect(resolveImagePricingResolution('2752x1536@2K')).toBe('2K');
    expect(resolveImagePricingResolution('5504x3072@4K')).toBe('4K');
  });
});
