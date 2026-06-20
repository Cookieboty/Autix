import {
  PointGrantType,
  PricingBaseUnit,
  Prisma,
  type generation_pricing_rules,
} from '../prisma/generated';
import {
  estimatePricingRuleCost,
  findMatchingPricingRule,
  pricingRuleMatches,
} from './pricing-estimator';

function pricingRule(
  overrides: Partial<generation_pricing_rules> = {},
): generation_pricing_rules {
  return {
    id: 'rule-1',
    taskType: 'chat',
    name: 'Chat',
    modelProvider: null,
    modelName: null,
    quality: null,
    resolution: null,
    modelTier: null,
    baseUnit: PricingBaseUnit.message,
    baseCost: 0,
    inputTokenCostPerK: null,
    outputTokenCostPerK: null,
    contextTokenCostPerK: null,
    reasoningMultiplier: new Prisma.Decimal(1),
    toolCallCost: null,
    batchUnitCost: null,
    minDurationSeconds: null,
    maxDurationSeconds: null,
    referenceImageFixedCost: null,
    referenceImageMultiplier: null,
    videoInputMultiplier: null,
    audioInputMultiplier: null,
    priorityMultiplier: null,
    fixedExtraCost: 0,
    allowedMembershipLevels: [],
    disallowedGrantTypes: [],
    refundPolicy: null,
    metadata: null,
    isActive: true,
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('pricing estimator', () => {
  it('matches the first compatible rule and respects optional context filters', () => {
    const freeRule = pricingRule({
      id: 'free',
      allowedMembershipLevels: [1],
      disallowedGrantTypes: [PointGrantType.GIFT],
    });
    const vipRule = pricingRule({
      id: 'vip',
      allowedMembershipLevels: [2, 3],
      disallowedGrantTypes: [],
    });

    expect(
      pricingRuleMatches(freeRule, {
        taskType: 'chat',
        membershipLevel: 1,
        grantType: PointGrantType.GIFT,
      }),
    ).toBe(false);
    expect(
      findMatchingPricingRule([freeRule, vipRule], {
        taskType: 'chat',
        membershipLevel: 2,
      })?.id,
    ).toBe('vip');
  });

  it('computes base units, additives, tokens, and stacked multipliers', () => {
    const estimate = estimatePricingRuleCost(
      pricingRule({
        baseUnit: PricingBaseUnit.second,
        baseCost: 3,
        fixedExtraCost: 4,
        inputTokenCostPerK: new Prisma.Decimal(1.5),
        outputTokenCostPerK: new Prisma.Decimal(2),
        toolCallCost: 5,
        referenceImageFixedCost: 7,
        reasoningMultiplier: new Prisma.Decimal(2),
        referenceImageMultiplier: new Prisma.Decimal(1.5),
        priorityMultiplier: new Prisma.Decimal(2),
      }),
      {
        taskType: 'chat',
        seconds: 10,
        inputTokens: 1000,
        outputTokens: 500,
        toolCalls: 2,
        referenceImages: 1,
        priority: true,
      },
    );

    expect(estimate.items).toEqual([
      { label: 'seconds', amount: 30 },
      { label: 'fixedExtraCost', amount: 4 },
      { label: 'inputTokens', amount: 1.5 },
      { label: 'outputTokens', amount: 1 },
      { label: 'toolCalls', amount: 10 },
      { label: 'referenceImages', amount: 7 },
    ]);
    expect(estimate.multiplier).toBe(6);
    expect(estimate.estimatedCost).toBe(321);
  });

  it('keeps image quantity as the primary base item without extra base cost', () => {
    const estimate = estimatePricingRuleCost(
      pricingRule({
        baseUnit: PricingBaseUnit.image,
        baseCost: 10,
        fixedExtraCost: 5,
      }),
      { taskType: 'image', quantity: 3 },
    );

    expect(estimate).toEqual({
      estimatedCost: 35,
      multiplier: 1,
      items: [
        { label: 'imageQuantity', amount: 30 },
        { label: 'fixedExtraCost', amount: 5 },
      ],
    });
  });
});
