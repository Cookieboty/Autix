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

  // 硬编码 key：从 Object.keys()[0] 取会让等式天然成立，「永远返回第一个 preset」
  // 这种误路由测不出来。取首个之外的 key 才能区分。
  it.each(['ark-video@v3', 'poyo-veo@v1', 'poyo-happyhorse-11@v1'])(
    'resolves %s to its own preset',
    (key) => {
      expect(resolveVideoPreset(key).key).toBe(key);
    },
  );

  it('registry is keyed by each preset own key', () => {
    for (const [key, preset] of Object.entries(VIDEO_PROTOCOL_PRESETS)) {
      expect(preset.key).toBe(key);
    }
  });
});
