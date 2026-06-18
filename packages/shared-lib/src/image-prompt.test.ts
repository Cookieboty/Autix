import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL_CAPABILITIES } from './image-capabilities';
import { buildImageWorkbenchPrompt, getImageModelPromptHint } from './image-prompt';

describe('buildImageWorkbenchPrompt', () => {
  it('keeps faithful prompts unchanged except trimming', () => {
    const result = buildImageWorkbenchPrompt(
      '  A clean product photo  ',
      { promptTuning: 'faithful', stylePreset: 'general', negativePrompt: 'noise' },
      IMAGE_MODEL_CAPABILITIES.compatible,
    );

    expect(result.prompt).toBe('A clean product photo');
    expect(result.additions).toEqual([]);
  });

  it('adds visible style and tuning context before LLM refinement', () => {
    const result = buildImageWorkbenchPrompt(
      '手机海报',
      { promptTuning: 'ecommerce', stylePreset: 'productPoster' },
      IMAGE_MODEL_CAPABILITIES['gpt-image'],
    );

    expect(result.prompt).toBe('手机海报\nstyle direction: productPoster\nprompt tuning: ecommerce');
    expect(result.additions).toEqual([
      'style direction: productPoster',
      'prompt tuning: ecommerce',
    ]);
  });

  it('can omit tuning strategy for the final image-model prompt', () => {
    const result = buildImageWorkbenchPrompt(
      '手机海报',
      { promptTuning: 'ecommerce', stylePreset: 'productPoster' },
      IMAGE_MODEL_CAPABILITIES['gpt-image'],
      { includePromptTuning: false },
    );

    expect(result.prompt).toBe('手机海报\nstyle direction: productPoster');
    expect(result.additions).toEqual(['style direction: productPoster']);
  });

  it('injects negative prompt only for models without native negative prompt', () => {
    const gpt = buildImageWorkbenchPrompt(
      'portrait',
      { negativePrompt: 'blur, low quality' },
      IMAGE_MODEL_CAPABILITIES['gpt-image'],
    );
    const compatible = buildImageWorkbenchPrompt(
      'portrait',
      { negativePrompt: 'blur, low quality' },
      IMAGE_MODEL_CAPABILITIES.compatible,
    );

    expect(gpt.prompt).toContain('avoid: blur, low quality');
    expect(compatible.prompt).toBe('portrait');
  });
});

describe('getImageModelPromptHint', () => {
  it('returns a readable provider/model label', () => {
    expect(getImageModelPromptHint({ provider: 'openai', model: 'gpt-image-1' })).toBe(
      'openai / gpt-image-1',
    );
  });

  it('falls back when fields are empty', () => {
    expect(getImageModelPromptHint({ provider: '', model: '' })).toBe('image model');
  });
});
