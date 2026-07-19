import { describe, it, expect } from 'vitest';
import { assembleImageRequest } from './assemble';
import { doubaoImagesV1 } from './presets/vendors';
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
    // applied.params 对 prompt-inject 记的是模板渲染前的原始值 'blurry'，不是渲染后落进
    // prompt 里的 'avoid: blurry' —— 渲染后的完整 prompt 已经由 out.promptOverride 单独
    // 记录了，applied 这里只需要诚实反映「用户传的这个参数值是什么」。
    expect(out.applied.params.negativePrompt).toBe('blurry');
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
    // 数组绑定没有单一标量能诚实代表"发到了两个不同字段、值还不同"——applied.params.size
    // 必须是按路径分开记录的 Record<path, resolvedValue>，两条路径的值都不能丢。
    expect(out.applied.params.size).toEqual({
      'generationConfig.image.aspectRatio': '1:1',
      'generationConfig.image.imageSize': '1K',
    });
  });

  it('omits only the skipped path from applied when an array binding has a mix of omitWhen:empty specs', () => {
    const preset: ProtocolPreset = {
      ...PRESET,
      paramBindings: {
        seed: [
          { path: 'generationConfig.seed', omitWhen: 'empty' },
          { path: 'generationConfig.seedEcho' },
        ],
      },
    };
    const out = assembleImageRequest({ ...BASE, preset, params: { seed: '' } });
    expect(out.body).toEqual({
      model: 'nano-banana', prompt: 'a cat', n: 2, response_format: 'b64_json',
      generationConfig: { seedEcho: '' },
    });
    expect(out.applied.params.seed).toEqual({ 'generationConfig.seedEcho': '' });
  });

  it('drops the param from applied entirely when every spec of an array binding is omitWhen:empty and skipped', () => {
    const preset: ProtocolPreset = {
      ...PRESET,
      paramBindings: {
        seed: [
          { path: 'generationConfig.seed', omitWhen: 'empty' },
          { path: 'generationConfig.seedEcho', omitWhen: 'empty' },
        ],
      },
    };
    const out = assembleImageRequest({ ...BASE, preset, params: { seed: '' } });
    expect(out.body).not.toHaveProperty('generationConfig');
    expect(out.applied.params).not.toHaveProperty('seed');
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

  it('deep-clones staticBody so a nested subtree written by a binding never leaks across calls', () => {
    // staticBody 里嵌了 generationConfig，绑定又往同一棵子树写 imageConfig。浅拷贝会改到
    // 模块级常量 staticBody.generationConfig 本身，导致第一次请求的 imageConfig 污染后续所有请求。
    const preset: ProtocolPreset = {
      ...PRESET,
      staticBody: { generationConfig: { responseModalities: ['IMAGE'] } },
      paramBindings: { aspectRatio: { path: 'generationConfig.imageConfig.aspectRatio' } },
    };
    const first = assembleImageRequest({ ...BASE, preset, params: { aspectRatio: '16:9' } });
    expect(first.body?.generationConfig).toEqual({
      responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' },
    });

    const second = assembleImageRequest({ ...BASE, preset, params: {} });
    expect(second.body?.generationConfig).toEqual({ responseModalities: ['IMAGE'] });
  });
});

describe('assembleImageRequest — json inline images (gemini generateContent)', () => {
  const NATIVE: ProtocolPreset = {
    ...PRESET,
    key: 'gemini-generate-content@v1',
    endpoints: {
      generate: { method: 'POST', path: '/v1beta/models/{model}:generateContent' },
      edit: { method: 'POST', path: '/v1beta/models/{model}:generateContent' },
    },
    coreBindings: {
      generate: {
        model: { path: '$url.model' }, prompt: { path: 'contents[0].parts[0].text' },
        count: { strategy: 'fan-out', maxConcurrency: 4 },
      },
      edit: {
        model: { path: '$url.model' }, prompt: { path: 'contents[0].parts[0].text' },
        count: { strategy: 'fan-out', maxConcurrency: 4 }, inputImages: { path: 'contents[0].parts' },
      },
    },
    paramBindings: { aspectRatio: { path: 'generationConfig.imageConfig.aspectRatio' } },
    staticBody: { generationConfig: { responseModalities: ['IMAGE'] } },
    referenceMode: { kind: 'generate-inline-base64', partsPath: 'contents[0].parts' },
    response: {
      itemsPath: 'candidates[*].content.parts[*]',
      b64Field: 'inlineData.data', mimeField: 'inlineData.mimeType', defaultMime: 'image/png',
    },
  };

  it('puts model in the URL (not the body), prompt at parts[0].text, and records input images as urls', () => {
    const out = assembleImageRequest({
      ...BASE, preset: NATIVE, operation: 'edit', params: { aspectRatio: '1:1' },
      sourceImages: [{ url: 'data:image/png;base64,AQ==' }],
      referenceImages: [{ url: 'data:image/png;base64,Ag==' }],
    });
    expect(out.url).toBe('https://gw.example.com/v1beta/models/nano-banana:generateContent');
    expect(out.body).not.toHaveProperty('model');
    // prompt 在 parts[0]；图片此刻还没抓取（execute 再嵌），parts 只有文本一项
    expect(out.body?.contents).toEqual([{ parts: [{ text: 'a cat' }] }]);
    expect(out.body?.generationConfig).toEqual({
      responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' },
    });
    expect(out.inlineImages).toEqual({
      partsPath: 'contents[0].parts',
      images: [{ url: 'data:image/png;base64,AQ==' }, { url: 'data:image/png;base64,Ag==' }],
    });
  });

  it('does not set inlineImages when the request carries no input images', () => {
    const out = assembleImageRequest({ ...BASE, preset: NATIVE });
    expect(out.inlineImages).toBeUndefined();
  });
});

describe('assembleImageRequest — generate-json-url (doubao seedream)', () => {
  function reqWith(refs: string[]) {
    return {
      preset: doubaoImagesV1, operation: 'generate' as const,
      baseUrl: 'https://gw.example/v1', apiKey: 'k', model: 'doubao-seedream-4-5',
      prompt: 'p', count: 1, params: { aspectRatio: '1:1', resolution: '2K' },
      referenceImages: refs.map((url) => ({ url })),
    };
  }

  it('generate-json-url: 单张写标量 body.image', () => {
    const a = assembleImageRequest(reqWith(['https://x/1.png']));
    expect((a.body as any).image).toBe('https://x/1.png');
  });

  it('generate-json-url: 多张写数组 body.image', () => {
    const a = assembleImageRequest(reqWith(['https://x/1.png', 'https://x/2.png']));
    expect((a.body as any).image).toEqual(['https://x/1.png', 'https://x/2.png']);
  });

  it('generate-json-url: 超过 maxImages 截断并记 coercion', () => {
    const a = assembleImageRequest(reqWith(Array.from({ length: 16 }, (_, i) => `https://x/${i}.png`)));
    expect((a.body as any).image).toHaveLength(14);
    expect(a.applied.coercions.some((c) => /maxImages/.test(c))).toBe(true);
  });

  // size = (比例 × 档位) 复合成单个像素串——Ark 只收一个 size，没有 aspect_ratio/resolution 字段。
  it('composes size = WxH from aspectRatio × resolution, and sends no aspect_ratio/resolution', () => {
    const a = assembleImageRequest({
      preset: doubaoImagesV1, operation: 'generate' as const,
      baseUrl: 'https://gw.example/v1', apiKey: 'k', model: 'doubao-seedream-4-5',
      prompt: 'p', count: 1, params: { aspectRatio: '9:16', resolution: '2K' },
    });
    expect((a.body as any).size).toBe('1600x2848');
    expect((a.body as any).aspect_ratio).toBeUndefined();
    expect((a.body as any).resolution).toBeUndefined();
    expect(a.applied.params.size).toBe('1600x2848');
    // 源参数被复合消费，不算「dropped」
    expect(a.applied.coercions.join(' ')).not.toMatch(/aspectRatio|resolution/);
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
