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
  it('passes the user settings through and injects referenceImages, modelConfigId at top level', () => {
    const request = {
      modelConfig: { id: 'model-1', provider: 'openai', model: 'gpt-image' },
      settings: { quality: 'high', size: '1024x1024' },
      sourceImages: [{ url: 'a' }],
      referenceImages: [],
    } as never;

    const input = buildImageGenerationEstimateInput(request, 3);

    expect(input.taskType).toBe('image_generation');
    expect(input.modelConfigId).toBe('model-1');
    // 张数不进计价 params：pricingSchema 只描述「一张」的价格，多图的
    // 「单张价 × 张数」由 flow.service 在 createHold 时算。
    expect(input.params).toMatchObject({ quality: 'high', size: '1024x1024', referenceImages: 1 });
    expect('quantity' in input.params).toBe(false);
    expect(input.membershipLevel).toBe(3);
  });

  it('does NOT derive resolution here — the server-side estimator does (spec §6.2)', () => {
    // 手写派生已删：resolution 必须由 estimator 的 deriveParams 从 size 算。
    // 在这里再算一遍 = 两处实现、两套口径，迟早分裂（第 1 期的老 bug）。
    const request = {
      modelConfig: { id: 'model-1', provider: 'openai', model: 'gemini-3-pro-image' },
      settings: { quality: 'high', size: '2048x2048@2K' },
    } as never;

    const input = buildImageGenerationEstimateInput(request);

    expect('resolution' in input.params).toBe(false);
    expect(input.params.size).toBe('2048x2048@2K');
  });

  it('overrides a client-sent referenceImages count with the真实上传张数', () => {
    // referenceImages 是计价参数，用户不可自报：按真实上传张数收费。
    const request = {
      modelConfig: { id: 'model-1', provider: 'openai', model: 'gpt-image' },
      settings: { quality: 'high', referenceImages: 0 },
      sourceImages: [{ url: 'a' }, { url: 'b' }],
      referenceImages: [{ url: 'c' }],
    } as never;

    expect(buildImageGenerationEstimateInput(request).params.referenceImages).toBe(3);
  });

  it('tolerates an absent settings bag', () => {
    const request = {
      modelConfig: { id: 'model-1', provider: 'openai', model: 'gpt-image' },
    } as never;

    expect(buildImageGenerationEstimateInput(request).params).toEqual({ referenceImages: 0 });
  });

  it('omits membershipLevel entirely when not provided', () => {
    const request = {
      modelConfig: { id: 'model-1', provider: 'openai', model: 'gpt-image' },
      settings: { quality: 'high', size: '1024x1024' },
    } as never;

    const input = buildImageGenerationEstimateInput(request);

    expect('membershipLevel' in input).toBe(false);
  });
});
