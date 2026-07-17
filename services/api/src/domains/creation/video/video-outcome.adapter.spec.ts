import type { VideoTaskOutcome } from '@autix/ai-adapters/video';
import { VideoGenStatus } from '../../platform/prisma/generated';
import { toLegacyVideoOutcome } from './video-outcome.adapter';

// 引擎不返回中文 refundReason（i18n 是 api-service 的职责），故边界上要翻译回既有词汇。
// 取值逐字抄自 normalizeSeedanceTaskOutcome（video-generation-flow.helpers.ts:604-634）——
// 漏掉映射 = 超时的生成被当成普通失败退款，用户看到的原因是错的。
describe('toLegacyVideoOutcome', () => {
  it('maps expired to VideoGenStatus.expired with the timeout refund reason', () => {
    const outcome: VideoTaskOutcome = { kind: 'expired', externalStatus: 'expired', error: 'expired' };
    expect(toLegacyVideoOutcome(outcome)).toEqual({
      kind: 'failed',
      externalStatus: 'expired',
      generationStatus: VideoGenStatus.expired,
      error: 'expired',
      refundReason: '视频生成超时',
    });
  });

  it('maps failed to VideoGenStatus.failed with the error-bearing refund reason', () => {
    const outcome: VideoTaskOutcome = { kind: 'failed', externalStatus: 'failed', error: 'boom' };
    expect(toLegacyVideoOutcome(outcome)).toEqual({
      kind: 'failed',
      externalStatus: 'failed',
      generationStatus: VideoGenStatus.failed,
      error: 'boom',
      refundReason: '视频生成失败: boom',
    });
  });

  it('passes succeeded through unchanged', () => {
    const outcome: VideoTaskOutcome = {
      kind: 'succeeded',
      externalStatus: 'succeeded',
      sourceUrl: 'https://x/v.mp4',
      lastFrameUrl: 'https://x/f.jpg',
      durationSec: 5,
    };
    expect(toLegacyVideoOutcome(outcome)).toEqual({
      kind: 'succeeded',
      externalStatus: 'succeeded',
      sourceUrl: 'https://x/v.mp4',
      lastFrameUrl: 'https://x/f.jpg',
      durationSec: 5,
    });
  });

  it('passes active and missing_status through unchanged', () => {
    expect(toLegacyVideoOutcome({ kind: 'active', externalStatus: 'queued' }))
      .toEqual({ kind: 'active', externalStatus: 'queued' });
    expect(toLegacyVideoOutcome({ kind: 'missing_status' })).toEqual({ kind: 'missing_status' });
  });
});
