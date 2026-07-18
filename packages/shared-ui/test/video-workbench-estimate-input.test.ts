import {
  buildVideoBatchEstimateInput,
  buildVideoEstimateInput,
} from '../src/video/workbench/constants';
import type { ModelConfigItem, VideoClip } from '@autix/shared-store';

describe('buildVideoEstimateInput', () => {
  test('wraps resolution/duration/referenceImages/hasVideoInput/hasAudioInput into params, modelConfigId at top level', () => {
    const clip = {
      params: { resolution: '720p', duration: 5, modelConfigId: 'model-1' },
      materials: [
        { role: 'reference_image' },
        { role: 'reference_video' },
      ],
    } as unknown as VideoClip;
    const videoModel = { id: 'model-1', provider: 'seedance', model: 'seedance-2' } as unknown as ModelConfigItem;

    const input = buildVideoEstimateInput(clip, videoModel);

    expect(input).toEqual({
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      params: {
        resolution: '720p',
        duration: 5,
        referenceImages: 1,
        hasVideoInput: true,
        hasAudioInput: false,
      },
    });
  });

  test('never puts a token key (inputTokens/outputTokens) in params, and never sets a usage field', () => {
    const clip = {
      params: { resolution: '1080p', duration: 8, modelConfigId: 'model-2' },
      materials: [],
    } as unknown as VideoClip;

    const input = buildVideoEstimateInput(clip, null);

    expect(Object.keys(input.params)).not.toContain('inputTokens');
    expect(Object.keys(input.params)).not.toContain('outputTokens');
    expect(input).not.toHaveProperty('usage');
  });

  test('falls back to the videoModel id when clip.params has no modelConfigId', () => {
    const clip = {
      params: { resolution: '720p', duration: 5 },
      materials: [],
    } as unknown as VideoClip;
    const videoModel = { id: 'fallback-model', provider: 'seedance', model: 'seedance-2' } as unknown as ModelConfigItem;

    const input = buildVideoEstimateInput(clip, videoModel);

    expect(input.modelConfigId).toBe('fallback-model');
  });
});

describe('buildVideoBatchEstimateInput', () => {
  test('accumulates duration/referenceImages inside params across clips, keeps taskType/modelConfigId at top level', () => {
    const clips = [
      {
        id: 'clip-1',
        params: { resolution: '720p', duration: 5, modelConfigId: 'model-1' },
        materials: [{ role: 'reference_image' }],
      },
      {
        id: 'clip-2',
        params: { resolution: '720p', duration: 4, modelConfigId: 'model-1' },
        materials: [{ role: 'reference_video' }],
      },
    ] as unknown as VideoClip[];
    const videoModels = [
      { id: 'model-1', provider: 'seedance', model: 'seedance-2' },
    ] as unknown as ModelConfigItem[];

    const input = buildVideoBatchEstimateInput(clips, videoModels);

    expect(input).toEqual({
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      params: {
        resolution: '720p',
        duration: 9,
        referenceImages: 1,
        hasVideoInput: true,
        hasAudioInput: false,
      },
    });
  });

  test('returns null for an empty clip list', () => {
    expect(buildVideoBatchEstimateInput([], [])).toBeNull();
  });
});
