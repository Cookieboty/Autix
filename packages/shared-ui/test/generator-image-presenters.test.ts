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
  // 上限来自 paramsSchema.properties.referenceImages['x-ui'].uploadMax —— 不是
  // JSON-Schema 的 maximum（那会被 ajv 校验，而这份 schema 是 chat / canvas / 公开
  // 生成器共享的同一份 image_generation 任务 schema，canvas 的参考图选择没有上游
  // 数量上限，maximum 会把 canvas 里合法的多图请求在 hold 时 400 掉），也不再是
  // 静态能力表的 supportsReferenceImage。变异测试：换一个 uploadMax 数字，返回值
  // 必须跟着变，而不是恒为写死的 8。
  test("comes from paramsSchema.properties.referenceImages['x-ui'].uploadMax, not a hardcoded 8", () => {
    expect(
      getImageReferenceUploadLimit({
        properties: { referenceImages: { 'x-ui': { uploadMax: 3 } } },
      }),
    ).toBe(3);
  });

  test('is 0 when the model cannot take reference images (referenceImages property absent)', () => {
    expect(getImageReferenceUploadLimit({ properties: {} })).toBe(0);
  });

  test('is 0 when referenceImages exists but has no x-ui.uploadMax (row seeded before this change)', () => {
    expect(
      getImageReferenceUploadLimit({ properties: { referenceImages: {} } }),
    ).toBe(0);
    expect(
      getImageReferenceUploadLimit({
        properties: { referenceImages: { 'x-ui': {} } },
      }),
    ).toBe(0);
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
