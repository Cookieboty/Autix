import { describe, it, expect } from 'vitest';
import { VIDEO_PROTOCOL_PRESETS, resolveVideoPreset } from './registry';

describe('resolveVideoPreset', () => {
  it('throws on a missing protocolKey instead of guessing', () => {
    expect(() => resolveVideoPreset(undefined)).toThrow(/protocolKey/);
  });

  // 不做静默 fallback：老的 resolveImageAdapter 正是靠它把所有模型悄悄落到同一个
  // 协议，让手写 adapter 变成死代码。认不出就必须炸，让配置错误当场暴露。
  it('throws on an unregistered protocolKey instead of falling back', () => {
    expect(() => resolveVideoPreset('kling-video@v1')).toThrow(
      /No protocol preset registered/,
    );
  });

  it('resolves a registered key', () => {
    const key = Object.keys(VIDEO_PROTOCOL_PRESETS)[0];
    expect(resolveVideoPreset(key).key).toBe(key);
  });
});
