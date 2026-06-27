import { describe, expect, test } from 'bun:test';
import {
  buildPublicVideoEstimateInput,
  resolveVideoCapabilityFromModelParam,
} from '../src/growth/generator-video-presenters';

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
});
