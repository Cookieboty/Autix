import { describe, it, expect } from 'vitest';
import { normalizeProvider } from './types';

describe('normalizeProvider', () => {
  it('maps openai-official variants', () => {
    expect(normalizeProvider('openai-official')).toBe('openai-official');
    expect(normalizeProvider('openai_api')).toBe('openai-official');
    expect(normalizeProvider('OpenAI_API')).toBe('openai-official');
  });

  it('maps gemini variants', () => {
    expect(normalizeProvider('gemini')).toBe('gemini');
    expect(normalizeProvider('google')).toBe('gemini');
    expect(normalizeProvider('Google')).toBe('gemini');
  });

  it('maps openai-compatible variants', () => {
    expect(normalizeProvider('openai-compatible')).toBe('openai-compatible');
    expect(normalizeProvider('openai')).toBe('openai-compatible');
    expect(normalizeProvider('gateway')).toBe('openai-compatible');
  });

  it('defaults empty/null/unknown to openai-compatible', () => {
    expect(normalizeProvider(null)).toBe('openai-compatible');
    expect(normalizeProvider(undefined)).toBe('openai-compatible');
    expect(normalizeProvider('')).toBe('openai-compatible');
    expect(normalizeProvider('amux')).toBe('openai-compatible');
    expect(normalizeProvider('some-random-provider')).toBe('openai-compatible');
  });

  it('preserves imagen mapping', () => {
    expect(normalizeProvider('imagen')).toBe('imagen');
  });
});
