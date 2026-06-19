import { describe, expect, it } from 'vitest';
import { ALL_CATEGORIES, getModelCategory } from './category';

describe('getModelCategory', () => {
  it('classifies text-capable models as multimodal', () => {
    expect(getModelCategory(['text'])).toBe('multimodal');
    expect(getModelCategory(['text', 'vision'])).toBe('multimodal');
    expect(getModelCategory(['text', 'image'])).toBe('multimodal');
  });

  it('classifies pure image generation models as image', () => {
    expect(getModelCategory(['image'])).toBe('image');
  });

  it('exposes only multimodal and image categories', () => {
    expect(ALL_CATEGORIES).toEqual(['multimodal', 'image']);
  });
});
