import { isBoostActiveAt } from './boost.helpers';

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
