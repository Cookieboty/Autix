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

  it('rejects a segment with a non-numeric index', () => {
    const body: Record<string, unknown> = {};
    expect(() => setPath(body, 'a[x]', 1)).toThrow(/"a\[x\]"/);
    expect(() => setPath(body, 'a[x]', 1)).toThrow(/"a\[x\]"\s+in\s+"a\[x\]"/);
  });

  it('rejects a segment with unbalanced/nested brackets', () => {
    const body: Record<string, unknown> = {};
    expect(() => setPath(body, 'a[[0]', 1)).toThrow(/"a\[\[0\]"/);
    expect(() => setPath(body, 'a[[0]', 1)).toThrow(/in "a\[\[0\]"/);
  });

  it('rejects an empty segment produced by a doubled dot', () => {
    const body: Record<string, unknown> = {};
    expect(() => setPath(body, 'a..b', 1)).toThrow(/""\s+in\s+"a\.\.b"/);
  });
});
