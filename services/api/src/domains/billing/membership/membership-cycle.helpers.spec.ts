import {
  addMonths,
  carryoverCycleSourceId,
  getCarryoverPolicy,
  grantAge,
  monthlyCycleIndexesDue,
  selectCarryoverGrants,
  subscriptionCycleSourceId,
} from './membership-cycle.helpers';

describe('membership cycle helpers', () => {
  it('computes natural month boundaries and skips already expired cycles', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00.000Z'), 1)).toEqual(
      new Date('2026-02-28T00:00:00.000Z'),
    );
    expect(
      monthlyCycleIndexesDue(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2027-01-01T00:00:00.000Z'),
        new Date('2026-02-15T00:00:00.000Z'),
      ),
    ).toEqual([1]);
    expect(
      monthlyCycleIndexesDue(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2027-01-01T00:00:00.000Z'),
        new Date('2026-04-15T00:00:00.000Z'),
      ),
    ).toEqual([3]);
  });

  it('builds stable idempotency source ids for monthly and carryover grants', () => {
    expect(subscriptionCycleSourceId('membership-1', 3)).toBe('membership-cycle:membership-1:3');
    expect(carryoverCycleSourceId('membership-1', 3)).toBe(
      'membership-carryover:membership-1:3',
    );
  });

  it('enforces carryover policy eligibility and clamps max cycles', () => {
    expect(getCarryoverPolicy(null)).toBeNull();
    expect(
      getCarryoverPolicy({ pointsCarryover: { enabled: false, maxCycles: 1, maxPoints: 100 } }),
    ).toBeNull();
    expect(
      getCarryoverPolicy({ pointsCarryover: { enabled: true, maxCycles: 2, maxPoints: 0 } }),
    ).toBeNull();
    expect(
      getCarryoverPolicy({ pointsCarryover: { enabled: true, maxCycles: 99, maxPoints: 20000 } }),
    ).toEqual({ enabled: true, maxCycles: 12, maxPoints: 20000 });
  });

  it('computes grant age with backward-compatible defaults', () => {
    expect(grantAge(null)).toBe(0);
    expect(grantAge({ membershipId: 'm1' })).toBe(0);
    expect(grantAge({ carryover: true })).toBe(1);
    expect(grantAge({ carryover: true, carriedCycles: 3 })).toBe(3);
    expect(grantAge({ carryover: true, carriedCycles: -2 })).toBe(1);
    expect(grantAge({ carryover: true, carriedCycles: 1.5 })).toBe(1);
  });

  it('selects grants under the age limit, caps by maxPoints, computes next age', () => {
    const grants = [
      { id: 'orig', availableAmount: 12000, metadata: { membershipId: 'm1' } },
      { id: 'carry1', availableAmount: 5000, metadata: { membershipId: 'm1', carryover: true, carriedCycles: 1 } },
      { id: 'old', availableAmount: 9000, metadata: { membershipId: 'm1', carryover: true, carriedCycles: 2 } },
      { id: 'other', availableAmount: 7000, metadata: { membershipId: 'm2' } },
    ];
    const result = selectCarryoverGrants(grants, { membershipId: 'm1', maxPoints: 20000, maxCycles: 2 });
    expect(result.eligibleGrants.map((g) => g.id)).toEqual(['orig', 'carry1']);
    expect(result.availableAmount).toBe(17000);
    expect(result.carryoverAmount).toBe(17000);
    expect(result.nextCarriedCycles).toBe(2);
  });

  it('caps carryover amount by maxPoints only (no current-cycle coupling)', () => {
    const grants = [{ id: 'orig', availableAmount: 30000, metadata: { membershipId: 'm1' } }];
    const result = selectCarryoverGrants(grants, { membershipId: 'm1', maxPoints: 10000, maxCycles: 1 });
    expect(result.carryoverAmount).toBe(10000);
    expect(result.nextCarriedCycles).toBe(1);
  });

  it('returns age 0 for empty eligible set (legacy carryover excluded at maxCycles=1)', () => {
    const grants = [{ id: 'legacy', availableAmount: 5000, metadata: { membershipId: 'm1', carryover: true } }];
    const result = selectCarryoverGrants(grants, { membershipId: 'm1', maxPoints: 20000, maxCycles: 1 });
    expect(result.eligibleGrants).toEqual([]);
    expect(result.carryoverAmount).toBe(0);
    expect(result.nextCarriedCycles).toBe(0);
  });
});
