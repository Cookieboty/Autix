import {
  discountApplies,
  resolveDiscountFactor,
  toDiscountRow,
  type DiscountRow,
} from './pricing-discount.helpers';

function discount(overrides: Partial<DiscountRow> = {}): DiscountRow {
  return {
    id: 'd1',
    code: 'SUMMER',
    factor: 0.9,
    scope: {},
    stackable: false,
    priority: 0,
    effectiveFrom: null,
    effectiveTo: null,
    isActive: true,
    ...overrides,
  };
}

const ctx = { membershipLevel: 2, taskType: 'image_generation', modelConfigId: 'model-1' };
const now = new Date('2026-07-09T00:00:00.000Z');

describe('discountApplies', () => {
  it('returns false when inactive', () => {
    expect(discountApplies(discount({ isActive: false }), ctx, now)).toBe(false);
  });

  it('returns false before effectiveFrom', () => {
    expect(
      discountApplies(discount({ effectiveFrom: new Date('2026-08-01') }), ctx, now),
    ).toBe(false);
  });

  it('returns false at or after effectiveTo', () => {
    expect(
      discountApplies(discount({ effectiveTo: new Date('2026-07-09T00:00:00.000Z') }), ctx, now),
    ).toBe(false);
  });

  it('filters by membershipLevelNumbers (numeric level, not the cuid)', () => {
    expect(
      discountApplies(discount({ scope: { membershipLevelNumbers: [1, 3] } }), ctx, now),
    ).toBe(false);
    expect(
      discountApplies(discount({ scope: { membershipLevelNumbers: [1, 2] } }), ctx, now),
    ).toBe(true);
  });

  it('filters by taskTypes and modelConfigIds', () => {
    expect(
      discountApplies(discount({ scope: { taskTypes: ['video_generation'] } }), ctx, now),
    ).toBe(false);
    expect(
      discountApplies(discount({ scope: { modelConfigIds: ['other-model'] } }), ctx, now),
    ).toBe(false);
  });

  it('an empty scope matches everything', () => {
    expect(discountApplies(discount({ scope: {} }), ctx, now)).toBe(true);
  });

  it('a taskTypes: [] scope matches nothing, while an absent taskTypes matches everything', () => {
    expect(
      discountApplies(discount({ scope: { taskTypes: [] } }), ctx, now),
    ).toBe(false);
    expect(
      discountApplies(discount({ scope: {} }), ctx, now),
    ).toBe(true);
  });

  it('membershipLevel 0 (no membership) does not match a restricted scope', () => {
    const noMembershipCtx = { ...ctx, membershipLevel: 0 };
    expect(
      discountApplies(
        discount({ scope: { membershipLevelNumbers: [1, 2] } }),
        noMembershipCtx,
        now,
      ),
    ).toBe(false);
  });
});

describe('resolveDiscountFactor', () => {
  it('returns factor 1 and code null when nothing matches', () => {
    expect(resolveDiscountFactor([], ctx, now)).toEqual({ factor: 1, code: null });
  });

  it('picks the lowest factor among non-stackable matches', () => {
    const discounts = [
      discount({ id: 'a', code: 'A', factor: 0.9 }),
      discount({ id: 'b', code: 'B', factor: 0.7 }),
      discount({ id: 'c', code: 'C', factor: 0.8 }),
    ];
    expect(resolveDiscountFactor(discounts, ctx, now)).toEqual({ factor: 0.7, code: 'B' });
  });

  it('picks the lowest factor by factor, not by priority, even when priority ordering is flipped', () => {
    const discounts = [
      discount({ id: 'a', code: 'A', factor: 0.8, priority: 10 }),
      discount({ id: 'b', code: 'B', factor: 0.5, priority: 0 }),
    ];
    expect(resolveDiscountFactor(discounts, ctx, now)).toEqual({ factor: 0.5, code: 'B' });

    const flipped = [
      discount({ id: 'a', code: 'A', factor: 0.8, priority: 0 }),
      discount({ id: 'b', code: 'B', factor: 0.5, priority: 10 }),
    ];
    expect(resolveDiscountFactor(flipped, ctx, now)).toEqual({ factor: 0.5, code: 'B' });
  });

  it('stacks stackable discounts multiplicatively on top of the best non-stackable one', () => {
    const discounts = [
      discount({ id: 'a', code: 'A', factor: 0.9, stackable: false }),
      discount({ id: 'b', code: 'B', factor: 0.95, stackable: true }),
    ];
    const result = resolveDiscountFactor(discounts, ctx, now);
    expect(result.factor).toBeCloseTo(0.855);
    expect(result.code).toBe('A+B');
  });

  it('stacks multiple stackable discounts even with no non-stackable match', () => {
    const discounts = [
      discount({ id: 'a', code: 'A', factor: 0.95, stackable: true }),
      discount({ id: 'b', code: 'B', factor: 0.9, stackable: true }),
    ];
    const result = resolveDiscountFactor(discounts, ctx, now);
    expect(result.factor).toBeCloseTo(0.855);
    expect(result.code).toBe('A+B');
  });

  it('excludes discounts that do not apply', () => {
    const discounts = [
      discount({ id: 'a', code: 'A', factor: 0.5, scope: { taskTypes: ['video_generation'] } }),
    ];
    expect(resolveDiscountFactor(discounts, ctx, now)).toEqual({ factor: 1, code: null });
  });
});

describe('toDiscountRow', () => {
  it('coerces a Prisma-shaped row (Decimal factor, Json scope) into DiscountRow', () => {
    const row = {
      id: 'd1',
      code: 'SUMMER',
      factor: { toString: () => '0.900' } as unknown,
      scope: { membershipLevelNumbers: [1] } as unknown,
      stackable: false,
      priority: 0,
      effectiveFrom: null,
      effectiveTo: null,
      isActive: true,
    };
    expect(toDiscountRow(row)).toEqual({
      id: 'd1',
      code: 'SUMMER',
      factor: 0.9,
      scope: { membershipLevelNumbers: [1] },
      stackable: false,
      priority: 0,
      effectiveFrom: null,
      effectiveTo: null,
      isActive: true,
    });
  });

  it('never returns a NaN factor even if the Decimal-like value is malformed', () => {
    const row = {
      id: 'd1',
      code: 'BAD',
      factor: { toString: () => 'not-a-number' } as unknown,
      scope: {} as unknown,
      stackable: false,
      priority: 0,
      effectiveFrom: null,
      effectiveTo: null,
      isActive: true,
    };
    expect(() => toDiscountRow(row)).toThrow();
  });
});
