import { describe, it, expect } from 'vitest';
import { DEFAULT_FEATURES, serializeFeatures, toFeatureConfig } from './levels-view.features';

describe('levels-view features image.concurrency', () => {
  it('round-trips image.concurrency through serialize → deserialize', () => {
    const config = { ...DEFAULT_FEATURES, image: { concurrency: 4 } };
    const restored = toFeatureConfig(serializeFeatures(config));
    expect(restored.image.concurrency).toBe(4);
  });

  it('defaults image.concurrency to 1 for legacy features without an image key', () => {
    const restored = toFeatureConfig({ seedance: { enabled: false } });
    expect(restored.image.concurrency).toBe(1);
  });

  it('DEFAULT_FEATURES.image.concurrency is 1', () => {
    expect(DEFAULT_FEATURES.image.concurrency).toBe(1);
  });
});

describe('levels-view features deep-merge & carryover', () => {
  it('round-trips carryover and preserves unknown keys (top-level + nested)', () => {
    const dbJson = {
      basePointsPerMonth: 30000,
      bonusPointsPerMonth: 1100,
      image: { enabled: true, maxPixels: 4194304, allowedQualities: ['hd'], concurrency: 10 },
      seedance: { enabled: true, maxResolution: '1080p', maxDurationSeconds: 10, concurrency: 2, unknownSub: 'keep' },
      pointsCarryover: { enabled: true, maxCycles: 3, maxPoints: 5000 },
    };
    const out = serializeFeatures(toFeatureConfig(dbJson), dbJson) as Record<string, any>;
    expect(out.basePointsPerMonth).toBe(30000);
    expect(out.bonusPointsPerMonth).toBe(1100);
    expect(out.image.maxPixels).toBe(4194304);
    expect(out.image.allowedQualities).toEqual(['hd']);
    expect(out.image.enabled).toBe(true);
    expect(out.image.concurrency).toBe(10);
    expect(out.seedance.unknownSub).toBe('keep');
    expect(out.pointsCarryover).toEqual({ enabled: true, maxCycles: 3, maxPoints: 5000 });
  });

  it('explicitly clears a toggled-off flag (no leak from original)', () => {
    const out = serializeFeatures({ ...DEFAULT_FEATURES }, { recommended: true }) as Record<string, any>;
    expect(out.recommended).toBe(false);
  });

  it('normalizes legacy invalid carryover values (strict enabled, clamped numbers)', () => {
    expect(
      toFeatureConfig({ pointsCarryover: { enabled: 'false', maxCycles: 13, maxPoints: 1.5 } }).pointsCarryover,
    ).toEqual({ enabled: false, maxCycles: 12, maxPoints: 1 });
    // 启用态：非法 maxPoints 兜底为 >=1，保证归一化结果本身可通过后端校验（不阻塞无关编辑）
    expect(
      toFeatureConfig({ pointsCarryover: { enabled: true, maxCycles: 0, maxPoints: -5 } }).pointsCarryover,
    ).toEqual({ enabled: true, maxCycles: 1, maxPoints: 1 });
    // 关闭态：maxPoints 保留 0，不强制抬升
    expect(
      toFeatureConfig({ pointsCarryover: { enabled: false, maxCycles: 2, maxPoints: 0 } }).pointsCarryover,
    ).toEqual({ enabled: false, maxCycles: 2, maxPoints: 0 });
    expect(
      toFeatureConfig({ pointsCarryover: { enabled: 'true', maxCycles: '3', maxPoints: '500' } }).pointsCarryover,
    ).toEqual({ enabled: false, maxCycles: 1, maxPoints: 0 });
  });

  it('normalizes array-valued nested originals instead of spreading indices', () => {
    const out = serializeFeatures({ ...DEFAULT_FEATURES }, { image: [] as unknown }) as Record<string, any>;
    expect(out.image).toEqual({ concurrency: DEFAULT_FEATURES.image.concurrency });
    expect(out.image['0']).toBeUndefined();
  });
});
