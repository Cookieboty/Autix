import { describe, expect, test } from 'bun:test';
import { buildImageWorkbenchEstimateInput } from '../src/image/workbench/pricing';
import type { ImageStudioModelSettings } from '../src/image/ImageStudioWorkspace';
import type { ModelConfigItem } from '@autix/shared-store';

const settings: ImageStudioModelSettings = {
  size: '1024x1024',
  quality: 'high',
  count: 2,
  guidanceScale: 7,
  steps: 30,
  seed: '',
  promptTuning: 'auto',
  stylePreset: 'general',
  negativePrompt: '',
};

describe('buildImageWorkbenchEstimateInput', () => {
  test('wraps quality/resolution/quantity/referenceImages into params, modelConfigId at top level', () => {
    const model = { id: 'model-1', provider: 'compatible', model: 'compatible-image' } as unknown as ModelConfigItem;

    const input = buildImageWorkbenchEstimateInput({
      settings,
      model,
      selectedModelId: 'compatible-image',
      referenceImages: 2,
    });

    expect(input).toEqual({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: {
        quality: 'high',
        resolution: '1K',
        quantity: 2,
        referenceImages: 2,
      },
    });
  });

  test('falls back to selectedModelId when no model is resolved yet', () => {
    const input = buildImageWorkbenchEstimateInput({
      settings,
      model: null,
      selectedModelId: 'fallback-model',
      referenceImages: 0,
    });

    expect(input.modelConfigId).toBe('fallback-model');
  });

  test('never puts a token key in params, and never sets a usage field', () => {
    const input = buildImageWorkbenchEstimateInput({
      settings,
      model: null,
      selectedModelId: 'compatible-image',
      referenceImages: 0,
    });

    expect(Object.keys(input.params)).not.toContain('inputTokens');
    expect(Object.keys(input.params)).not.toContain('outputTokens');
    expect(input).not.toHaveProperty('usage');
  });
});
