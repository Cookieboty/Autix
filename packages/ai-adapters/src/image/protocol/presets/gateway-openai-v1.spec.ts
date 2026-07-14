import { describe, it, expect } from 'vitest';
import { assembleImageRequest } from '../assemble';
import { gatewayOpenAIV1 } from './gateway-openai-v1';
import { resolveImagePreset } from '../registry';
import type { ImageCallRequest } from '../types';

const REQ = (over: Partial<ImageCallRequest> = {}): ImageCallRequest => ({
  preset: gatewayOpenAIV1, operation: 'generate',
  baseUrl: 'https://gw.example.com', apiKey: 'sk', model: 'nano-banana',
  prompt: 'a cat', count: 1, params: {}, ...over,
});

describe('gateway-openai@v1 — golden request bodies', () => {
  it('generate: canonical body', () => {
    const out = assembleImageRequest(REQ({ params: { size: '1024x1024@1K', quality: 'high' } }));
    expect(out.body).toEqual({
      model: 'nano-banana', prompt: 'a cat', n: 1,
      response_format: 'b64_json',
      size: '1024x1024',        // ← @1K 被剥掉
      quality: 'high',
    });
  });

  // 这条就是第 2 期的验收标准（spec §7.3）
  it('Nano Banana: a 2K token reaches the gateway as a bare WxH', () => {
    const out = assembleImageRequest(REQ({ params: { size: '2048x2048@2K' } }));
    expect(out.body?.size).toBe('2048x2048');
    expect(String(out.body?.size)).not.toContain('@');
  });

  it('edit: multipart with preset-declared field names', () => {
    const out = assembleImageRequest(REQ({
      operation: 'edit',
      sourceImages: [{ url: 'https://x/a.jpg' }],
      referenceImages: [{ url: 'https://x/b.png' }],
    }));
    expect(out.url).toBe('https://gw.example.com/v1/images/edits');
    expect(out.multipart?.images.map((i) => i.field)).toEqual(['image', 'image_2']);
  });

  it('never sends a params key it has no binding for', () => {
    const out = assembleImageRequest(REQ({ params: { guidanceScale: 7, steps: 30 } }));
    expect(out.body).not.toHaveProperty('guidanceScale');
    expect(out.body).not.toHaveProperty('steps');
  });

  it('carries no gateway name, no default domain, no env read (spec 口径 5)', () => {
    const source = JSON.stringify(gatewayOpenAIV1);
    expect(source).not.toMatch(/amux|process\.env|https?:\/\//i);
  });
});

describe('resolveImagePreset', () => {
  it('resolves the registered key', () => {
    expect(resolveImagePreset('openai-images@v1')).toBe(gatewayOpenAIV1);
  });

  it('throws on an unregistered key — no silent fallback (that was the old adapter bug)', () => {
    expect(() => resolveImagePreset('nope@v9')).toThrow(/nope@v9/);
    expect(() => resolveImagePreset(undefined)).toThrow(/protocolKey/);
  });
});
