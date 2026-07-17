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

  it('falls back to the snake_case generate_audio when the camelCase one is absent', () => {
    // 历史遗留：clip params 同时存在 generateAudio 与 generate_audio 两种写法。
    // 投影是「唯一真相」，必须与 resolveVideoGenerateAudio 的 `??` 语义一致，
    // 否则只带 generate_audio 的 clip 会静默丢掉音频设置。
    expect(toUnifiedVideoParams({ generate_audio: true }).generateAudio).toBe(true);
    expect(toUnifiedVideoParams({ generate_audio: false }).generateAudio).toBe(false);
  });

  it('prefers the camelCase generateAudio when both are present', () => {
    expect(
      toUnifiedVideoParams({ generateAudio: false, generate_audio: true }).generateAudio,
    ).toBe(false);
  });

  it('omits generateAudio when neither form is set', () => {
    expect('generateAudio' in toUnifiedVideoParams({ duration: 5 })).toBe(false);
  });
});
