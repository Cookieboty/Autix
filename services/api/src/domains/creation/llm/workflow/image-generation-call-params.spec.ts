import { BadRequestException } from '@nestjs/common';
import { ImageUpstreamError } from '@autix/ai-adapters/image';
import type { ParamsSchema } from '@autix/domain/pricing';
import {
  buildImageCallRequest,
  buildUnsupportedImageParamsException,
  narrowImageParamsSchema,
  resolveImageCallCredentials,
  toImageUrlOrDataUri,
  type ResolvedImageRequest,
} from './image-generation-call-params';

/** 翻转后的图片 schema 形状（seed-pricing.schemas.ts）。 */
const PARAMS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['size', 'quality', 'resolution'],
  properties: {
    size: { type: 'string', 'x-ui': { role: 'wire', control: 'size-grid' } },
    quality: { type: 'string', 'x-ui': { role: 'both', control: 'chips' } },
    resolution: {
      type: 'string',
      'x-ui': {
        role: 'derived',
        control: 'hidden',
        derivedFrom: { param: 'size', via: 'imagePricingResolution' },
      },
    },
    referenceImages: { type: 'integer', 'x-ui': { role: 'pricing', control: 'hidden' } },
    seed: { type: 'string', 'x-ui': { role: 'wire', control: 'hidden' } },
  },
} as unknown as ParamsSchema;

const baseRequest: ResolvedImageRequest = {
  mode: 'generate',
  prompt: 'A quiet product scene',
  modelConfig: {
    id: 'image-model-1',
    model: 'gemini-3-pro-image',
    provider: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'key',
    metadata: { protocolKey: 'openai-images@v1', operations: ['generate', 'edit'] },
    paramsSchema: PARAMS_SCHEMA as never,
  },
  template: {},
  variables: {},
};

describe('resolveImageCallCredentials', () => {
  it('prefers explicit model credentials over metadata credentials', () => {
    expect(
      resolveImageCallCredentials({
        ...baseRequest,
        modelConfig: {
          ...baseRequest.modelConfig,
          baseUrl: 'https://explicit.example.com/v1',
          apiKey: 'explicit-key',
          metadata: {
            protocolKey: 'openai-images@v1',
            baseUrl: 'https://metadata.example.com/v1',
            apiKey: 'metadata-key',
          },
        },
      }),
    ).toEqual({
      baseUrl: 'https://explicit.example.com/v1',
      apiKey: 'explicit-key',
    });
  });

  it('falls back to metadata.baseUrl, but NEVER reads apiKey from metadata', () => {
    // metadata 会被下发到客户端；它兼作凭据来源就等于把密钥发给用户。
    // apiKey 只来自 model_configs.apiKey 列或系统级网关 env。
    const previous = process.env.AMUX_API_KEY;
    process.env.AMUX_API_KEY = 'env-gateway-key';
    try {
      expect(
        resolveImageCallCredentials({
          ...baseRequest,
          modelConfig: {
            ...baseRequest.modelConfig,
            baseUrl: undefined,
            apiKey: undefined,
            metadata: {
              protocolKey: 'openai-images@v1',
              baseUrl: 'https://metadata.example.com/v1',
              apiKey: 'metadata-key',
            },
          },
        }),
      ).toEqual({
        baseUrl: 'https://metadata.example.com/v1',
        apiKey: 'env-gateway-key',
      });
    } finally {
      if (previous === undefined) delete process.env.AMUX_API_KEY;
      else process.env.AMUX_API_KEY = previous;
    }
  });
});

describe('buildImageCallRequest', () => {
  it('routes to the preset declared by metadata.protocolKey — no provider sniffing', () => {
    const call = buildImageCallRequest(baseRequest, 2, PARAMS_SCHEMA);

    expect(call.preset.key).toBe('openai-images@v1');
    expect(call.operation).toBe('generate');
    expect(call.model).toBe('gemini-3-pro-image');
    expect(call.prompt).toBe('A quiet product scene');
    expect(call.count).toBe(2);
    expect(call.baseUrl).toBe('https://api.example.com/v1');
    expect(call.apiKey).toBe('key');
  });

  it('throws when the model declares no protocolKey — no silent fallback adapter', () => {
    expect(() =>
      buildImageCallRequest(
        { ...baseRequest, modelConfig: { ...baseRequest.modelConfig, metadata: {} } },
        1,
        PARAMS_SCHEMA,
      ),
    ).toThrow(/protocolKey/);
  });

  it('throws when protocolKey resolves to no registered preset', () => {
    expect(() =>
      buildImageCallRequest(
        {
          ...baseRequest,
          modelConfig: { ...baseRequest.modelConfig, metadata: { protocolKey: 'nope@v9' } },
        },
        1,
        PARAMS_SCHEMA,
      ),
    ).toThrow(/nope@v9/);
  });

  it('sends only the wire slice upstream: no derived, no pricing-only, no undeclared key', () => {
    const call = buildImageCallRequest(
      {
        ...baseRequest,
        settings: {
          size: '2048x2048@2K',
          quality: 'high',
          seed: '42',
          // 服务端派生的计价参数：上游绝不该看到它
          resolution: '2K',
          // 计价专用（上游要的是图本身，不是「几张」这个数）
          referenceImages: 3,
          // 老前端的脏字段：schema 从未声明 → 白名单丢弃
          promptTuning: '自动优化',
          skipPromptTuning: true,
          stylePreset: 'cinematic',
        } as never,
      },
      1,
      PARAMS_SCHEMA,
    );

    expect(call.params).toEqual({ size: '2048x2048@2K', quality: 'high', seed: '42' });
    expect(call.params).not.toHaveProperty('resolution');
    expect(call.params).not.toHaveProperty('referenceImages');
    expect(call.params).not.toHaveProperty('promptTuning');
    expect(call.params).not.toHaveProperty('skipPromptTuning');
    expect(call.params).not.toHaveProperty('stylePreset');
  });

  it('maps edit mode onto the edit operation and carries the input images', () => {
    const call = buildImageCallRequest(
      {
        ...baseRequest,
        mode: 'edit',
        sourceImages: [{ url: 'https://img.test/source.png' }],
        referenceImages: [{ url: 'https://img.test/reference.png' }],
      },
      1,
      PARAMS_SCHEMA,
    );

    expect(call.operation).toBe('edit');
    expect(call.sourceImages).toEqual([{ url: 'https://img.test/source.png' }]);
    expect(call.referenceImages).toEqual([{ url: 'https://img.test/reference.png' }]);
  });
});

describe('narrowImageParamsSchema', () => {
  it('rejects a model whose paramsSchema is missing — never silently drops every wire param', () => {
    expect(() => narrowImageParamsSchema(null, 'image-model-1')).toThrow(BadRequestException);
    expect(() => narrowImageParamsSchema('nonsense', 'image-model-1')).toThrow(BadRequestException);
  });

  it('passes a well-formed schema through', () => {
    expect(narrowImageParamsSchema(PARAMS_SCHEMA as never, 'image-model-1')).toBe(PARAMS_SCHEMA);
  });
});

describe('toImageUrlOrDataUri', () => {
  it('renders a base64 artifact as a data uri with the artifact mime type', () => {
    expect(
      toImageUrlOrDataUri({
        source: { type: 'base64', data: 'AAA', mimeType: 'image/webp' },
        index: 0,
      }),
    ).toBe('data:image/webp;base64,AAA');
  });

  it('passes a url artifact through untouched', () => {
    expect(
      toImageUrlOrDataUri({
        source: { type: 'url', url: 'https://img.test/1.png' },
        index: 0,
      }),
    ).toBe('https://img.test/1.png');
  });
});

describe('buildUnsupportedImageParamsException', () => {
  it('keeps the ERR_IMAGE_PARAMS_NOT_SUPPORTED frontend contract and carries upstream diagnostics', () => {
    const exception = buildUnsupportedImageParamsException(
      baseRequest,
      new ImageUpstreamError({
        message: 'image upstream 400 (params)',
        classification: 'params',
        httpStatus: 400,
        retryable: false,
        upstreamBody: '{"error":{"message":"invalid size"}}',
      }),
    );

    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      errorCode: 'ERR_IMAGE_PARAMS_NOT_SUPPORTED',
      message: expect.stringContaining('当前模型不支持所选参数'),
      details: {
        model: 'gemini-3-pro-image',
        protocolKey: 'openai-images@v1',
        httpStatus: 400,
        upstreamError: 'image upstream 400 (params)',
      },
    });
  });
});
