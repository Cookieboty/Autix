import { describe, expect, test } from 'bun:test';
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

  test('falls back to configured demo plans when the server has no levels', () => {
    const plans = buildPricingPlans([], 'MONTHLY');

    expect(plans).toHaveLength(3);
    expect(plans[0]?.isFree).toBe(true);
    expect(plans[1]?.recommended).toBe(true);
    expect(plans[1]?.featureItems.some((f) => f.kind === 'watermark')).toBe(true);
  });

  test('adds free tier when server levels only include paid plans', () => {
    const plans = buildPricingPlans([level()], 'MONTHLY');

    expect(plans[0]?.id).toBe('free');
    expect(plans[0]?.serverName).toBe('Free');
    expect(plans[0]?.planId).toBeNull();
    expect(plans[0]?.comparison.videoSpec).toBeNull();
  });

  test('marks fallback paid tiers with yearly discount', () => {
    const plans = buildPricingPlans([], 'YEARLY');

    expect(plans[0]?.hasYearlyDiscount).toBe(false);
    expect(plans[1]?.hasYearlyDiscount).toBe(true);
    expect(plans[2]?.hasYearlyDiscount).toBe(true);
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
      ...buildPricingPlans([], 'MONTHLY'),
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
});
