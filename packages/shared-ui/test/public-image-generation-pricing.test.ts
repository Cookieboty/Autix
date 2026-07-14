import {
  buildPublicImageEstimateInput,
  buildPublicImageGenerationSettings,
} from '../src/growth/generator/image/public-image-generation';
import type { ModelConfigItem } from '@autix/shared-store';

const model = { id: 'model-1', provider: 'compatible', model: 'compatible-image' } as unknown as ModelConfigItem;

describe('buildPublicImageGenerationSettings → 透传', () => {
  test('sends exactly the schema params — no hardcoded guidanceScale/steps/stylePreset', () => {
    const settings = buildPublicImageGenerationSettings({ size: '2048x2048@2K', quality: 'high' });
    expect(settings).toEqual({ size: '2048x2048@2K', quality: 'high', skipPromptTuning: true });
    // 变异测试：这三个值曾经是写死的 7 / 30 / 'general'（spec §12），它们必须消失
    expect(settings).not.toHaveProperty('guidanceScale');
    expect(settings).not.toHaveProperty('steps');
    expect(settings).not.toHaveProperty('stylePreset');
  });

  test('quote params and generate params are the same object (spec §11 第 2 期验收)', () => {
    const params = { size: '2048x2048@2K', quality: 'high' };
    const estimate = buildPublicImageEstimateInput({ params, model, referenceImages: 2 });
    const settings = buildPublicImageGenerationSettings(params);
    for (const key of Object.keys(params)) {
      expect(estimate.params[key]).toEqual(settings[key]);
    }
  });

  test('does NOT derive resolution on the client — the server owns that now (spec §6.3)', () => {
    const estimate = buildPublicImageEstimateInput({ params: { size: '2048x2048@2K' }, model, referenceImages: 0 });
    expect(estimate.params).not.toHaveProperty('resolution');
  });

  test('merges referenceImages count into params, modelConfigId at top level', () => {
    const estimate = buildPublicImageEstimateInput({
      params: { size: '2048x2048@2K', quality: 'high' },
      model,
      referenceImages: 3,
    });
    expect(estimate).toEqual({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { size: '2048x2048@2K', quality: 'high', referenceImages: 3 },
    });
  });

  test('falls back to selectedModelId when no model config is resolved', () => {
    const estimate = buildPublicImageEstimateInput({
      params: { size: '2048x2048@2K' },
      model: null,
      selectedModelId: 'fallback-model',
      referenceImages: 0,
    });
    expect(estimate.modelConfigId).toBe('fallback-model');
  });
});
