import { BadRequestException } from '@nestjs/common';
import { UpstreamParamsInvalidError } from '@autix/ai-adapters/core';
import {
  buildUnsupportedImageParamsException,
  isUpstreamImageParamsError,
  normalizeImageCallParams,
  resolveImageCallCredentials,
  type ResolvedImageRequest,
} from './image-generation-call-params';

const baseRequest: ResolvedImageRequest = {
  mode: 'generate',
  prompt: 'A quiet product scene',
  modelConfig: {
    id: 'image-model-1',
    model: 'gpt-image-2',
    provider: 'openai-official',
    metadata: {},
  },
  template: {},
  variables: {},
};

describe('image generation call params', () => {
  it('normalizes credentials, primary params, and safe fallback params', () => {
    const request: ResolvedImageRequest = {
      ...baseRequest,
      modelConfig: {
        ...baseRequest.modelConfig,
        metadata: {
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'metadata-key',
          passthrough: true,
        },
      },
      settings: {
        size: '1024x1024',
        quality: 'high',
      },
      sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
      referenceImages: [{ url: 'https://img.test/reference.png' }],
    };

    expect(resolveImageCallCredentials(request)).toEqual({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'metadata-key',
    });

    const params = normalizeImageCallParams(request, 99);

    expect(params.kind).toBe('gpt-image');
    expect(params.metadata).toMatchObject({ passthrough: true });
    expect(params.primaryContext).toMatchObject({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'metadata-key',
      model: 'gpt-image-2',
      prompt: 'A quiet product scene',
      count: 1,
      size: '1024x1024',
      quality: 'high',
      sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
      referenceImages: [{ url: 'https://img.test/reference.png' }],
    });
    expect(params.primaryAppliedSettings).toMatchObject({
      count: 1,
      coerced: true,
      kind: 'gpt-image',
    });
    expect(params.primaryAppliedSettings.notes.join(';')).toContain('count');
    expect(params.safeContext).toMatchObject({
      count: 1,
      size: 'auto',
      quality: 'medium',
    });
    expect(params.safeAppliedSettings).toMatchObject({
      count: 1,
      size: 'auto',
      quality: 'medium',
      coerced: true,
      kind: 'gpt-image',
    });
    expect(params.safeAppliedSettings.notes.join(';')).toContain('fallback');
  });

  it('prefers explicit model credentials over metadata credentials', () => {
    const credentials = resolveImageCallCredentials({
      ...baseRequest,
      modelConfig: {
        ...baseRequest.modelConfig,
        baseUrl: 'https://explicit.example.com/v1',
        apiKey: 'explicit-key',
        metadata: {
          baseUrl: 'https://metadata.example.com/v1',
          apiKey: 'metadata-key',
        },
      },
    });

    expect(credentials).toEqual({
      baseUrl: 'https://explicit.example.com/v1',
      apiKey: 'explicit-key',
    });
  });

  it('recognizes typed upstream params errors and adapter 4xx messages only', () => {
    expect(isUpstreamImageParamsError(new UpstreamParamsInvalidError('bad params')))
      .toBe(true);
    expect(isUpstreamImageParamsError(new Error('Image API 422: invalid size')))
      .toBe(true);
    expect(isUpstreamImageParamsError(new Error('Image API 500: unavailable')))
      .toBe(false);
    expect(isUpstreamImageParamsError(null)).toBe(false);
  });

  it('builds the stable unsupported-params BadRequest payload', () => {
    const exception = buildUnsupportedImageParamsException(
      baseRequest,
      'gpt-image',
      new Error('first invalid'),
      'retry invalid',
    );

    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      errorCode: 'ERR_IMAGE_PARAMS_NOT_SUPPORTED',
      message: expect.stringContaining('当前模型不支持所选参数'),
      details: {
        kind: 'gpt-image',
        model: 'gpt-image-2',
        firstError: 'first invalid',
        retryError: 'retry invalid',
      },
    });
  });
});
