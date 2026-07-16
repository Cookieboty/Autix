import { it, expect } from 'vitest';
import { resolveImageOperation } from './image-operation';
import { openaiImagesV1, doubaoImagesV1, geminiImagesV1 } from './presets/vendors';

it('gpt-image + 参考图 → edit', () => {
  expect(
    resolveImageOperation(openaiImagesV1, ['generate', 'edit'], {
      hasSourceImages: false,
      hasReferenceImages: true,
    }),
  ).toBe('edit');
});
it('seedream + 参考图 → generate（generate-json-url 不切 edit）', () => {
  expect(
    resolveImageOperation(doubaoImagesV1, ['generate'], {
      hasSourceImages: false,
      hasReferenceImages: true,
    }),
  ).toBe('generate');
});
it('无输入图 → generate', () => {
  expect(
    resolveImageOperation(openaiImagesV1, ['generate', 'edit'], {
      hasSourceImages: false,
      hasReferenceImages: false,
    }),
  ).toBe('generate');
});
it('候选 operation 不在 operations 内 → 抛错（fail fast）', () => {
  expect(() =>
    resolveImageOperation(openaiImagesV1, ['generate'], {
      hasSourceImages: false,
      hasReferenceImages: true,
    }),
  ).toThrow(/OPERATION_NOT_ALLOWED/);
});
it('gemini-images shim + sourceImages(编辑) → edit（不回退到 generate）', () => {
  expect(
    resolveImageOperation(geminiImagesV1, ['generate', 'edit'], {
      hasSourceImages: true,
      hasReferenceImages: false,
    }),
  ).toBe('edit');
});
it('gemini-images shim + 参考图 → edit（经 edit 端点传图，迁移前的兜底）', () => {
  expect(
    resolveImageOperation(geminiImagesV1, ['generate', 'edit'], {
      hasSourceImages: false,
      hasReferenceImages: true,
    }),
  ).toBe('edit');
});
