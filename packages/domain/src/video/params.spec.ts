import { describe, it, expect } from 'vitest';
import {
  UNIFIED_VIDEO_PARAM_KEYS,
  toUnifiedVideoParams,
} from './params';

describe('toUnifiedVideoParams', () => {
  it('projects duration onto the unified seconds key', () => {
    const unified = toUnifiedVideoParams({ duration: 5 });
    expect(unified.seconds).toBe(5);
    expect((unified as Record<string, unknown>).duration).toBeUndefined();
  });

  it('passes through the remaining unified params unchanged', () => {
    const unified = toUnifiedVideoParams({
      duration: 10,
      resolution: '720p',
      ratio: '16:9',
      generateAudio: false,
      seed: -1,
    });
    expect(unified).toEqual({
      seconds: 10,
      resolution: '720p',
      ratio: '16:9',
      generateAudio: false,
      seed: -1,
    });
  });

  it('omits keys the clip never set (undefined stays undefined, not null)', () => {
    const unified = toUnifiedVideoParams({ duration: 5 });
    expect('resolution' in unified).toBe(false);
    expect('generateAudio' in unified).toBe(false);
  });

  // 防分叉：常量数组是校验器的运行时白名单来源，绝不能与实际产出的键集漂移。
  it('never produces a key outside UNIFIED_VIDEO_PARAM_KEYS', () => {
    const unified = toUnifiedVideoParams({
      duration: 5,
      resolution: '720p',
      ratio: '16:9',
      generateAudio: true,
      watermark: true,
      returnLastFrame: true,
      seed: 42,
    });
    for (const key of Object.keys(unified)) {
      expect(UNIFIED_VIDEO_PARAM_KEYS).toContain(key);
    }
  });
});
