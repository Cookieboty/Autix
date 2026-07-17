import { describe, it, expect } from 'vitest';
import { toUnifiedVideoParams } from './params';

describe('toUnifiedVideoParams (clip 词汇 → 火山原生)', () => {
  it('passes duration through as the native duration (no rename to seconds)', () => {
    const native = toUnifiedVideoParams({ duration: 5 });
    expect(native.duration).toBe(5);
  });

  it('passes the remaining params through under their native names', () => {
    expect(
      toUnifiedVideoParams({
        duration: 10,
        resolution: '720p',
        ratio: '16:9',
        generateAudio: false,
        seed: -1,
      }),
    ).toEqual({
      duration: 10,
      resolution: '720p',
      ratio: '16:9',
      generate_audio: false,
      seed: -1,
    });
  });

  it('omits keys the clip never set (undefined stays undefined, not null)', () => {
    const native = toUnifiedVideoParams({ duration: 5 });
    expect('resolution' in native).toBe(false);
    expect('generate_audio' in native).toBe(false);
  });

  it('falls back to snake_case generate_audio when the camelCase one is absent', () => {
    // 历史遗留：clip params 同时存在 generateAudio 与 generate_audio 两种写法。
    // 投影是「唯一真相」，`??` 语义必须与 resolveVideoGenerateAudio 一致，
    // 否则只带 generate_audio 的 clip 会静默丢掉音频设置。
    expect(toUnifiedVideoParams({ generate_audio: true }).generate_audio).toBe(true);
    expect(toUnifiedVideoParams({ generate_audio: false }).generate_audio).toBe(false);
  });

  it('prefers the camelCase generateAudio when both are present', () => {
    expect(
      toUnifiedVideoParams({ generateAudio: false, generate_audio: true }).generate_audio,
    ).toBe(false);
  });

  it('omits generate_audio when neither form is set', () => {
    expect('generate_audio' in toUnifiedVideoParams({ duration: 5 })).toBe(false);
  });

  // 回归守卫：输出必须是火山原生名，绝不能再冒出「统一词汇」时代的重命名键。
  it('never emits the old unified-vocab names', () => {
    const native = toUnifiedVideoParams({
      duration: 5,
      resolution: '720p',
      ratio: '16:9',
      generateAudio: true,
      watermark: true,
      returnLastFrame: true,
      seed: 42,
    }) as Record<string, unknown>;
    for (const legacy of ['seconds', 'generateAudio', 'returnLastFrame']) {
      expect(legacy in native).toBe(false);
    }
    expect(native).toEqual({
      duration: 5,
      resolution: '720p',
      ratio: '16:9',
      generate_audio: true,
      watermark: true,
      return_last_frame: true,
      seed: 42,
    });
  });
});
