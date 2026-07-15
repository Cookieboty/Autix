import { describe, it, expect } from 'vitest';
import { resolveImagePreset } from '../registry';
import { assembleImageRequest } from '../assemble';
import type { ImageCallRequest } from '../types';

describe('gemini-generate-content@v1 preset', () => {
  const preset = () => resolveImagePreset('gemini-generate-content@v1');

  const req = (over: Partial<ImageCallRequest> = {}): ImageCallRequest => ({
    preset: preset(), operation: 'generate', baseUrl: 'https://api.amux.ai', apiKey: 'sk-x',
    model: 'gemini-2.5-flash-image-official', prompt: 'a fox', count: 1,
    params: { aspectRatio: '1:1', resolution: '1K', thinkingLevel: 'minimal' }, ...over,
  });

  it('is registered', () => {
    expect(() => preset()).not.toThrow();
  });

  it('assembles the native generateContent wire shape', () => {
    const out = assembleImageRequest(req());
    expect(out.url).toBe(
      'https://api.amux.ai/v1beta/models/gemini-2.5-flash-image-official:generateContent',
    );
    expect(out.headers['x-goog-api-key']).toBe('sk-x');
    expect(out.headers).not.toHaveProperty('Authorization');
    // model 走 URL（$url.model），不进 body；prompt 在 parts[0]
    expect(out.body).not.toHaveProperty('model');
    expect(out.body?.contents).toEqual([{ parts: [{ text: 'a fox' }] }]);
    expect(out.body?.generationConfig).toMatchObject({
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
      thinkingConfig: { thinkingLevel: 'minimal' },
    });
    // generateContent 无 n 字段：多张走 fan-out
    expect(out.body).not.toHaveProperty('n');
    expect(out.fanOut).toEqual({ count: 1, maxConcurrency: 4 });
  });

  it('omits imageSize / thinkingLevel bindings when the model does not send them', () => {
    const out = assembleImageRequest(req({ params: { aspectRatio: '16:9' } }));
    expect(out.body?.generationConfig).toEqual({
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '16:9' },
    });
  });

  it('records edit input images for inline embedding into the parts array', () => {
    const out = assembleImageRequest(
      req({ operation: 'edit', sourceImages: [{ url: 'data:image/png;base64,AQ==' }] }),
    );
    expect(out.inlineImages?.partsPath).toBe('contents[0].parts');
    expect(out.inlineImages?.images).toEqual([{ url: 'data:image/png;base64,AQ==' }]);
  });
});
