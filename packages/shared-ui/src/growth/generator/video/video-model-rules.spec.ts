import { describe, expect, it } from 'vitest';
import type { ParamsSchema } from '@autix/domain/pricing';
import {
  resolveVideoMediaLimits,
  restrictVideoDurations,
  videoImageCountSatisfied,
  videoRatioApplies,
} from './video-model-rules';

const schemaWith = (media: unknown): ParamsSchema =>
  ({ type: 'object', properties: {}, 'x-media': media }) as unknown as ParamsSchema;

describe('resolveVideoMediaLimits', () => {
  it('只声明图片的模型不给视频/音频入口（VEO、Grok、Happy Horse 都是这种）', () => {
    const limits = resolveVideoMediaLimits(schemaWith({ image: { max: 3 } }));
    expect(limits.allowedTypes).toEqual(['image']);
    expect(limits.maxOf).toEqual({ image: 3, video: 0, audio: 0 });
    expect(limits.totalMax).toBe(3);
  });

  it('Seedance 三类全开，并带出各自的时长上限', () => {
    const limits = resolveVideoMediaLimits(
      schemaWith({
        image: { max: 9 },
        video: { max: 3, maxSeconds: 15 },
        audio: { max: 3, maxSeconds: 15 },
      }),
    );
    expect(limits.allowedTypes).toEqual(['image', 'video', 'audio']);
    expect(limits.maxSecondsOf).toEqual({ video: 15, audio: 15 });
    expect(limits.totalMax).toBe(15);
  });

  it('max=0 的类型视为不支持，不能出现在入口里', () => {
    const limits = resolveVideoMediaLimits(schemaWith({ image: { max: 1 }, video: { max: 0 } }));
    expect(limits.allowedTypes).toEqual(['image']);
  });

  it('读不到 x-media（老数据）→ 退到所有模型都成立的最小交集，而不是放开全集', () => {
    const limits = resolveVideoMediaLimits(undefined);
    expect(limits.allowedTypes).toEqual(['image']);
    expect(limits.maxOf.video).toBe(0);
    expect(limits.maxOf.audio).toBe(0);
  });
});

describe('restrictVideoDurations', () => {
  it('VEO lite + 1080p → 仅 8 秒', () => {
    expect(
      restrictVideoDurations('veo3.1-lite-official', [4, 6, 8], { resolution: '1080p', imageCount: 0 }),
    ).toEqual([8]);
  });

  it('VEO lite + 首尾帧(2 图) → 仅 8 秒', () => {
    expect(
      restrictVideoDurations('veo3.1-lite-official', [4, 6, 8], { resolution: '720p', imageCount: 2 }),
    ).toEqual([8]);
  });

  it('VEO lite 无约束条件时不收窄', () => {
    expect(
      restrictVideoDurations('veo3.1-lite-official', [4, 6, 8], { resolution: '720p', imageCount: 1 }),
    ).toEqual([4, 6, 8]);
  });

  it('VEO fast 参考模式(3 图) → 仅 8 秒', () => {
    expect(
      restrictVideoDurations('veo3.1-fast-official', [4, 6, 8], { resolution: '720p', imageCount: 3 }),
    ).toEqual([8]);
  });

  it('交集为空时退回原候选 —— 绝不产出一个空的选择器', () => {
    expect(
      restrictVideoDurations('veo3.1-lite-official', [4, 6], { resolution: '1080p', imageCount: 0 }),
    ).toEqual([4, 6]);
  });

  it('无规则的模型原样返回', () => {
    expect(restrictVideoDurations('wan2.7-video', [5, 10, 15], { imageCount: 2 })).toEqual([5, 10, 15]);
  });
});

describe('videoRatioApplies', () => {
  it('Seedance 给了首帧后比例由图决定，参数不再生效', () => {
    expect(videoRatioApplies('doubao-seedance-2.0', { imageCount: 1 })).toBe(false);
    expect(videoRatioApplies('doubao-seedance-2.0', { imageCount: 0 })).toBe(true);
  });

  it('Grok Imagine 的 aspect_ratio 仅文生视频有效', () => {
    expect(videoRatioApplies('grok-imagine', { imageCount: 1 })).toBe(false);
  });

  it('无规则的模型一律视为生效', () => {
    expect(videoRatioApplies('wan2.7-video', { imageCount: 2 })).toBe(true);
  });
});

describe('videoImageCountSatisfied', () => {
  const exactOne = resolveVideoMediaLimits(schemaWith({ image: { max: 1, exact: 1 } }));

  it('Grok 1.5 要求恰好 1 张：0 张和 2 张都不满足', () => {
    expect(videoImageCountSatisfied(exactOne, 0)).toBe(false);
    expect(videoImageCountSatisfied(exactOne, 1)).toBe(true);
    expect(videoImageCountSatisfied(exactOne, 2)).toBe(false);
  });

  it('普通模型按上限判定，0 张也合法（纯文生视频）', () => {
    const limits = resolveVideoMediaLimits(schemaWith({ image: { max: 3 } }));
    expect(videoImageCountSatisfied(limits, 0)).toBe(true);
    expect(videoImageCountSatisfied(limits, 3)).toBe(true);
    expect(videoImageCountSatisfied(limits, 4)).toBe(false);
  });
});
