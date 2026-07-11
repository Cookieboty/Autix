import { describe, expect, test } from 'bun:test';
import {
  findImageModelByHint,
  resolveImageCapabilityFromModelParam,
  getImageCountControl,
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

describe('getImageCountControl', () => {
  // 生成张数已从图像模型配置移除：无论 maxCount 多少，控件都不再暴露（张数由业务逻辑吃掉）。
  test('always hidden — count is no longer a user-facing config (business logic owns quantity)', () => {
    expect(getImageCountControl({ maxCount: 1, defaults: { count: 1 } } as never)).toEqual({
      visible: false,
      max: 1,
      default: 1,
    });
    expect(getImageCountControl({ maxCount: 4, defaults: { count: 1 } } as never)).toEqual({
      visible: false,
      max: 4,
      default: 1,
    });
  });
});

describe('getImageReferenceUploadLimit', () => {
  test('uses the shared image workbench cap for models with reference image support', () => {
    expect(getImageReferenceUploadLimit({ supportsReferenceImage: true })).toBe(8);
  });

  test('disables uploads when the model does not support reference images', () => {
    expect(getImageReferenceUploadLimit({ supportsReferenceImage: false })).toBe(0);
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
