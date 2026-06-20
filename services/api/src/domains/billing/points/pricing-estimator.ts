import {
  PointGrantType,
  PricingBaseUnit,
  type Prisma,
  type generation_pricing_rules,
} from '../../platform/prisma/generated';

export interface EstimateCostInput {
  taskType: string;
  modelProvider?: string;
  modelName?: string;
  quality?: string;
  resolution?: string;
  modelTier?: string;
  quantity?: number;
  seconds?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  toolCalls?: number;
  batchCount?: number;
  referenceImages?: number;
  hasVideoInput?: boolean;
  hasAudioInput?: boolean;
  priority?: boolean;
  // 可选上下文，传入后会在规则匹配阶段强制校验。
  membershipLevel?: number;
  grantType?: PointGrantType;
}

export type PricingEstimateItem = {
  label: string;
  amount: number;
};

export type PricingEstimate = {
  estimatedCost: number;
  multiplier: number;
  items: PricingEstimateItem[];
};

export function findMatchingPricingRule<Rule extends generation_pricing_rules>(
  candidates: Rule[],
  input: EstimateCostInput,
) {
  return candidates.find((candidate) => pricingRuleMatches(candidate, input));
}

export function pricingRuleMatches(rule: generation_pricing_rules, input: EstimateCostInput) {
  if (rule.modelProvider && rule.modelProvider !== input.modelProvider) return false;
  if (rule.modelName && rule.modelName !== input.modelName) return false;
  if (rule.quality && rule.quality !== input.quality) return false;
  if (rule.resolution && rule.resolution !== input.resolution) return false;
  if (rule.modelTier && rule.modelTier !== input.modelTier) return false;
  if (rule.minDurationSeconds != null && (input.seconds ?? 0) < rule.minDurationSeconds) {
    return false;
  }
  if (rule.maxDurationSeconds != null && (input.seconds ?? 0) > rule.maxDurationSeconds) {
    return false;
  }
  if (input.membershipLevel != null) {
    const allowedLevels = numberArray(rule.allowedMembershipLevels);
    if (allowedLevels.length > 0 && !allowedLevels.includes(input.membershipLevel)) {
      return false;
    }
  }
  if (input.grantType != null) {
    const disallowedGrants = stringArray(rule.disallowedGrantTypes);
    if (disallowedGrants.includes(input.grantType)) return false;
  }
  return true;
}

export function estimatePricingRuleCost(
  rule: generation_pricing_rules,
  input: EstimateCostInput,
): PricingEstimate {
  const items: PricingEstimateItem[] = [];
  let subtotal = 0;

  switch (rule.baseUnit) {
    case PricingBaseUnit.image: {
      const quantity = Math.max(1, input.quantity ?? 1);
      const amount = rule.baseCost * quantity;
      subtotal += amount;
      if (amount > 0) items.push({ label: 'imageQuantity', amount });
      break;
    }
    case PricingBaseUnit.second: {
      const seconds = Math.max(1, input.seconds ?? 1);
      const amount = rule.baseCost * seconds;
      subtotal += amount;
      if (amount > 0) items.push({ label: 'seconds', amount });
      break;
    }
    default: {
      if (rule.baseCost > 0) {
        subtotal += rule.baseCost;
        items.push({ label: 'baseCost', amount: rule.baseCost });
      }
      break;
    }
  }

  if (rule.fixedExtraCost > 0) {
    subtotal += rule.fixedExtraCost;
    items.push({ label: 'fixedExtraCost', amount: rule.fixedExtraCost });
  }

  const inputTokenCost = tokenCost(input.inputTokens, rule.inputTokenCostPerK);
  const outputTokenCost = tokenCost(input.outputTokens, rule.outputTokenCostPerK);
  const contextTokenCost = tokenCost(input.contextTokens, rule.contextTokenCostPerK);
  subtotal += inputTokenCost + outputTokenCost + contextTokenCost;
  if (inputTokenCost > 0) items.push({ label: 'inputTokens', amount: inputTokenCost });
  if (outputTokenCost > 0) items.push({ label: 'outputTokens', amount: outputTokenCost });
  if (contextTokenCost > 0) items.push({ label: 'contextTokens', amount: contextTokenCost });

  if (rule.toolCallCost && input.toolCalls) {
    const amount = rule.toolCallCost * input.toolCalls;
    subtotal += amount;
    items.push({ label: 'toolCalls', amount });
  }
  if (rule.batchUnitCost && input.batchCount) {
    const amount = rule.batchUnitCost * input.batchCount;
    subtotal += amount;
    items.push({ label: 'batchCount', amount });
  }
  if (rule.referenceImageFixedCost && input.referenceImages) {
    const amount = rule.referenceImageFixedCost * input.referenceImages;
    subtotal += amount;
    items.push({ label: 'referenceImages', amount });
  }

  let multiplier = Number(rule.reasoningMultiplier ?? 1) || 1;
  if (rule.referenceImageMultiplier && input.referenceImages) {
    multiplier *= Number(rule.referenceImageMultiplier);
  }
  if (rule.videoInputMultiplier && input.hasVideoInput) {
    multiplier *= Number(rule.videoInputMultiplier);
  }
  if (rule.audioInputMultiplier && input.hasAudioInput) {
    multiplier *= Number(rule.audioInputMultiplier);
  }
  if (rule.priorityMultiplier && input.priority) {
    multiplier *= Number(rule.priorityMultiplier);
  }

  return {
    estimatedCost: Math.ceil(subtotal * multiplier),
    multiplier,
    items,
  };
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === 'number');
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function tokenCost(tokens: number | undefined, costPerK: Prisma.Decimal | null) {
  if (!tokens || !costPerK) return 0;
  return (tokens / 1000) * Number(costPerK);
}
