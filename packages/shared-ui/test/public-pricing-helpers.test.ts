import { describe, expect, test } from 'bun:test';
import type { MembershipLevel, PointsPackage } from '@autix/shared-store';
import {
  buildPricingPlans,
  enPricingCopy,
  normalizePointsPackages,
  pointsPerDollar,
  zhPricingCopy,
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
    const plans = buildPricingPlans([level()], 'MONTHLY', zhPricingCopy);
    const plan = plans.find((item) => item.id === 'level-pro');

    expect(plans[0]?.isFree).toBe(true);
    expect(plan?.recommended).toBe(true);
    expect(plan?.badge).toBe('推荐');
    expect(plan?.price).toBe('$59.90');
    expect(plan?.originalPrice).toBe('$69.90');
    expect(plan?.features).toContain('商用授权覆盖');
    expect(plan?.comparison.video).toEqual({ kind: 'text', text: '1080p · 10s · 2x' });
    expect(plan?.comparison.queue).toEqual({ kind: 'text', text: '高优先' });
    expect(plan?.comparison.invoice).toEqual({ kind: 'text', text: '可申请' });
  });

  test('uses yearly plan pricing while keeping monthly credit amount visible', () => {
    const plan = buildPricingPlans([level()], 'YEARLY', enPricingCopy)
      .find((item) => item.id === 'level-pro');

    expect(plan?.price).toBe('$599.00');
    expect(plan?.unit).toBe('/ year');
    expect(plan?.points).toBe(31100);
    expect(plan?.features).toContain('Commercial usage rights');
    expect(plan?.yearlyDiscountLabel).toBe('20% OFF');
  });

  test('falls back to configured demo plans when the server has no levels', () => {
    const plans = buildPricingPlans([], 'MONTHLY', enPricingCopy);

    expect(plans).toHaveLength(3);
    expect(plans[0]?.isFree).toBe(true);
    expect(plans[1]?.recommended).toBe(true);
    expect(plans[1]?.features).toContain('Image and video credit pool');
  });

  test('adds free tier when server levels only include paid plans', () => {
    const plans = buildPricingPlans([level()], 'MONTHLY', enPricingCopy);

    expect(plans[0]?.id).toBe('free');
    expect(plans[0]?.name).toBe('Free');
    expect(plans[0]?.planId).toBeNull();
    expect(plans[0]?.comparison.video).toEqual({ kind: 'dash', text: 'Not enabled' });
  });

  test('marks fallback paid tiers with yearly discount labels', () => {
    const plans = buildPricingPlans([], 'YEARLY', enPricingCopy);

    expect(plans[0]?.yearlyDiscountLabel).toBeNull();
    expect(plans[1]?.yearlyDiscountLabel).toBe('20% OFF');
    expect(plans[2]?.yearlyDiscountLabel).toBe('20% OFF');
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
});
