import { describe, it, expect } from 'vitest';
import { assembleImageRequest } from './assemble';
import type { ImageCallRequest, ProtocolPreset } from './types';

const PRESET: ProtocolPreset = {
  key: 'test@v1',
  transport: 'sync-json',
  timeoutMs: 600_000,
  auth: { in: 'header', name: 'Authorization', template: 'Bearer {apiKey}' },
  endpoints: { generate: { method: 'POST', path: '/v1/images/generations' } },
  coreBindings: {
    generate: {
      model: { path: 'model' },
      prompt: { path: 'prompt' },
      count: { path: 'n' },
    },
  },
  paramBindings: {
    size: { path: 'size', transform: 'stripTierSuffix' },
    quality: { path: 'quality' },
    seed: { path: 'seed', omitWhen: 'empty' },
    negativePrompt: { strategy: 'prompt-inject', template: 'avoid: {{value}}' },
    steps: { strategy: 'ignore' },
  },
  staticBody: { response_format: 'b64_json' },
  response: { itemsPath: 'data[*]', b64Field: 'b64_json', urlField: 'url', defaultMime: 'image/png' },
  errorMapping: { '400': 'params', '*': 'upstream' },
};

const BASE: ImageCallRequest = {
  preset: PRESET,
  operation: 'generate',
  baseUrl: 'https://gw.example.com',
  apiKey: 'sk-test',
  model: 'nano-banana',
  prompt: 'a cat',
  count: 2,
  params: {},
};

describe('assembleImageRequest — sync-json', () => {
  it('binds core fields and the static body', () => {
    const out = assembleImageRequest(BASE);
    expect(out.url).toBe('https://gw.example.com/v1/images/generations');
    expect(out.headers.Authorization).toBe('Bearer sk-test');
    expect(out.body).toEqual({
      model: 'nano-banana', prompt: 'a cat', n: 2, response_format: 'b64_json',
    });
  });

  it('strips the @tier suffix off size — this is the Nano Banana fix (spec §7.3)', () => {
    const out = assembleImageRequest({ ...BASE, params: { size: '2048x2048@2K' } });
    expect(out.body?.size).toBe('2048x2048');
    expect(out.applied.params.size).toBe('2048x2048');   // applied == 真正发出去的值（§4.4）
  });

  it('omits a param bound with omitWhen:empty when its value is empty', () => {
    const out = assembleImageRequest({ ...BASE, params: { seed: '' } });
    expect(out.body).not.toHaveProperty('seed');
    expect(assembleImageRequest({ ...BASE, params: { seed: '42' } }).body?.seed).toBe('42');
  });

  it('injects a prompt-inject param into the prompt, not into the body', () => {
    const out = assembleImageRequest({ ...BASE, params: { negativePrompt: 'blurry' } });
    expect(out.body).not.toHaveProperty('negativePrompt');
    expect(out.promptOverride).toBe('a cat\navoid: blurry');
    expect(out.body?.prompt).toBe('a cat\navoid: blurry');
  });

  it('drops an explicitly ignored param without a warning-worthy surprise', () => {
    const out = assembleImageRequest({ ...BASE, params: { steps: 30 } });
    expect(out.body).not.toHaveProperty('steps');
  });

  it('drops a param the preset has no binding for, and records it as a coercion', () => {
    const out = assembleImageRequest({ ...BASE, params: { guidanceScale: 7 } });
    expect(out.body).not.toHaveProperty('guidanceScale');
    expect(out.applied.coercions.join(' ')).toMatch(/guidanceScale/);
  });

  it('applies a valueMap before the path write', () => {
    const preset: ProtocolPreset = {
      ...PRESET,
      paramBindings: { size: { path: 'aspect', valueMap: { '1024x1024': '1:1' } } },
    };
    const out = assembleImageRequest({ ...BASE, preset, params: { size: '1024x1024' } });
    expect(out.body?.aspect).toBe('1:1');
  });

  it('writes one param to two paths when the binding is an array', () => {
    const preset: ProtocolPreset = {
      ...PRESET,
      paramBindings: {
        size: [
          { path: 'generationConfig.image.aspectRatio', valueMap: { '1024x1024@1K': '1:1' } },
          { path: 'generationConfig.image.imageSize', valueMap: { '1024x1024@1K': '1K' } },
        ],
      },
    };
    const out = assembleImageRequest({ ...BASE, preset, params: { size: '1024x1024@1K' } });
    expect(out.body?.generationConfig).toEqual({ image: { aspectRatio: '1:1', imageSize: '1K' } });
  });

  it('reports fan-out instead of binding n when the preset has no n field', () => {
    const preset: ProtocolPreset = {
      ...PRESET,
      coreBindings: {
        generate: {
          model: { path: 'model' }, prompt: { path: 'prompt' },
          count: { strategy: 'fan-out', maxConcurrency: 4 },
        },
      },
    };
    const out = assembleImageRequest({ ...BASE, preset, count: 3 });
    expect(out.body).not.toHaveProperty('n');
    expect(out.fanOut).toEqual({ count: 3, maxConcurrency: 4 });
  });

  it('throws when the operation has no endpoint in this preset', () => {
    expect(() => assembleImageRequest({ ...BASE, operation: 'edit' })).toThrow(/edit/);
  });
});

describe('assembleImageRequest — multipart', () => {
  const MULTIPART: ProtocolPreset = {
    ...PRESET,
    transport: 'multipart',
    endpoints: { edit: { method: 'POST', path: '/v1/images/edits' } },
    coreBindings: {
      edit: {
        model: { path: 'model' }, prompt: { path: 'prompt' }, count: { path: 'n' },
        inputImages: { path: 'image' },
      },
    },
    multipart: { imageField: 'image', indexBase: 1, filenamePattern: 'source-{i}', maskField: 'mask' },
  };

  it('names image parts from the preset, not from a hardcoded convention', () => {
    const out = assembleImageRequest({
      ...BASE, preset: MULTIPART, operation: 'edit',
      sourceImages: [{ url: 'https://x/a.jpg' }], referenceImages: [{ url: 'https://x/b.webp' }],
    });
    expect(out.multipart?.images.map((i) => i.field)).toEqual(['image', 'image_2']);
    expect(out.multipart?.fields).toMatchObject({ model: 'nano-banana', prompt: 'a cat', n: '2' });
  });
});
