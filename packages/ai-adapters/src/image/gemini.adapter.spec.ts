import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiImageAdapter } from './gemini.adapter';
import type { ImageCallContext } from './types';

describe('GeminiImageAdapter', () => {
  const adapter = new GeminiImageAdapter();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const geminiResponse = (mimeType = 'image/png', data = 'abc123') => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType, data } }],
        },
      }],
    }),
  });

  describe('generate', () => {
    it('calls generateContent endpoint with x-goog-api-key', async () => {
      (globalThis.fetch as any).mockResolvedValue(geminiResponse());

      const ctx: ImageCallContext = {
        apiKey: 'goog-key',
        model: 'gemini-2.0-flash-preview-image-generation',
        prompt: 'A landscape',
        count: 1,
      };

      const result = await adapter.generate(ctx);

      const url = (globalThis.fetch as any).mock.calls[0][0];
      expect(url).toContain(':generateContent');
      expect(url).toContain('gemini-2.0-flash-preview-image-generation');
      expect(url).toContain('generativelanguage.googleapis.com');

      const headers = (globalThis.fetch as any).mock.calls[0][1].headers;
      expect(headers['x-goog-api-key']).toBe('goog-key');

      expect(result).toEqual(['data:image/png;base64,abc123']);
    });

    it('maps 1024x1024 to aspectRatio 1:1', async () => {
      (globalThis.fetch as any).mockResolvedValue(geminiResponse());

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-2.0-flash-preview-image-generation',
        prompt: 'test',
        count: 1,
        size: '1024x1024',
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.generationConfig.responseFormat.image.aspectRatio).toBe('1:1');
    });

    it('maps 1536x1024 to aspectRatio 3:2', async () => {
      (globalThis.fetch as any).mockResolvedValue(geminiResponse());

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-2.0-flash-preview-image-generation',
        prompt: 'test',
        count: 1,
        size: '1536x1024',
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.generationConfig.responseFormat.image.aspectRatio).toBe('3:2');
    });

    it('calls count times in parallel for multiple images', async () => {
      (globalThis.fetch as any).mockResolvedValue(geminiResponse());

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-2.0-flash-preview-image-generation',
        prompt: 'test',
        count: 3,
      };

      const result = await adapter.generate(ctx);

      expect((globalThis.fetch as any).mock.calls.length).toBe(3);
      expect(result.length).toBe(3);
    });

    it('handles inline_data (snake_case) in response', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ inline_data: { mime_type: 'image/jpeg', data: 'xyz' } }],
            },
          }],
        }),
      });

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-2.0-flash-preview-image-generation',
        prompt: 'test',
        count: 1,
      };

      const result = await adapter.generate(ctx);
      expect(result).toEqual(['data:image/jpeg;base64,xyz']);
    });
  });

  describe('edit', () => {
    it('includes inline_data for source images', async () => {
      (globalThis.fetch as any).mockImplementation(async (url: string, opts?: any) => {
        if (typeof url === 'string' && url.startsWith('https://img.test/')) {
          return {
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
            headers: new Headers({ 'content-type': 'image/png' }),
          };
        }
        return geminiResponse();
      });

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-2.0-flash-preview-image-generation',
        prompt: 'edit image',
        count: 1,
        sourceImages: [{ url: 'https://img.test/source.png' }],
      };

      await adapter.edit(ctx);

      const generateCall = (globalThis.fetch as any).mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes(':generateContent'),
      );
      expect(generateCall).toBeTruthy();
      const body = JSON.parse(generateCall[1].body);
      expect(body.contents[0].parts.length).toBe(2);
      expect(body.contents[0].parts[0].text).toBe('edit image');
      expect(body.contents[0].parts[1].inline_data).toBeDefined();
    });
  });
});
