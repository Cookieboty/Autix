import { describe, expect, it } from 'vitest';
import {
  FALLBACK_ASPECT_RATIO,
  formatImageSizeLabel,
  naturalAspectRatio,
  parseAspectRatio,
  resolveSettingsAspectRatio,
} from '../src/growth/generator/image/image-aspect';

describe('parseAspectRatio', () => {
  it('解析比例串（统一词汇 aspectRatio 的取值形状）', () => {
    expect(parseAspectRatio('1:1')).toBe(1);
    expect(parseAspectRatio('9:16')).toBeCloseTo(9 / 16);
    expect(parseAspectRatio('21:9')).toBeCloseTo(21 / 9);
  });

  it('解析像素串（size-grid 模型的取值形状）', () => {
    expect(parseAspectRatio('1024x1024')).toBe(1);
    expect(parseAspectRatio('1024x1792')).toBeCloseTo(1024 / 1792);
    expect(parseAspectRatio('1024×1536@1K')).toBeCloseTo(1024 / 1536);
  });

  it('解析不出时返回 undefined —— 调用方据此决定兜底，而不是这里悄悄给 1', () => {
    expect(parseAspectRatio(undefined)).toBeUndefined();
    expect(parseAspectRatio('')).toBeUndefined();
    expect(parseAspectRatio('auto')).toBeUndefined();
    expect(parseAspectRatio('0:16')).toBeUndefined();
    expect(parseAspectRatio(1024)).toBeUndefined();
  });
});

describe('resolveSettingsAspectRatio', () => {
  it('多数模型的比例在 aspectRatio 上（Gemini / Seedream 4.5 / GPT Image 2 / Seedream 5 Lite）', () => {
    expect(resolveSettingsAspectRatio({ aspectRatio: '9:16', resolution: '2K' })).toBeCloseTo(9 / 16);
  });

  it('size-grid 模型的比例在 size 上（Seedream 5.0 Pro）', () => {
    expect(resolveSettingsAspectRatio({ size: '1024x1792', quality: 'hd' })).toBeCloseTo(1024 / 1792);
  });

  it('两者都在时 size 优先 —— 像素串比纯比例串更精确', () => {
    expect(resolveSettingsAspectRatio({ size: '1024x1792', aspectRatio: '1:1' })).toBeCloseTo(1024 / 1792);
  });

  it('取不到比例参数时兜底 1:1（不认识的模型 schema 不该把布局搞崩）', () => {
    expect(resolveSettingsAspectRatio({ quality: 'high' })).toBe(FALLBACK_ASPECT_RATIO);
    expect(resolveSettingsAspectRatio({})).toBe(FALLBACK_ASPECT_RATIO);
    expect(resolveSettingsAspectRatio(undefined)).toBe(FALLBACK_ASPECT_RATIO);
  });

  it('size 无法解析时回落到 aspectRatio，而不是直接兜底 1:1', () => {
    expect(resolveSettingsAspectRatio({ size: 'auto', aspectRatio: '16:9' })).toBeCloseTo(16 / 9);
  });
});

describe('formatImageSizeLabel', () => {
  it('size-grid 模型直接给像素串', () => {
    expect(formatImageSizeLabel({ size: '1024x1792' })).toBe('1024x1792');
  });

  it('其余模型给「比例 · 档位」——此前这里只读 size，它们一律显示 "-"', () => {
    expect(formatImageSizeLabel({ aspectRatio: '9:16', resolution: '2K' })).toBe('9:16 · 2K');
  });

  it('没有档位参数（Gemini）时只给比例', () => {
    expect(formatImageSizeLabel({ aspectRatio: '9:16' })).toBe('9:16');
  });

  it('取不到时返回 undefined，占位符由调用方决定', () => {
    expect(formatImageSizeLabel({ quality: 'high' })).toBeUndefined();
    expect(formatImageSizeLabel(undefined)).toBeUndefined();
  });
});

describe('naturalAspectRatio', () => {
  it('以图片自身尺寸为准 —— 厂商返回的尺寸未必等于请求值', () => {
    expect(naturalAspectRatio({ naturalWidth: 1080, naturalHeight: 1920 })).toBeCloseTo(1080 / 1920);
  });

  it('尚未解码/加载失败（natural 尺寸为 0）时返回 undefined，调用方继续用 settings 的比例', () => {
    expect(naturalAspectRatio({ naturalWidth: 0, naturalHeight: 0 })).toBeUndefined();
    expect(naturalAspectRatio({ naturalWidth: 1024, naturalHeight: 0 })).toBeUndefined();
  });
});
