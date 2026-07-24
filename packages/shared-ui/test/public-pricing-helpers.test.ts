import type { MembershipLevel, PointsPackage } from '@autix/shared-store';
import {
  buildPricingPlans,
  normalizePointsPackages,
  pointsPerDollar,
} from '../src/growth/public-pricing-helpers';

function level(overrides: Partial<MembershipLevel> = {}): MembershipLevel {
  return {
    id: 'level-pro',
    name: 'Pro',
    level: 2,
    monthlyPrice: '59.90',
    pointsPerMonth: 31100,
    isActive: true,
    sort: 2,
    features: {
      recommended: true,
      basePointsPerMonth: 30000,
      bonusPointsPerMonth: 1100,
      removeWatermark: true,
      commercialLicense: true,
      seedance: { enabled: true, maxResolution: '1080p', maxDurationSeconds: 10, concurrency: 2 },
      queuePriority: 'high',
      batchGeneration: 'enabled',
      historyRetentionDays: 90,
      invoice: 'requestable',
      pointsCarryover: { enabled: true, maxCycles: 1, maxPoints: 31100 },
    },
    plans: [
      {
        id: 'plan-month',
        levelId: 'level-pro',
        billingCycle: 'MONTHLY',
        months: 1,
        autoRenew: true,
        originalPrice: '69.90',
        price: '59.90',
        firstTimePrice: null,
        discountLabel: null,
        firstTimeLabel: null,
        points: 31100,
        isActive: true,
        sort: 1,
      },
      {
        id: 'plan-year',
        levelId: 'level-pro',
        billingCycle: 'YEARLY',
        months: 12,
        autoRenew: true,
        originalPrice: '718.80',
        price: '599.00',
        firstTimePrice: null,
        discountLabel: 'Save',
        firstTimeLabel: null,
        points: 31100,
        isActive: true,
        sort: 2,
      },
    ],
    ...overrides,
  };
}

describe('public pricing helpers', () => {
  test('maps membership features into plan cards and comparison rows', () => {
    const plans = buildPricingPlans([level()], 'MONTHLY');
    const plan = plans.find((item) => item.id === 'level-pro');

    expect(plans[0]?.isFree).toBe(true);
    expect(plan?.recommended).toBe(true);
    expect(plan?.badgeKey).toBe('popular');
    expect(plan?.price).toBe('$59.90');
    expect(plan?.originalPrice).toBe('$69.90');
    // featureItems has commercial
    expect(plan?.featureItems.some((f) => f.kind === 'commercial')).toBe(true);
    expect(plan?.comparison.videoSpec).toBe('1080p · 10s · 2x');
    expect(plan?.comparison.queuePriority).toBe('high');
    expect(plan?.comparison.invoiceStatus).toBe('requestable');
  });

  test('uses yearly plan pricing while keeping monthly credit amount visible', () => {
    const plan = buildPricingPlans([level()], 'YEARLY')
      .find((item) => item.id === 'level-pro');

    expect(plan?.price).toBe('$599.00');
    expect(plan?.billingCycle).toBe('YEARLY');
    expect(plan?.points).toBe(31100);
    expect(plan?.featureItems.some((f) => f.kind === 'commercial')).toBe(true);
    expect(plan?.hasYearlyDiscount).toBe(true);
  });

  test('returns nothing when the server has no levels — never invents prices', () => {
    expect(buildPricingPlans([], 'MONTHLY')).toEqual([]);
    expect(buildPricingPlans(null, 'MONTHLY')).toEqual([]);
    expect(buildPricingPlans(undefined, 'YEARLY')).toEqual([]);
  });

  test('returns no top-up packages when the server has none', () => {
    expect(normalizePointsPackages([])).toEqual([]);
    expect(normalizePointsPackages(null)).toEqual([]);
  });

  test('adds free tier when server levels only include paid plans', () => {
    const plans = buildPricingPlans([level()], 'MONTHLY');

    expect(plans[0]?.id).toBe('free');
    expect(plans[0]?.serverName).toBe('Free');
    expect(plans[0]?.planId).toBeNull();
    expect(plans[0]?.comparison.videoSpec).toBeNull();
  });

  test('filters and sorts active top-up packages', () => {
    const packages: PointsPackage[] = [
      { id: 'b', name: 'B', price: '20', points: 2000, sort: 2, isActive: true },
      { id: 'inactive', name: 'Inactive', price: '1', points: 1, sort: 0, isActive: false },
      { id: 'a', name: 'A', price: '10', points: 1000, sort: 1, isActive: true },
    ];

    expect(normalizePointsPackages(packages).map((pkg) => pkg.id)).toEqual(['a', 'b']);
    expect(pointsPerDollar(packages[0]!)).toBe('100.0');
  });

  test('buildPricingPlans returns no CJK characters or copy strings', () => {
    const allPlans = [
      ...buildPricingPlans([level()], 'MONTHLY'),
      ...buildPricingPlans([level()], 'YEARLY'),
    ];
    const json = JSON.stringify(allPlans);
    // No CJK characters
    expect(json).not.toMatch(/[一-鿿]/);
    // No hardcoded copy strings
    expect(json).not.toContain('Membership purchase');
    expect(json).not.toContain('会员购买');
    expect(json).not.toContain('Choose plan');
    // accent values are CSS vars, not hex
    expect(json).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  test('carryover display mirrors runtime validity and truncation', () => {
    const withCarry = (pc: unknown) =>
      buildPricingPlans([level({ features: { pointsCarryover: pc } as MembershipLevel['features'] })], 'MONTHLY')
        .find((p) => p.id === 'level-pro')?.comparison;

    expect(withCarry({ enabled: true, maxCycles: 99, maxPoints: 500 })?.carryoverCycles).toBe(12);
    expect(withCarry({ enabled: true, maxCycles: 2.9, maxPoints: 500 })?.carryoverCycles).toBe(2);
    expect(withCarry({ enabled: true, maxCycles: 0, maxPoints: 500 })?.carryoverCycles).toBeNull();
    expect(withCarry({ enabled: true, maxCycles: 3, maxPoints: 0 })?.carryoverMaxPoints).toBeNull();
    expect(withCarry({ enabled: false, maxCycles: 3, maxPoints: 500 })?.carryoverCycles).toBeNull();
    // 与运行时对齐：数字字符串运行时不认（不结转）；maxPoints 向下取整
    expect(withCarry({ enabled: true, maxCycles: '3', maxPoints: '500' })?.carryoverCycles).toBeNull();
    expect(withCarry({ enabled: true, maxCycles: 3, maxPoints: 500.7 })?.carryoverMaxPoints).toBe(500);
  });
});
