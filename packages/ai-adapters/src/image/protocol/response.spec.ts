import { describe, it, expect } from 'vitest';
import { extractArtifacts } from './response';
import type { ResponseSpec } from './types';

const OPENAI: ResponseSpec = {
  itemsPath: 'data[*]', b64Field: 'b64_json', urlField: 'url', defaultMime: 'image/png',
  revisedPromptField: 'revised_prompt',
};
const GEMINI: ResponseSpec = {
  itemsPath: 'candidates[*].content.parts[*]',
  b64Field: 'inlineData.data', mimeField: 'inlineData.mimeType', defaultMime: 'image/png',
};

describe('extractArtifacts', () => {
  it('extracts base64 items with the default mime', () => {
    const out = extractArtifacts(OPENAI, { data: [{ b64_json: 'AAA' }, { b64_json: 'BBB' }] });
    expect(out).toEqual([
      { source: { type: 'base64', data: 'AAA', mimeType: 'image/png' }, index: 0 },
      { source: { type: 'base64', data: 'BBB', mimeType: 'image/png' }, index: 1 },
    ]);
  });

  it('extracts url items and keeps them typed as url — no data-uri/url mixing (spec §8)', () => {
    const out = extractArtifacts(OPENAI, { data: [{ url: 'https://x/a.png' }] });
    expect(out[0].source).toEqual({ type: 'url', url: 'https://x/a.png', mimeType: undefined });
  });

  it('carries revisedPrompt when the spec declares the field', () => {
    const out = extractArtifacts(OPENAI, { data: [{ b64_json: 'A', revised_prompt: 'a fluffy cat' }] });
    expect(out[0].revisedPrompt).toBe('a fluffy cat');
  });

  it('walks a nested wildcard path and reads the mime from the response', () => {
    const out = extractArtifacts(GEMINI, {
      candidates: [{ content: { parts: [
        { text: 'ignored' },
        { inlineData: { data: 'ZZZ', mimeType: 'image/webp' } },
      ] } }],
    });
    expect(out).toEqual([
      { source: { type: 'base64', data: 'ZZZ', mimeType: 'image/webp' }, index: 0 },
    ]);
  });

  it('returns an empty array for an empty payload', () => {
    expect(extractArtifacts(OPENAI, { data: [] })).toEqual([]);
  });

  it('returns an empty array — not a throw — for a malformed payload', () => {
    expect(extractArtifacts(OPENAI, { error: { message: 'boom' } })).toEqual([]);
    expect(extractArtifacts(OPENAI, null)).toEqual([]);
    expect(extractArtifacts(OPENAI, 'not json')).toEqual([]);
  });

  it('skips items that carry neither b64 nor url', () => {
    const out = extractArtifacts(OPENAI, { data: [{ b64_json: 'A' }, { junk: 1 }] });
    expect(out).toHaveLength(1);
    expect(out[0].index).toBe(0);
  });
});
