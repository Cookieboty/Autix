import { describe, expect, test } from 'bun:test';
import {
  findImageModelByHint,
  resolveImageCapabilityFromModelParam,
  getImageReferenceUploadLimit,
} from '../src/growth/generator-image-presenters';
import type { ModelConfigItem } from '@autix/shared-store';

describe('resolveImageCapabilityFromModelParam', () => {
  test('defaults to gemini-3-pro-image when no model param', () => {
    expect(resolveImageCapabilityFromModelParam(null).kind).toBe('gemini-3-pro-image');
  });

  test('unknown marketing slug keeps the page default (not compatible)', () => {
    expect(resolveImageCapabilityFromModelParam('nano-banana-pro').kind).toBe(
      'gemini-3-pro-image',
    );
  });

  test('recognized gpt-image maps through', () => {
    expect(resolveImageCapabilityFromModelParam('gpt-image-1').kind).toBe('gpt-image');
  });

  test('explicit flux/sdxl maps to compatible', () => {
    expect(resolveImageCapabilityFromModelParam('my-flux-model').kind).toBe('compatible');
  });
});

describe('getImageReferenceUploadLimit', () => {
  // spec §12：上限唯一来自 paramsSchema.properties.referenceImages.maximum，不再是
  // 静态能力表的 supportsReferenceImage。变异测试：换一个 maximum 数字，返回值必须
  // 跟着变，而不是恒为写死的 8。
  test('comes from paramsSchema.properties.referenceImages.maximum, not a hardcoded 8', () => {
    expect(
      getImageReferenceUploadLimit({ properties: { referenceImages: { type: 'integer', maximum: 3 } } }),
    ).toBe(3);
  });

  test('is 0 when the model cannot take reference images', () => {
    expect(getImageReferenceUploadLimit({ properties: {} })).toBe(0);
  });

  test('is 0 when paramsSchema itself is missing (schema not loaded yet)', () => {
    expect(getImageReferenceUploadLimit(undefined)).toBe(0);
  });
});

describe('findImageModelByHint', () => {
  const models = [
    {
      id: 'model-gpt-image-2',
      name: 'GPT Image 2',
      provider: 'openai',
      model: 'gpt-image-2',
    },
    {
      id: 'model-nano-banana-pro',
      name: 'Nano Banana Pro',
      provider: 'google',
      model: 'gemini-3-pro-image',
    },
  ] as ModelConfigItem[];

  test('matches configured model by id, display name, or provider/model text', () => {
    expect(findImageModelByHint(models, 'model-nano-banana-pro')?.id).toBe(
      'model-nano-banana-pro',
    );
    expect(findImageModelByHint(models, 'Nano Banana')?.id).toBe('model-nano-banana-pro');
    expect(findImageModelByHint(models, 'openai gpt-image-2')?.id).toBe('model-gpt-image-2');
  });

  test('returns null for empty or unknown hints', () => {
    expect(findImageModelByHint(models, '')).toBeNull();
    expect(findImageModelByHint(models, 'unknown')).toBeNull();
  });
});
