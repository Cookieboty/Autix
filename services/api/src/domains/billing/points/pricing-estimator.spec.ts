import {
  PointGrantType,
  PricingBaseUnit,
  PricingComponentType,
  Prisma,
  type generation_pricing_rule_components,
} from '../../platform/prisma/generated';
import {
  estimatePricingRuleCost,
  findMatchingPricingRule,
  pricingRuleMatches,
  type PricingRuleWithComponents,
} from './pricing-estimator';

function pricingRule(
  overrides: Partial<PricingRuleWithComponents> = {},
): PricingRuleWithComponents {
  return {
    id: 'rule-1',
    taskType: 'chat',
    name: 'Chat',
    baseUnit: PricingBaseUnit.message,
    priority: 0,
    conditions: null,
    refundPolicy: null,
    metadata: null,
    isActive: true,
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    components: [],
    ...overrides,
  };
}

function component(
  componentType: PricingComponentType,
  values: Partial<generation_pricing_rule_components> = {},
): generation_pricing_rule_components {
  return {
    id: `component-${componentType}`,
    ruleId: 'rule-1',
    componentType,
    unitCost: null,
    multiplier: null,
    config: null,
    sort: 10,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...values,
  };
}

function amountComponent(
  componentType: PricingComponentType,
  unitCost: number,
  sort = 10,
) {
  return component(componentType, {
    unitCost: new Prisma.Decimal(unitCost),
    sort,
  });
}

function multiplierComponent(
  componentType: PricingComponentType,
  multiplier: number,
  sort = 100,
) {
  return component(componentType, {
    multiplier: new Prisma.Decimal(multiplier),
    sort,
  });
}

describe('pricing estimator', () => {
  it('matches a compatible rule and respects condition filters', () => {
    const freeRule = pricingRule({
      id: 'free',
      conditions: {
        membershipLevel: { in: [1] },
        grantType: { notIn: [PointGrantType.GIFT] },
      },
    });
    const vipRule = pricingRule({
      id: 'vip',
      conditions: {
        membershipLevel: { in: [2, 3] },
      },
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

  it('prefers explicit priority and then more specific model rules', () => {
    const genericRule = pricingRule({
      id: 'generic',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
    });
    const modelRule = pricingRule({
      id: 'model',
      conditions: {
        modelKey: { equals: JSON.stringify(['openai', 'gpt-5']) },
      },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const priorityRule = pricingRule({
      id: 'priority',
      priority: 10,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(
      findMatchingPricingRule([genericRule, modelRule], {
        taskType: 'chat',
        modelProvider: 'openai',
        modelName: 'gpt-5',
      })?.id,
    ).toBe('model');
    expect(
      findMatchingPricingRule([modelRule, priorityRule], {
        taskType: 'chat',
        modelProvider: 'openai',
        modelName: 'gpt-5',
      })?.id,
    ).toBe('priority');
  });

  it('matches dynamic JSON conditions', () => {
    const longContextRule = pricingRule({
      id: 'long-context',
      conditions: { contextMode: 'long', seconds: { min: 5, max: 20 } },
    });

    expect(
      pricingRuleMatches(longContextRule, {
        taskType: 'chat',
        contextMode: 'long',
        seconds: 10,
      }),
    ).toBe(true);
    expect(
      pricingRuleMatches(longContextRule, {
        taskType: 'chat',
        contextMode: 'short',
        seconds: 10,
      }),
    ).toBe(false);
  });

  it('matches model groups through derived model keys', () => {
    const groupedModelRule = pricingRule({
      id: 'grouped-model',
      conditions: {
        modelKey: {
          in: [
            JSON.stringify(['openai', 'gpt-4o-mini']),
            JSON.stringify(['anthropic', 'claude-haiku']),
          ],
        },
      },
    });

    expect(
      pricingRuleMatches(groupedModelRule, {
        taskType: 'chat',
        modelProvider: 'anthropic',
        modelName: 'claude-haiku',
      }),
    ).toBe(true);
    expect(
      pricingRuleMatches(groupedModelRule, {
        taskType: 'chat',
        modelProvider: 'openai',
        modelName: 'gpt-5',
      }),
    ).toBe(false);
  });

  it('computes base units, additives, tokens, and stacked multipliers from components', () => {
    const estimate = estimatePricingRuleCost(
      pricingRule({
        baseUnit: PricingBaseUnit.second,
        components: [
          amountComponent(PricingComponentType.per_second, 3, 10),
          amountComponent(PricingComponentType.fixed_extra, 4, 20),
          amountComponent(PricingComponentType.input_token_per_1k, 1.5, 30),
          amountComponent(PricingComponentType.output_token_per_1k, 2, 40),
          amountComponent(PricingComponentType.per_tool_call, 5, 50),
          amountComponent(PricingComponentType.per_reference_image, 7, 60),
          multiplierComponent(PricingComponentType.reasoning_multiplier, 2, 100),
          multiplierComponent(PricingComponentType.reference_image_multiplier, 1.5, 110),
          multiplierComponent(PricingComponentType.priority_multiplier, 2, 120),
        ],
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
      { label: PricingComponentType.per_second, amount: 30 },
      { label: PricingComponentType.fixed_extra, amount: 4 },
      { label: PricingComponentType.input_token_per_1k, amount: 1.5 },
      { label: PricingComponentType.output_token_per_1k, amount: 1 },
      { label: PricingComponentType.per_tool_call, amount: 10 },
      { label: PricingComponentType.per_reference_image, amount: 7 },
    ]);
    expect(estimate.multiplier).toBe(6);
    expect(estimate.estimatedCost).toBe(321);
  });

  it('keeps image quantity as the primary base item', () => {
    const estimate = estimatePricingRuleCost(
      pricingRule({
        baseUnit: PricingBaseUnit.image,
        components: [
          amountComponent(PricingComponentType.per_image, 10, 10),
          amountComponent(PricingComponentType.fixed_extra, 5, 20),
        ],
      }),
      { taskType: 'image', quantity: 3 },
    );

    expect(estimate).toEqual({
      estimatedCost: 35,
      multiplier: 1,
      items: [
        { label: PricingComponentType.per_image, amount: 30 },
        { label: PricingComponentType.fixed_extra, amount: 5 },
      ],
    });
  });

  it('computes MCP, skill, and priority components', () => {
    const estimate = estimatePricingRuleCost(
      pricingRule({
        components: [
          amountComponent(PricingComponentType.base, 5, 10),
          amountComponent(PricingComponentType.per_mcp_call, 3, 20),
          amountComponent(PricingComponentType.per_skill_call, 4, 30),
          multiplierComponent(PricingComponentType.priority_multiplier, 2, 40),
        ],
      }),
      { taskType: 'chat', mcpCalls: 2, skillCalls: 1, priority: true },
    );

    expect(estimate.items).toEqual([
      { label: PricingComponentType.base, amount: 5 },
      { label: PricingComponentType.per_mcp_call, amount: 6 },
      { label: PricingComponentType.per_skill_call, amount: 4 },
    ]);
    expect(estimate.multiplier).toBe(2);
    expect(estimate.estimatedCost).toBe(30);
  });
});
