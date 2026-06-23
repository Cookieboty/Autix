import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIImageAdapter } from './openai.adapter';
import { UpstreamParamsInvalidError } from '../core/errors';
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

    it('merges sourceImages and referenceImages into image[] with distinct filenames', async () => {
      (globalThis.fetch as any).mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.startsWith('https://img.test/')) {
          return { ok: true, blob: async () => new Blob(['data'], { type: 'image/png' }) };
        }
        return { ok: true, json: async () => ({ data: [{ b64_json: 'result' }] }) };
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-1',
        prompt: 'edit',
        count: 1,
        sourceImages: [
          { url: 'https://img.test/s1.png' },
          { url: 'https://img.test/s2.png' },
        ],
        referenceImages: [{ url: 'https://img.test/r1.png' }],
      };

      await adapter.edit(ctx);

      const editCall = (globalThis.fetch as any).mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('/images/edits'),
      );
      const form = editCall[1].body as FormData;
      const entries = form.getAll('image[]');
      expect(entries.length).toBe(3);
      const names = entries.map((f) => (f as File).name);
      expect(names).toEqual(['source-0.png', 'source-1.png', 'reference-0.png']);
    });

    it('rejects edit() for non-gpt-image kinds (compatible) with UpstreamParamsInvalidError', async () => {
      (globalThis.fetch as any).mockImplementation(async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      }));

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'sdxl-base-1.0',
        prompt: 'edit',
        count: 1,
        sourceImages: [{ url: 'https://img.test/1.png' }],
      };

      await expect(adapter.edit(ctx)).rejects.toBeInstanceOf(UpstreamParamsInvalidError);
      // No HTTP request should be issued to /images/edits when the guard trips.
      const editCalls = (globalThis.fetch as any).mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('/images/edits'),
      );
      expect(editCalls.length).toBe(0);
    });

    it('rejects edit() for legacy dall-e-3 with UpstreamParamsInvalidError', async () => {
      (globalThis.fetch as any).mockImplementation(async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      }));

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'dall-e-3',
        prompt: 'edit',
        count: 1,
        sourceImages: [{ url: 'https://img.test/1.png' }],
      };

      await expect(adapter.edit(ctx)).rejects.toMatchObject({
        code: 'UPSTREAM_PARAMS_INVALID',
      });
    });
  });

  describe('defensive clamp', () => {
    it('omits count for gpt-image generate requests', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-2',
        prompt: 'many',
        count: 99,
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.n).toBeUndefined();
    });

    it('still omits count for gpt-image when 0 or negative is supplied', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-2',
        prompt: 'zero',
        count: 0,
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.n).toBeUndefined();
    });

    it('rewrites an out-of-whitelist size via mapEquivalentSize', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-2',
        prompt: 'wide',
        count: 1,
        // Not in gpt-image whitelist; closest aspect is 2048x1152 (16:9).
        size: '1792x1024',
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.size).toBe('2048x1152');
    });

    it('drops `auto` size from the request body (gpt-image accepts auto upstream by omission)', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const ctx: ImageCallContext = {
        apiKey: 'sk-test',
        model: 'gpt-image-2',
        prompt: 'auto',
        count: 1,
        size: 'auto',
      };

      await adapter.generate(ctx);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.size).toBeUndefined();
    });
  });
});
