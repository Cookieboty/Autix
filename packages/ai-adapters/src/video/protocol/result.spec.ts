import { describe, it, expect, vi } from 'vitest';
import { readPath, normalizeVideoOutcome } from './result';
import type { ResultSpec } from './types';

const spec: ResultSpec = {
  statusPath: 'status',
  statusMap: {
    queued: 'active',
    running: 'active',
    succeeded: 'succeeded',
    failed: 'failed',
    expired: 'expired',
  },
  videoUrlPath: ['video_url', 'content.video_url'],
  lastFrameUrlPath: ['last_frame_url', 'content.last_frame_url'],
  durationPath: 'duration',
  errorMessagePath: 'error.message',
};

describe('readPath — 候选链', () => {
  it('takes the first candidate that hits', () => {
    expect(readPath({ video_url: 'a', content: { video_url: 'b' } }, ['video_url', 'content.video_url'])).toBe('a');
  });

  // 真实约束：既有 getStringField 读 video_url 时先顶层、未命中再 content.video_url。
  it('falls back to the later candidate', () => {
    expect(readPath({ content: { video_url: 'b' } }, ['video_url', 'content.video_url'])).toBe('b');
  });

  it('returns undefined when no candidate hits', () => {
    expect(readPath({}, ['video_url', 'content.video_url'])).toBeUndefined();
  });

  it('accepts a single path string', () => {
    expect(readPath({ a: { b: 1 } }, 'a.b')).toBe(1);
  });
});

describe('normalizeVideoOutcome', () => {
  it('reports missing_status when the status is absent', () => {
    expect(normalizeVideoOutcome(spec, {})).toEqual({ kind: 'missing_status' });
  });

  it('maps a terminal success and reads the media via the candidate chain', () => {
    expect(
      normalizeVideoOutcome(spec, {
        status: 'succeeded',
        content: { video_url: 'https://x/v.mp4', last_frame_url: 'https://x/f.jpg' },
        duration: 5,
      }),
    ).toEqual({
      kind: 'succeeded',
      externalStatus: 'succeeded',
      sourceUrl: 'https://x/v.mp4',
      lastFrameUrl: 'https://x/f.jpg',
      durationSec: 5,
    });
  });

  it('distinguishes expired from failed (they refund with different reasons)', () => {
    expect(normalizeVideoOutcome(spec, { status: 'expired' }).kind).toBe('expired');
    expect(normalizeVideoOutcome(spec, { status: 'failed', error: { message: 'boom' } })).toEqual({
      kind: 'failed',
      externalStatus: 'failed',
      error: 'boom',
    });
  });

  it('falls back to the status text when no error message is present', () => {
    expect(normalizeVideoOutcome(spec, { status: 'failed' }).kind).toBe('failed');
    expect((normalizeVideoOutcome(spec, { status: 'failed' }) as { error: string }).error).toBe('failed');
  });

  it('treats queued / running as active', () => {
    expect(normalizeVideoOutcome(spec, { status: 'queued' }).kind).toBe('active');
    expect(normalizeVideoOutcome(spec, { status: 'running' }).kind).toBe('active');
  });

  // 未知状态归 active + 告警：判 failed 会误退款一个可能正在成功的生成；
  // 判 active 最坏是多轮询几轮，而无限轮询已被 terminal-convergence 的超时兜住。
  // 这与既有 normalizeSeedanceTaskOutcome:642 的行为一致 —— 保持行为等价。
  it('treats an unknown status as active and warns instead of failing the task', () => {
    const onWarn = vi.fn();
    expect(normalizeVideoOutcome(spec, { status: 'throttled' }, onWarn)).toEqual({
      kind: 'active',
      externalStatus: 'throttled',
    });
    expect(onWarn).toHaveBeenCalledOnce();
    expect(onWarn.mock.calls[0][0]).toContain('throttled');
  });
});
