import { describe, expect, test } from 'bun:test';
import type { ModelConfigItem } from '@autix/shared-store';
import {
  buildImageEstimateInput,
  buildVideoEstimateInput,
  normalizeVideoResolution,
} from '../src/chat/chat-pricing';

const baseModel: ModelConfigItem = {
  id: 'model-1',
  name: 'Seedance Fast',
  model: 'seedance-fast',
  provider: 'bytedance',
  type: 'video',
  priority: 0,
  isDefault: false,
  capabilities: ['video'],
  visibility: 'public',
};

describe('chat pricing helpers', () => {
  test('builds image estimate input from image composer options', () => {
    expect(
      buildImageEstimateInput({
        model: baseModel,
        quality: 'hd',
        size: '1024x1024',
        referenceImageCount: 2,
      }),
    ).toEqual({
      taskType: 'image_generation',
      modelProvider: 'bytedance',
      modelName: 'seedance-fast',
      quality: 'hd',
      resolution: '1K',
      quantity: 1,
      referenceImages: 2,
    });
  });

  test('normalizes video resolution to the supported pricing buckets', () => {
    expect(normalizeVideoResolution('1080P')).toBe('1080p');
    expect(normalizeVideoResolution('480p')).toBe('480p');
    expect(normalizeVideoResolution('4k')).toBe('720p');
    expect(normalizeVideoResolution(undefined)).toBe('720p');
  });

  test('builds reference-mode video estimate input', () => {
    expect(
      buildVideoEstimateInput({
        model: baseModel,
        resolutionValue: '720p',
        duration: 0,
        mode: 'reference',
        materials: [
          { id: 'image-1', url: 'https://cdn.example.com/a.png', type: 'image' },
          { id: 'video-1', url: 'https://cdn.example.com/a.mp4', type: 'video' },
          { id: 'audio-1', url: 'https://cdn.example.com/a.mp3', type: 'audio' },
        ],
        frames: [
          { id: 'frame-1', duration: 5, material: { id: 'ignored', url: 'x', type: 'image' } },
        ],
      }),
    ).toMatchObject({
      taskType: 'video_generation',
      modelProvider: 'bytedance',
      modelName: 'seedance-fast',
      resolution: '720p',
      seconds: 5,
      referenceImages: 1,
      hasVideoInput: true,
      hasAudioInput: true,
    });
  });

  test('builds frame-mode video estimate input from frames', () => {
    expect(
      buildVideoEstimateInput({
        model: { ...baseModel, name: 'Seedance Pro', model: 'seedance-pro' },
        resolutionValue: '1080',
        duration: 8,
        mode: 'first_last_frame',
        materials: [{ id: 'audio-1', url: 'https://cdn.example.com/a.mp3', type: 'audio' }],
        frames: [
          { id: 'frame-1', duration: 5, material: { id: 'image-1', url: 'x', type: 'image' } },
          { id: 'frame-2', duration: 5, material: { id: 'video-1', url: 'y', type: 'video' } },
        ],
      }),
    ).toMatchObject({
      taskType: 'video_generation',
      resolution: '1080p',
      seconds: 8,
      referenceImages: 1,
      hasVideoInput: true,
      hasAudioInput: true,
    });
  });
});
