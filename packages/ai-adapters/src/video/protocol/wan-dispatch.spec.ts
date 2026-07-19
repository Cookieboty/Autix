import { describe, it, expect } from 'vitest';
import { resolveWanMode } from './wan-dispatch';

describe('resolveWanMode — 按素材角色派发 Wan 子模式', () => {
  it('无素材 → t2v', () => {
    expect(resolveWanMode([])).toMatchObject({
      mode: 't2v', modelId: 'wan2.7-text-to-video', protocolKey: 'poyo-wan-t2v@v1', maxDurationSeconds: 15,
    });
  });

  it('首帧 → i2v', () => {
    expect(resolveWanMode(['first_frame'])).toMatchObject({
      mode: 'i2v', modelId: 'wan2.7-image-to-video', protocolKey: 'poyo-wan-i2v@v1', maxDurationSeconds: 15,
    });
  });

  it('末帧 → i2v', () => {
    expect(resolveWanMode(['last_frame']).mode).toBe('i2v');
  });

  it('参考图 → ref（时长上限 10）', () => {
    expect(resolveWanMode(['reference_image'])).toMatchObject({
      mode: 'ref', modelId: 'wan2.7-reference-to-video', protocolKey: 'poyo-wan-ref@v1', maxDurationSeconds: 10,
    });
  });

  it('参考视频 → ref', () => {
    expect(resolveWanMode(['reference_video']).mode).toBe('ref');
  });

  // 优先级：帧 > 参考。同时给了首帧和参考图，应走 i2v（帧是主意图）。
  it('首帧 + 参考图同时存在 → i2v（帧优先）', () => {
    expect(resolveWanMode(['reference_image', 'first_frame']).mode).toBe('i2v');
  });

  // 未知/无关角色（如 reference_audio）不改变纯文本判定。
  it('仅 reference_audio → 仍 t2v', () => {
    expect(resolveWanMode(['reference_audio']).mode).toBe('t2v');
  });
});
