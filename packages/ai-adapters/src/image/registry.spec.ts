import { describe, it, expect } from 'vitest';
import { resolveImageAdapter } from './registry';
import { OpenAIImageAdapter } from './openai.adapter';
import { GeminiImageAdapter } from './gemini.adapter';
import { OpenAICompatibleImageAdapter } from './openai-compatible.adapter';

describe('resolveImageAdapter', () => {
  it('returns OpenAIImageAdapter for openai-official', () => {
    expect(resolveImageAdapter('openai-official')).toBeInstanceOf(OpenAIImageAdapter);
  });

  it('returns OpenAIImageAdapter for openai_api alias', () => {
    expect(resolveImageAdapter('openai_api')).toBeInstanceOf(OpenAIImageAdapter);
  });

  it('returns GeminiImageAdapter for gemini', () => {
    expect(resolveImageAdapter('gemini')).toBeInstanceOf(GeminiImageAdapter);
  });

  it('returns GeminiImageAdapter for google alias', () => {
    expect(resolveImageAdapter('google')).toBeInstanceOf(GeminiImageAdapter);
  });

  it('returns OpenAICompatibleImageAdapter for openai', () => {
    expect(resolveImageAdapter('openai')).toBeInstanceOf(OpenAICompatibleImageAdapter);
  });

  it('returns OpenAICompatibleImageAdapter for empty/null/undefined', () => {
    expect(resolveImageAdapter(null)).toBeInstanceOf(OpenAICompatibleImageAdapter);
    expect(resolveImageAdapter(undefined)).toBeInstanceOf(OpenAICompatibleImageAdapter);
    expect(resolveImageAdapter('')).toBeInstanceOf(OpenAICompatibleImageAdapter);
  });

  it('returns OpenAICompatibleImageAdapter for unknown providers', () => {
    expect(resolveImageAdapter('some-random')).toBeInstanceOf(OpenAICompatibleImageAdapter);
  });

  it('throws for imagen (phase 2)', () => {
    expect(() => resolveImageAdapter('imagen')).toThrow('not implemented');
  });
});
