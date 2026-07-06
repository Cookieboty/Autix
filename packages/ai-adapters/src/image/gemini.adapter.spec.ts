import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setSafeFetchResolver } from '../core/safe-fetch';
import {
  GeminiImageAdapter,
  SIZE_TO_ASPECT_RATIO,
  DEFAULT_GEMINI_ASPECT_RATIO,
  parseGeminiSizeToken,
} from './gemini.adapter';
import type { ImageCallContext } from './types';

describe('GeminiImageAdapter', () => {
  const adapter = new GeminiImageAdapter();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    setSafeFetchResolver(async () => [{ address: '93.184.216.34', family: 4 }]);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setSafeFetchResolver(null);
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

    it('maps 1248x832 to aspectRatio 3:2', async () => {
      (globalThis.fetch as any).mockResolvedValue(geminiResponse());

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-2.0-flash-preview-image-generation',
        prompt: 'test',
        count: 1,
        size: '1248x832',
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

  describe('SIZE_TO_ASPECT_RATIO mapping', () => {
    it('covers the 10 common ratios exposed by Gemini 2.5 Flash Image', () => {
      const required: Array<[string, string]> = [
        ['1024x1024', '1:1'],
        ['832x1248', '2:3'],
        ['1248x832', '3:2'],
        ['864x1184', '3:4'],
        ['1184x864', '4:3'],
        ['896x1152', '4:5'],
        ['1152x896', '5:4'],
        ['768x1344', '9:16'],
        ['1344x768', '16:9'],
        ['1536x672', '21:9'],
      ];
      for (const [size, expected] of required) {
        expect(SIZE_TO_ASPECT_RATIO[size]).toBe(expected);
      }
    });

    it.each(Object.entries(SIZE_TO_ASPECT_RATIO))(
      'maps %s → aspectRatio %s in generationConfig.responseFormat.image',
      async (size, expected) => {
        (globalThis.fetch as any).mockResolvedValue(geminiResponse());

        const ctx: ImageCallContext = {
          apiKey: 'key',
          model: 'gemini-3.1-flash-image',
          prompt: 'test',
          count: 1,
          size,
        };

        await adapter.generate(ctx);

        const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
        expect(body.generationConfig.responseFormat.image.aspectRatio).toBe(expected);
      },
    );

    it('falls back to 1:1 when size is not in the whitelist', async () => {
      (globalThis.fetch as any).mockResolvedValue(geminiResponse());

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-3-pro-image',
        prompt: 'test',
        count: 1,
        size: '999x999',
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.generationConfig.responseFormat.image.aspectRatio).toBe(
        DEFAULT_GEMINI_ASPECT_RATIO,
      );
      expect(DEFAULT_GEMINI_ASPECT_RATIO).toBe('1:1');
    });

    it('parses encoded Gemini 3 image size tokens into aspect ratio and imageSize', async () => {
      expect(parseGeminiSizeToken('2048x2048@2K')).toEqual({
        aspectRatio: '1:1',
        imageSize: '2K',
      });

      (globalThis.fetch as any).mockResolvedValue(geminiResponse());

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-3-pro-image',
        prompt: 'test',
        count: 1,
        size: '2048x2048@2K',
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.generationConfig.responseFormat.image).toEqual({
        aspectRatio: '1:1',
        imageSize: '2K',
      });
    });

    it('uses metadata geminiImageSize only when size token does not include imageSize', async () => {
      (globalThis.fetch as any).mockResolvedValue(geminiResponse());

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-3.1-flash-image',
        prompt: 'test',
        count: 1,
        size: '256x1024',
        metadata: { geminiImageSize: '512px' },
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.generationConfig.responseFormat.image).toEqual({
        aspectRatio: '1:4',
        imageSize: '512px',
      });
    });

    it('omits responseFormat entirely when size and geminiImageSize are both absent', async () => {
      (globalThis.fetch as any).mockResolvedValue(geminiResponse());

      const ctx: ImageCallContext = {
        apiKey: 'key',
        model: 'gemini-3-pro-image',
        prompt: 'test',
        count: 1,
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.generationConfig.responseFormat).toBeUndefined();
    });
  });
});
