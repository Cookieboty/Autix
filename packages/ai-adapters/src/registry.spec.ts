import { describe, it, expect } from 'vitest';
import { tryResolveAnyPreset, resolveAnyPreset } from './registry';
import { PROTOCOL_PRESETS } from './image/protocol/registry';
import { VIDEO_PROTOCOL_PRESETS } from './video/protocol/registry';

describe('tryResolveAnyPreset (保存期)', () => {
  it('resolves an image key with media: image', () => {
    const entry = tryResolveAnyPreset('openai-images@v1');
    expect(entry?.media).toBe('image');
    expect(entry?.preset.key).toBe('openai-images@v1');
  });

  it('resolves a video key with media: video', () => {
    const entry = tryResolveAnyPreset('ark-video@v3');
    expect(entry?.media).toBe('video');
    expect(entry?.preset.key).toBe('ark-video@v3');
  });

  // 保存期**不能**抛：普通 Error 会绕过 assertProtocolConfigIsClosed 的 violation 流程，
  // 把一个本该是 400「未知协议」的用户配置错误变成 500。
  it('returns undefined for an unknown key instead of throwing', () => {
    expect(tryResolveAnyPreset('kling-video@v1')).toBeUndefined();
  });
});

describe('resolveAnyPreset (运行期)', () => {
  it('throws on an unknown key (fail-loud)', () => {
    expect(() => resolveAnyPreset('kling-video@v1')).toThrow(/unknown protocolKey/i);
  });

  it('resolves a registered key', () => {
    expect(resolveAnyPreset('ark-video@v3').media).toBe('video');
  });
});

describe('protocolKey namespace', () => {
  // 合并 registry 若用对象 spread，同名 key 会**静默覆盖** —— 一个视频 key 撞上图片 key，
  // 模型会被路由到错误媒体的 preset 且无人察觉。这条断言是唯一能挡住它的地方。
  it('has no key collision across media', () => {
    const overlap = Object.keys(PROTOCOL_PRESETS).filter((k) => k in VIDEO_PROTOCOL_PRESETS);
    expect(overlap).toEqual([]);
  });
});
