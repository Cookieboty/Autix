import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleImageAdapter } from './openai-compatible.adapter';
import type { ImageCallContext } from './types';

describe('OpenAICompatibleImageAdapter', () => {
  const adapter = new OpenAICompatibleImageAdapter();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('generate', () => {
    it('sends correct request body with response_format b64_json', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ url: 'https://img.test/1.png' }] }),
      });

      const ctx: ImageCallContext = {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'some-model',
        prompt: 'A test scene',
        count: 2,
        size: '1024x1024',
        quality: 'high',
      };

      const result = await adapter.generate(ctx);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/v1/images/generations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'some-model',
            prompt: 'A test scene',
            n: 2,
            response_format: 'b64_json',
            size: '1024x1024',
            quality: 'high',
          }),
        }),
      );
      expect(result).toEqual(['https://img.test/1.png']);
    });

    it('uses custom endpoint from metadata', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ b64_json: 'abc' }] }),
      });

      const ctx: ImageCallContext = {
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        model: 'model',
        prompt: 'test',
        count: 1,
        metadata: { imageGenerationEndpoint: '/custom/generate' },
      };

      await adapter.generate(ctx);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/custom/generate',
        expect.anything(),
      );
    });

    it('omits size/quality when set to auto', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ url: 'https://img.test/1.png' }] }),
      });

      const ctx: ImageCallContext = {
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        model: 'model',
        prompt: 'test',
        count: 1,
        size: 'auto',
        quality: 'auto',
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.size).toBeUndefined();
      expect(body.quality).toBeUndefined();
    });
  });

  describe('edit', () => {
    it('uses image/image_2 naming for source images', async () => {
      (globalThis.fetch as any).mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.startsWith('https://img.test/')) {
          return { ok: true, blob: async () => new Blob(['fake-image'], { type: 'image/png' }) };
        }
        return { ok: true, json: async () => ({ data: [{ url: 'https://out.test/1.png' }] }) };
      });

      const ctx: ImageCallContext = {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'key',
        model: 'model',
        prompt: 'edit this',
        count: 1,
        sourceImages: [
          { url: 'https://img.test/1.png' },
          { url: 'https://img.test/2.png' },
        ],
      };

      await adapter.edit(ctx);

      const fetchCalls = (globalThis.fetch as any).mock.calls;
      const editCall = fetchCalls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('/images/edits'),
      );
      expect(editCall).toBeTruthy();
      const form = editCall[1].body as FormData;
      expect(form.get('response_format')).toBe('b64_json');
    });
  });
});
