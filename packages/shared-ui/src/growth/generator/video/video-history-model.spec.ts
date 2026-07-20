import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIDEO_RATIO,
  parseRatioLabel,
  videoCover,
  videoDisplayStatus,
  videoSettingsRatio,
} from './video-history-model';
import type { DirectVideoGenerationDto } from '@autix/shared-store';

function makeItem(overrides: Partial<DirectVideoGenerationDto> = {}): DirectVideoGenerationDto {
  return {
    id: 'gen-1',
    status: 'completed',
    prompt: 'a cat surfing',
    model: 'seedance-2-0-fast',
    videoUrl: 'https://cdn.test/v.mp4',
    thumbnailUrl: null,
    lastFrameUrl: null,
    durationSec: 5,
    error: null,
    options: {},
    materials: [],
    createdAt: '2026-07-19T00:00:00.000Z',
    ...overrides,
  } as DirectVideoGenerationDto;
}

describe('videoDisplayStatus', () => {
  it('completed 但没有 videoUrl → 按失败展示（不能给用户一个点不开的成功卡）', () => {
    expect(videoDisplayStatus(makeItem({ status: 'completed', videoUrl: null }))).toBe('failed');
  });

  it('pending/queued/running → processing', () => {
    for (const status of ['pending', 'queued', 'running']) {
      expect(videoDisplayStatus(makeItem({ status }))).toBe('processing');
    }
  });

  it('expired 归入失败（不是 processing——它不会再有进展）', () => {
    expect(videoDisplayStatus(makeItem({ status: 'expired' }))).toBe('failed');
  });
});

describe('videoCover', () => {
  it('thumbnailUrl 优先于 lastFrameUrl', () => {
    expect(
      videoCover(makeItem({ thumbnailUrl: 'https://cdn.test/t.jpg', lastFrameUrl: 'https://cdn.test/l.jpg' })),
    ).toBe('https://cdn.test/t.jpg');
  });

  it('两者皆无时退到输入素材', () => {
    expect(
      videoCover(makeItem({ materials: [{ role: 'first_frame', url: 'https://cdn.test/in.png' }] })),
    ).toBe('https://cdn.test/in.png');
  });

  it('什么都没有 → null（调用方渲染占位，而不是 <img src="null">）', () => {
    expect(videoCover(makeItem())).toBeNull();
  });
});

describe('parseRatioLabel', () => {
  it.each([
    ['16:9', 16 / 9],
    ['9:16', 9 / 16],
    ['1:1', 1],
    ['21:9', 21 / 9],
  ])('%s → %f', (label, expected) => {
    expect(parseRatioLabel(label)).toBeCloseTo(expected, 6);
  });

  it('adaptive / 空 / 非法值 → undefined（交给调用方兜底，不能返回 NaN）', () => {
    for (const bad of ['adaptive', '', 'abc', '16:0', null, undefined, 42]) {
      expect(parseRatioLabel(bad)).toBeUndefined();
    }
  });
});

describe('videoSettingsRatio', () => {
  it('读 options.ratio', () => {
    expect(videoSettingsRatio(makeItem({ options: { ratio: '9:16' } }))).toBeCloseTo(9 / 16, 6);
  });

  it('ratio 缺失或 adaptive → 兜底 16:9（占位块要有确定宽高，不能是 NaN）', () => {
    expect(videoSettingsRatio(makeItem({ options: {} }))).toBe(DEFAULT_VIDEO_RATIO);
    expect(videoSettingsRatio(makeItem({ options: { ratio: 'adaptive' } }))).toBe(DEFAULT_VIDEO_RATIO);
  });
});
