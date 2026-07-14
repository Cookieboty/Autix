import { describe, it, expect } from 'vitest';
import { setPath } from './bind';

describe('setPath', () => {
  it('writes a flat key', () => {
    const body: Record<string, unknown> = {};
    setPath(body, 'size', '1024x1024');
    expect(body).toEqual({ size: '1024x1024' });
  });

  it('creates intermediate objects for a dotted path', () => {
    const body: Record<string, unknown> = {};
    setPath(body, 'generationConfig.responseFormat.image.aspectRatio', '16:9');
    expect(body).toEqual({
      generationConfig: { responseFormat: { image: { aspectRatio: '16:9' } } },
    });
  });

  it('writes into an array index', () => {
    const body: Record<string, unknown> = {};
    setPath(body, 'contents[0].parts[0].text', 'hello');
    expect(body).toEqual({ contents: [{ parts: [{ text: 'hello' }] }] });
  });

  it('appends to an array when the index is omitted', () => {
    const body: Record<string, unknown> = { contents: [{ parts: [{ text: 'p' }] }] };
    setPath(body, 'contents[0].parts[]', { inline: 'a' });
    setPath(body, 'contents[0].parts[]', { inline: 'b' });
    expect(body).toEqual({
      contents: [{ parts: [{ text: 'p' }, { inline: 'a' }, { inline: 'b' }] }],
    });
  });

  it('does not clobber a sibling already written at the same parent', () => {
    const body: Record<string, unknown> = {};
    setPath(body, 'generationConfig.seed', 7);
    setPath(body, 'generationConfig.responseModalities', ['IMAGE']);
    expect(body).toEqual({ generationConfig: { seed: 7, responseModalities: ['IMAGE'] } });
  });
});
