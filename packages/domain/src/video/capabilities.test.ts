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

  // Seedance 2.0 的档位按上游文档（amux doubao-seedance-2）：基础版 720p/1080p、
  // fast 仅 720p。此前这里断言的是 480p/720p/1080p/4k 与 480p/720p —— 那些多出来的
  // 档位上游并不支持，用户选中即必然失败，属于把 bug 锁进了测试。
  it('exposes model-specific Seedance resolution ranges and defaults', () => {
    expect(getVideoResolutionOptionsForModel({ model: 'doubao-seedance-2.0-pro' }).map((item) => item.value)).toEqual([
      '720p',
      '1080p',
    ]);
    expect(getDefaultVideoResolutionForModel({ model: 'doubao-seedance-2.0-pro' })).toBe('720p');

    expect(getVideoResolutionOptionsForModel({ model: 'doubao-seedance-2.0-fast' }).map((item) => item.value)).toEqual([
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
    // 2.0 基础版已无 4K 档（文档只有 720p/1080p），传 4k 落回该模型的默认档
    // —— 与上一行 1.0-pro 同一语义：不支持就夹到 defaultResolution，不是夹到最高档。
    expect(normalizeVideoResolutionForModel('4k', { model: 'doubao-seedance-2.0-pro' })).toBe('720p');
  });

  it('allows metadata to narrow known model capabilities without expanding impossible values', () => {
    expect(
      resolveVideoModelCapability({
        model: 'doubao-seedance-2.0-fast',
        // fast 只有 720p，metadata 里那些档位一个都不在能力集内 —— 收窄的结果必须仍是
        // 模型自身的能力集，绝不能被 metadata 扩出上游不支持的档位。
        metadata: { supportedResolutions: ['480p', '1080p', '4k'] },
      }).resolutions,
    ).toEqual(['720p']);
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

