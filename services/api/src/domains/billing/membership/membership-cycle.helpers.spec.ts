import {
  addMonths,
  carryoverCycleSourceId,
  getCarryoverPolicy,
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
    expect(getCarryoverPolicy(null, 3)).toBeNull();
    expect(
      getCarryoverPolicy(
        { pointsCarryover: { enabled: true, maxCycles: 2, maxPoints: 1000 } },
        2,
      ),
    ).toBeNull();
    expect(
      getCarryoverPolicy(
        { pointsCarryover: { enabled: true, maxCycles: 99, maxPoints: 20000 } },
        3,
      ),
    ).toEqual({ enabled: true, maxCycles: 12, maxPoints: 20000 });
  });

  it('selects only non-carryover grants from the same membership and caps amount', () => {
    const selection = selectCarryoverGrants(
      [
        {
          id: 'grant-1',
          availableAmount: 12000,
          metadata: { membershipId: 'membership-1' },
        },
        {
          id: 'grant-2',
          availableAmount: 5000,
          metadata: { membershipId: 'membership-1', carryover: true },
        },
        {
          id: 'grant-3',
          availableAmount: 10000,
          metadata: { membershipId: 'membership-other' },
        },
      ],
      {
        membershipId: 'membership-1',
        maxPoints: 10000,
        currentCycleAmount: 20000,
      },
    );

    expect(selection.eligibleGrants.map((grant) => grant.id)).toEqual(['grant-1']);
    expect(selection.availableAmount).toBe(12000);
    expect(selection.carryoverAmount).toBe(10000);
  });
});
