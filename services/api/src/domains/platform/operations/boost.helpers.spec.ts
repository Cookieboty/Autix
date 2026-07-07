import {
  boostDecayFactor,
  decayedBoostSum,
  isBoostActiveAt,
  type ActiveBoostRow,
} from './boost.helpers';

const window = (over: Partial<{ isActive: boolean; startsAt: Date; endsAt: Date }> = {}) => ({
  isActive: true,
  startsAt: new Date('2026-01-01T00:00:00Z'),
  endsAt: new Date('2026-01-10T00:00:00Z'),
  ...over,
});

describe('isBoostActiveAt (§十一 生效窗口)', () => {
  it('在 [startsAt, endsAt] 区间内 → true', () => {
    expect(isBoostActiveAt(window(), new Date('2026-01-05T00:00:00Z'))).toBe(true);
  });

  it('等于边界 startsAt/endsAt → true（闭区间）', () => {
    const w = window();
    expect(isBoostActiveAt(w, w.startsAt)).toBe(true);
    expect(isBoostActiveAt(w, w.endsAt)).toBe(true);
  });

  it('早于 startsAt → false', () => {
    expect(isBoostActiveAt(window(), new Date('2025-12-31T23:59:59Z'))).toBe(false);
  });

  it('晚于 endsAt → false（过期）', () => {
    expect(isBoostActiveAt(window(), new Date('2026-01-11T00:00:00Z'))).toBe(false);
  });

  it('isActive=false → false（即便在时间窗内，撤销优先）', () => {
    expect(
      isBoostActiveAt(window({ isActive: false }), new Date('2026-01-05T00:00:00Z')),
    ).toBe(false);
  });
});

describe('boostDecayFactor (§十一 加热半衰期衰减)', () => {
  it('age=0 → 衰减系数 1（刚生效，无衰减）', () => {
    expect(boostDecayFactor(0)).toBe(1);
  });

  it('age=halfLife → 衰减系数 0.5（半衰期定义）', () => {
    expect(boostDecayFactor(24, 24)).toBeCloseTo(0.5, 10);
  });

  it('age 为负（防御性）→ 夹到 0，衰减系数仍为 1', () => {
    expect(boostDecayFactor(-5, 24)).toBe(1);
  });
});

describe('decayedBoostSum (P2 boost 时间衰减聚合)', () => {
  const boost = (over: Partial<ActiveBoostRow> = {}): ActiveBoostRow => ({
    resourceType: 'GALLERY_POST',
    resourceId: 'p1',
    boostScore: 100,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: new Date('2026-01-10T00:00:00Z'),
    ...over,
  });

  it('单条加热按自身 age 衰减，而非常量强度', () => {
    const now = new Date('2026-01-02T00:00:00Z'); // age = 24h = 半衰期
    const [sum] = decayedBoostSum([boost()], now);
    expect(sum.boostScore).toBeCloseTo(50, 5); // 100 * 0.5
    expect(sum.expiresAt).toEqual(boost().endsAt);
  });

  it('刚生效（age=0）→ 全强度，不提前衰减', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const [sum] = decayedBoostSum([boost()], now);
    expect(sum.boostScore).toBeCloseTo(100, 5);
  });

  it('同一资源多条生效加热：各自衰减后求和，expiresAt 取最大 endsAt', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const rows = [
      boost({ boostScore: 100, startsAt: new Date('2026-01-01T00:00:00Z'), endsAt: new Date('2026-01-05T00:00:00Z') }),
      boost({ boostScore: 40, startsAt: new Date('2026-01-02T00:00:00Z'), endsAt: new Date('2026-01-20T00:00:00Z') }),
    ];
    const [sum] = decayedBoostSum(rows, now);
    // 第一条 age=24h(半衰期)=衰减到 50；第二条 age=0=全强度 40。
    expect(sum.boostScore).toBeCloseTo(90, 5);
    expect(sum.expiresAt).toEqual(new Date('2026-01-20T00:00:00Z'));
  });

  it('不同资源分别分组，互不影响', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const rows = [
      boost({ resourceId: 'p1', boostScore: 100 }),
      boost({ resourceId: 'p2', boostScore: 30 }),
    ];
    const sums = decayedBoostSum(rows, now);
    expect(sums).toHaveLength(2);
    expect(sums.find((s) => s.resourceId === 'p1')?.boostScore).toBeCloseTo(100, 5);
    expect(sums.find((s) => s.resourceId === 'p2')?.boostScore).toBeCloseTo(30, 5);
  });

  it('空数组 → 空结果', () => {
    expect(decayedBoostSum([], new Date())).toEqual([]);
  });
});
