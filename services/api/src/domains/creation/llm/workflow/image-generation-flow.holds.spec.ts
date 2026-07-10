import { BadRequestException } from '@nestjs/common';
import {
  assertPromptOptimizeInputWithinLimit,
  buildImageGenerationEstimateInput,
  buildPromptOptimizeEstimateInput,
  PROMPT_OPTIMIZE_MAX_INPUT_TOKENS,
} from './image-generation-flow.holds';

describe('assertPromptOptimizeInputWithinLimit (FIX-18)', () => {
  it('allows input at or below the cap', () => {
    expect(() => assertPromptOptimizeInputWithinLimit(PROMPT_OPTIMIZE_MAX_INPUT_TOKENS)).not.toThrow();
    expect(() => assertPromptOptimizeInputWithinLimit(100)).not.toThrow();
  });

  it('rejects input above the cap', () => {
    expect(() =>
      assertPromptOptimizeInputWithinLimit(PROMPT_OPTIMIZE_MAX_INPUT_TOKENS + 1),
    ).toThrow(BadRequestException);
  });
});

describe('buildPromptOptimizeEstimateInput', () => {
  it('packs tokens into usage and modelConfigId at the top level', () => {
    const input = buildPromptOptimizeEstimateInput(
      'prompt_optimize_generation',
      { id: 'model-1', provider: 'openai', model: 'gpt-x' },
      { inputTokens: 100, outputTokens: 50 },
      2,
    );

    expect(input).toEqual({
      taskType: 'prompt_optimize_generation',
      modelConfigId: 'model-1',
      params: {},
      usage: { inputTokens: 100, outputTokens: 50 },
      membershipLevel: 2,
    });
  });

  it('omits membershipLevel entirely when not provided', () => {
    const input = buildPromptOptimizeEstimateInput(
      'prompt_optimize_generation',
      { id: 'model-1', provider: 'openai', model: 'gpt-x' },
      { inputTokens: 100, outputTokens: 50 },
    );

    expect(input).toEqual({
      taskType: 'prompt_optimize_generation',
      modelConfigId: 'model-1',
      params: {},
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    expect('membershipLevel' in input).toBe(false);
  });
});

describe('buildImageGenerationEstimateInput', () => {
  it('packs quality/resolution/quantity/referenceImages into params, modelConfigId at top level', () => {
    const request = {
      modelConfig: { id: 'model-1', provider: 'openai', model: 'gpt-image' },
      settings: { quality: 'high', size: '1024x1024' },
      sourceImages: [{ url: 'a' }],
      referenceImages: [],
    } as never;

    const input = buildImageGenerationEstimateInput(request, 2, 3);

    expect(input.taskType).toBe('image_generation');
    expect(input.modelConfigId).toBe('model-1');
    expect(input.params).toMatchObject({ quality: 'high', quantity: 2, referenceImages: 1 });
    expect(input.membershipLevel).toBe(3);
  });

  it('omits membershipLevel entirely when not provided', () => {
    const request = {
      modelConfig: { id: 'model-1', provider: 'openai', model: 'gpt-image' },
      settings: { quality: 'high', size: '1024x1024' },
    } as never;

    const input = buildImageGenerationEstimateInput(request, 1);

    expect('membershipLevel' in input).toBe(false);
  });
});
