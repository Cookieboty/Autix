import { describe, expect, it } from 'vitest';
import {
  detectVideoModelKind,
  getDefaultVideoResolutionForModel,
  getVideoResolutionOptionsForModel,
  normalizeVideoResolution,
  normalizeVideoResolutionForModel,
  resolveVideoModelCapability,
} from './capabilities';

describe('video model capabilities', () => {
  it('detects Seedance model families from provider/model names', () => {
    expect(detectVideoModelKind({ provider: 'amux', model: 'doubao-seedance-2.0-pro' })).toBe('seedance-2.0');
    expect(detectVideoModelKind({ provider: 'amux', model: 'doubao-seedance-2.0-fast' })).toBe('seedance-2.0-fast');
    expect(detectVideoModelKind({ provider: 'amux', model: 'doubao-seedance-2.0-mini' })).toBe('seedance-2.0-mini');
    expect(detectVideoModelKind({ provider: 'volcengine', model: 'seedance-1.5-pro' })).toBe('seedance-1.5-pro');
    expect(detectVideoModelKind({ provider: 'volcengine', model: 'seedance-1.0-pro-fast' })).toBe('seedance-1.0-pro-fast');
    expect(detectVideoModelKind({ provider: 'custom', model: 'video-model' })).toBe('compatible');
  });

  it('prefers explicit metadata kind over name heuristics', () => {
    expect(
      detectVideoModelKind({
        provider: 'custom',
        model: 'seedance-fast',
        metadata: { videoModelKind: 'seedance-2.0-fast' },
      }),
    ).toBe('seedance-2.0-fast');
  });

  it('exposes model-specific Seedance resolution ranges and defaults', () => {
    expect(getVideoResolutionOptionsForModel({ model: 'doubao-seedance-2.0-pro' }).map((item) => item.value)).toEqual([
      '480p',
      '720p',
      '1080p',
      '4k',
    ]);
    expect(getDefaultVideoResolutionForModel({ model: 'doubao-seedance-2.0-pro' })).toBe('720p');

    expect(getVideoResolutionOptionsForModel({ model: 'doubao-seedance-2.0-fast' }).map((item) => item.value)).toEqual([
      '480p',
      '720p',
    ]);
    expect(getVideoResolutionOptionsForModel({ model: 'doubao-seedance-2.0-mini' }).map((item) => item.value)).toEqual([
      '480p',
      '720p',
    ]);
    expect(getDefaultVideoResolutionForModel({ model: 'seedance-1.0-pro-fast' })).toBe('1080p');
  });

  it('normalizes 4k aliases and clamps unsupported resolutions to model defaults', () => {
    expect(normalizeVideoResolution('4K new')).toBe('4k');
    expect(normalizeVideoResolution('2160p')).toBe('4k');
    expect(normalizeVideoResolution(undefined)).toBe('720p');

    expect(normalizeVideoResolutionForModel('1080p', { model: 'doubao-seedance-2.0-fast' })).toBe('720p');
    expect(normalizeVideoResolutionForModel('4k', { model: 'seedance-1.0-pro' })).toBe('1080p');
    expect(normalizeVideoResolutionForModel('4k', { model: 'doubao-seedance-2.0-pro' })).toBe('4k');
  });

  it('allows metadata to narrow known model capabilities without expanding impossible values', () => {
    expect(
      resolveVideoModelCapability({
        model: 'doubao-seedance-2.0-fast',
        metadata: { supportedResolutions: ['480p', '1080p', '4k'] },
      }).resolutions,
    ).toEqual(['480p']);
    expect(
      resolveVideoModelCapability({
        model: 'compatible-video',
        metadata: { supportedResolutions: ['480p', '4k'], defaultResolution: '4k' },
      }),
    ).toMatchObject({
      resolutions: ['480p', '4k'],
      defaultResolution: '4k',
    });
  });
});

