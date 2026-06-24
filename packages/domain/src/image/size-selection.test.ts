import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL_CAPABILITIES } from './capabilities';
import {
  buildImageSizeResolutionGroups,
  resolveImageSizeSelection,
  resolveImagePricingResolution,
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
