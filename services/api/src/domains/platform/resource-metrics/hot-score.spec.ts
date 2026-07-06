import {
  computeHotScore,
  decayFactor,
  type HotScoreInput,
} from './hot-score';

const base: HotScoreInput = {
  uvCount: 0,
  pvCount: 0,
  likeCount: 0,
  favoriteCount: 0,
  commentCount: 0,
  shareCount: 0,
  referenceCount: 0,
  citationCount: 0,
  ageHours: 0,
};

describe('hot-score', () => {
  it('两条完全一致的条目，只有 boost 不同 → 加热者更高', () => {
    const plain = computeHotScore({ ...base, likeCount: 10, ageHours: 1 });
    const boosted = computeHotScore({
      ...base,
      likeCount: 10,
      ageHours: 1,
      boostScore: 500,
      boostAgeHours: 0,
    });
    expect(boosted).toBeGreaterThan(plain);
  });

  it('48 小时后（半衰期=48）热度衰减到 50%', () => {
    expect(decayFactor(48, 48)).toBeCloseTo(0.5, 10);
    const fresh = computeHotScore({ ...base, likeCount: 100, ageHours: 0 });
    const aged = computeHotScore({ ...base, likeCount: 100, ageHours: 48 });
    expect(aged).toBeCloseTo(fresh * 0.5, 6);
  });

  it('低 pv + 高 reference 排在 高 pv + 零 reference 之前（UGC 优先）', () => {
    const lowPvHighRef = computeHotScore({
      ...base,
      pvCount: 10,
      referenceCount: 5,
      ageHours: 1,
    });
    const highPvNoRef = computeHotScore({
      ...base,
      pvCount: 100000,
      referenceCount: 0,
      ageHours: 1,
    });
    expect(lowPvHighRef).toBeGreaterThan(highPvNoRef);
  });
});
