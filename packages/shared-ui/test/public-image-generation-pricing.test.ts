import { describe, expect, test } from 'bun:test';
import {
  buildPublicImageEstimateInput,
  buildPublicImageGenerationSettings,
} from '../src/growth/generator/image/public-image-generation';
import type { ModelConfigItem } from '@autix/shared-store';

describe('buildPublicImageEstimateInput', () => {
  test('wraps quality/resolution/quantity/referenceImages into params, modelConfigId at top level', () => {
    const model = { id: 'model-1', provider: 'compatible', model: 'compatible-image' } as unknown as ModelConfigItem;

    const input = buildPublicImageEstimateInput({
      settings: buildPublicImageGenerationSettings({ size: '1024x1024', quality: 'high', count: 3 }),
      model,
      selectedModelId: 'compatible-image',
      referenceImages: 1,
    });

    expect(input).toEqual({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: {
        quality: 'high',
        resolution: '1K',
        quantity: 3,
        referenceImages: 1,
      },
    });
  });

  test('falls back to selectedModelId when no model config is resolved', () => {
    const input = buildPublicImageEstimateInput({
      settings: buildPublicImageGenerationSettings({ size: '1024x1024', count: 1 }),
      model: null,
      selectedModelId: 'fallback-model',
      referenceImages: 0,
    });

    expect(input.modelConfigId).toBe('fallback-model');
  });

  test('never puts a token key in params, and never sets a usage field', () => {
    const input = buildPublicImageEstimateInput({
      settings: buildPublicImageGenerationSettings({ size: '1024x1024', count: 1 }),
      model: null,
      selectedModelId: 'fallback-model',
      referenceImages: 0,
    });

    expect(Object.keys(input.params)).not.toContain('inputTokens');
    expect(Object.keys(input.params)).not.toContain('outputTokens');
    expect(input).not.toHaveProperty('usage');
  });
});
