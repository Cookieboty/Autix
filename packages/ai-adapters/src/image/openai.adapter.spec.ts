import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIImageAdapter } from './openai.adapter';
import type { ImageCallContext } from './types';

describe('OpenAIImageAdapter', () => {
  const adapter = new OpenAIImageAdapter();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('generate', () => {
    it('omits response_format for gpt-image models', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ b64_json: 'abc' }] }),
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-1',
        prompt: 'A test',
        count: 1,
        size: '1024x1024',
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.response_format).toBeUndefined();
      expect(body.model).toBe('gpt-image-1');
    });

    it('includes response_format for DALL-E models', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ b64_json: 'abc' }] }),
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'dall-e-3',
        prompt: 'A test',
        count: 1,
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.response_format).toBe('b64_json');
    });

    it('uses Bearer authentication', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-1',
        prompt: 'test',
        count: 1,
      };

      await adapter.generate(ctx);

      const headers = (globalThis.fetch as any).mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer sk-test');
    });

    it('defaults to api.openai.com when baseUrl is empty', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-1',
        prompt: 'test',
        count: 1,
      };

      await adapter.generate(ctx);

      const url = (globalThis.fetch as any).mock.calls[0][0];
      expect(url).toBe('https://api.openai.com/v1/images/generations');
    });
  });

  describe('edit', () => {
    it('uses image[] for multipart source images', async () => {
      (globalThis.fetch as any).mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.startsWith('https://img.test/')) {
          return { ok: true, blob: async () => new Blob(['data'], { type: 'image/png' }) };
        }
        return { ok: true, json: async () => ({ data: [{ b64_json: 'result' }] }) };
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-1',
        prompt: 'edit this',
        count: 1,
        sourceImages: [
          { url: 'https://img.test/1.png' },
          { url: 'https://img.test/2.png' },
        ],
      };

      await adapter.edit(ctx);

      const editCall = (globalThis.fetch as any).mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('/images/edits'),
      );
      expect(editCall).toBeTruthy();
      const form = editCall[1].body as FormData;
      const imageEntries = form.getAll('image[]');
      expect(imageEntries.length).toBe(2);
    });

    it('appends mask when provided in metadata', async () => {
      (globalThis.fetch as any).mockImplementation(async (url: string) => {
        if (typeof url === 'string' && (url.includes('img.test') || url.includes('mask.test'))) {
          return { ok: true, blob: async () => new Blob(['data'], { type: 'image/png' }) };
        }
        return { ok: true, json: async () => ({ data: [{ b64_json: 'result' }] }) };
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-1',
        prompt: 'edit this',
        count: 1,
        sourceImages: [{ url: 'https://img.test/1.png' }],
        metadata: { mask: 'https://mask.test/m.png' },
      };

      await adapter.edit(ctx);

      const editCall = (globalThis.fetch as any).mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('/images/edits'),
      );
      const form = editCall[1].body as FormData;
      expect(form.get('mask')).toBeTruthy();
    });

    it('omits response_format for gpt-image models in edit mode', async () => {
      (globalThis.fetch as any).mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.startsWith('https://img.test/')) {
          return { ok: true, blob: async () => new Blob(['data'], { type: 'image/png' }) };
        }
        return { ok: true, json: async () => ({ data: [] }) };
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-1.5',
        prompt: 'edit',
        count: 1,
        sourceImages: [{ url: 'https://img.test/1.png' }],
      };

      await adapter.edit(ctx);

      const editCall = (globalThis.fetch as any).mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('/images/edits'),
      );
      const form = editCall[1].body as FormData;
      expect(form.get('response_format')).toBeNull();
    });
  });
});
