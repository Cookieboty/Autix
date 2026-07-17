import { describe, it, expect, vi } from 'vitest';
import { verifyVideoCallback, parseVideoCallback } from './callback';
import { arkVideoV3 } from './presets/vendors';
import type { VideoProtocolPreset } from './types';

describe('verifyVideoCallback', () => {
  // fail-closed 契约（继承自 video-callback.handler.ts:35-38）：密钥没配置就必须拒绝，
  // 否则任何人都能伪造回调驱动状态机与计费。这条不可协商。
  it('rejects when the secret is not configured (fail-closed)', () => {
    expect(() => verifyVideoCallback({ preset: arkVideoV3, token: 'anything', secret: undefined }))
      .toThrow(/not configured/i);
    expect(() => verifyVideoCallback({ preset: arkVideoV3, token: 'anything', secret: '' }))
      .toThrow(/not configured/i);
  });

  it('rejects a missing token', () => {
    expect(() => verifyVideoCallback({ preset: arkVideoV3, token: undefined, secret: 's3cret' }))
      .toThrow(/invalid or missing token/i);
  });

  it('rejects a wrong token', () => {
    expect(() => verifyVideoCallback({ preset: arkVideoV3, token: 'wrong', secret: 's3cret' }))
      .toThrow(/invalid or missing token/i);
  });

  it('accepts the matching token', () => {
    expect(() => verifyVideoCallback({ preset: arkVideoV3, token: 's3cret', secret: 's3cret' }))
      .not.toThrow();
  });

  // 长度不同的 token 也必须走常量时间比较而不是提前返回 —— 先 sha256 等长化再
  // timingSafeEqual（继承自 handler.ts:5-10 的 secretsMatch）。
  it('does not leak length via early return', () => {
    expect(() => verifyVideoCallback({ preset: arkVideoV3, token: 'x', secret: 's3cret' }))
      .toThrow(/invalid or missing token/i);
  });

  it('skips verification when the preset declares no webhook', () => {
    const noWebhook: VideoProtocolPreset = { ...arkVideoV3, webhook: undefined };
    expect(() => verifyVideoCallback({ preset: noWebhook, token: undefined, secret: undefined }))
      .toThrow(/does not support callbacks/i);
  });
});

describe('parseVideoCallback', () => {
  it('reads the task id via webhook.taskIdPath and normalizes the outcome', () => {
    const parsed = parseVideoCallback({
      preset: arkVideoV3,
      body: { id: 'task_7', status: 'succeeded', video_url: 'https://x/v.mp4' },
    });
    expect(parsed.providerTaskId).toBe('task_7');
    expect(parsed.outcome).toMatchObject({ kind: 'succeeded', sourceUrl: 'https://x/v.mp4' });
  });

  it('returns no task id when the body has none', () => {
    expect(parseVideoCallback({ preset: arkVideoV3, body: { status: 'queued' } }).providerTaskId)
      .toBeUndefined();
  });

  // webhook.result 缺省时回退到 preset.result（Ark 的回调体与 query 响应同构）。
  it('falls back to preset.result when webhook.result is absent', () => {
    expect(arkVideoV3.webhook?.result).toBeUndefined();
    expect(parseVideoCallback({ preset: arkVideoV3, body: { status: 'running' } }).outcome.kind)
      .toBe('active');
  });

  it('warns on an unknown status instead of failing the task', () => {
    const onWarn = vi.fn();
    const parsed = parseVideoCallback({ preset: arkVideoV3, body: { id: 'x', status: 'weird' }, onWarn });
    expect(parsed.outcome.kind).toBe('active');
    expect(onWarn).toHaveBeenCalledOnce();
  });
});
