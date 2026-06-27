import { describe, expect, test } from 'bun:test';
import {
  buildPublicVideoEstimateInput,
  findVideoModelByHint,
  resolveVideoCapabilityFromModelConfig,
  resolveVideoCapabilityFromModelParam,
} from '../src/growth/generator-video-presenters';
import type { ModelConfigItem } from '@autix/shared-store';

describe('resolveVideoCapabilityFromModelParam', () => {
  test('defaults to a seedance capability with resolutions', () => {
    const cap = resolveVideoCapabilityFromModelParam(null);
    expect(cap.kind).toBe('seedance-2.0');
    expect(cap.displayName).toBe('Seedance 2.0');
    expect(cap.resolutions.length).toBeGreaterThan(0);
    expect(cap.resolutions).toContain(cap.defaultResolution);
    expect(cap.resolutions).toContain('4k');
  });

  test('a fast variant exposes the narrower resolution set', () => {
    const cap = resolveVideoCapabilityFromModelParam('seedance-2.0-fast');
    expect(cap.resolutions).not.toContain('4k');
  });
});

describe('resolveVideoCapabilityFromModelConfig', () => {
  test('uses model config metadata for dynamic video capability', () => {
    const model = {
      id: 'seedance-fast-id',
      name: 'Seedance Fast',
      model: 'doubao-seedance-2.0-fast',
      provider: 'bytedance',
      type: 'video',
      priority: 1,
      isDefault: false,
      capabilities: ['video'],
      visibility: 'public',
      metadata: {
        videoModelKind: 'seedance-2.0-fast',
      },
    } satisfies ModelConfigItem;

    const cap = resolveVideoCapabilityFromModelConfig(model);

    expect(cap.displayName).toBe('Seedance 2.0 Fast');
    expect(cap.resolutions).toEqual(['480p', '720p']);
  });
});

describe('findVideoModelByHint', () => {
  test('matches by id, name, model, or provider/model text', () => {
    const models = [
      {
        id: 'model-a',
        name: 'Seedance Fast',
        model: 'doubao-seedance-2.0-fast',
        provider: 'bytedance',
        type: 'video',
        priority: 1,
        isDefault: false,
        capabilities: ['video'],
        visibility: 'public',
      },
    ] satisfies ModelConfigItem[];

    expect(findVideoModelByHint(models, 'seedance fast')?.id).toBe('model-a');
    expect(findVideoModelByHint(models, 'bytedance seedance')?.id).toBe('model-a');
  });
});

describe('buildPublicVideoEstimateInput', () => {
  test('builds video pricing input for the public generator CTA', () => {
    expect(
      buildPublicVideoEstimateInput({
        model: 'seedance-2.0',
        duration: 5,
        resolution: '1080p',
        generateAudio: true,
      }),
    ).toEqual({
      taskType: 'video_generation',
      modelName: 'seedance-2.0',
      resolution: '1080p',
      seconds: 5,
      referenceImages: 0,
      hasVideoInput: false,
      hasAudioInput: true,
    });
  });

  test('normalizes unsupported resolution and invalid duration', () => {
    expect(
      buildPublicVideoEstimateInput({
        model: 'seedance-2.0-fast',
        duration: 0,
        resolution: '4k',
        generateAudio: false,
      }),
    ).toMatchObject({
      modelName: 'seedance-2.0-fast',
      resolution: '720p',
      seconds: 1,
      hasAudioInput: false,
    });
  });

  test('prefers selected public model config for pricing rules', () => {
    const modelConfig = {
      id: 'seedance-lite-id',
      name: 'Seedance Lite',
      model: 'doubao-seedance-2.0-fast',
      provider: 'bytedance',
      type: 'video',
      priority: 1,
      isDefault: false,
      capabilities: ['video'],
      visibility: 'public',
      metadata: {
        videoModelKind: 'seedance-2.0-fast',
      },
    } satisfies ModelConfigItem;

    expect(
      buildPublicVideoEstimateInput({
        model: modelConfig.id,
        modelConfig,
        duration: 4,
        resolution: '4k',
        generateAudio: true,
      }),
    ).toMatchObject({
      modelProvider: 'bytedance',
      modelName: 'doubao-seedance-2.0-fast',
      resolution: '720p',
      seconds: 4,
      hasAudioInput: true,
    });
  });
});
