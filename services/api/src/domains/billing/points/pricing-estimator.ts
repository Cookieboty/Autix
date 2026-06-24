import {
  PointGrantType,
  PricingBaseUnit,
  PricingComponentType,
  type generation_pricing_rule_components,
} from '../../platform/prisma/generated';

export type PricingRuleForEstimate = {
  id: string;
  taskType: string;
  name: string;
  baseUnit: PricingBaseUnit | string;
  priority?: number | null;
  conditions?: unknown;
  refundPolicy?: unknown;
  metadata?: unknown;
  isActive?: boolean;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
};

export type PricingRuleWithComponents = PricingRuleForEstimate & {
  components?: generation_pricing_rule_components[];
};

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
  mcpCalls?: number;
  skillCalls?: number;
  batchCount?: number;
  referenceImages?: number;
  hasVideoInput?: boolean;
  hasAudioInput?: boolean;
  priority?: boolean;
  contextMode?: string;
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

export function findMatchingPricingRule<Rule extends PricingRuleForEstimate>(
  candidates: Rule[],
  input: EstimateCostInput,
) {
  return candidates
    .filter((candidate) => pricingRuleMatches(candidate, input))
    .sort((left, right) => comparePricingRules(left, right))[0];
}

export function pricingRuleMatches(rule: PricingRuleForEstimate, input: EstimateCostInput) {
  if (rule.taskType !== input.taskType) return false;
  if (!conditionsMatch(rule.conditions, input)) return false;
  return true;
}

export function estimatePricingRuleCost(
  rule: PricingRuleWithComponents,
  input: EstimateCostInput,
): PricingEstimate {
  return estimateComponentPricingRuleCost(rule, input);
}

function comparePricingRules(left: PricingRuleForEstimate, right: PricingRuleForEstimate) {
  const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
  if (priorityDelta !== 0) return priorityDelta;

  const specificityDelta = pricingRuleSpecificity(right) - pricingRuleSpecificity(left);
  if (specificityDelta !== 0) return specificityDelta;

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function pricingRuleSpecificity(rule: PricingRuleForEstimate) {
  return conditionSpecificity(recordOrEmpty(rule.conditions));
}

function estimateComponentPricingRuleCost(
  rule: PricingRuleWithComponents,
  input: EstimateCostInput,
): PricingEstimate {
  const components = (rule.components ?? [])
    .filter((component) => component.isActive !== false)
    .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0));

  const items: PricingEstimateItem[] = [];
  let subtotal = 0;
  let multiplier = 1;

  for (const component of components) {
    const result = evaluatePricingComponent(component, input);
    if (!result) continue;
    if (result.kind === 'multiplier') {
      multiplier *= result.multiplier;
      continue;
    }
    subtotal += result.amount;
    if (result.amount > 0) {
      items.push({ label: component.componentType, amount: result.amount });
    }
  }

  return {
    estimatedCost: Math.ceil(subtotal * multiplier),
    multiplier,
    items,
  };
}

function evaluatePricingComponent(
  component: generation_pricing_rule_components,
  input: EstimateCostInput,
): { kind: 'amount'; amount: number } | { kind: 'multiplier'; multiplier: number } | null {
  const unitCost = Number(component.unitCost ?? 0);
  const multiplier = Number(component.multiplier ?? component.unitCost ?? 1) || 1;

  switch (component.componentType) {
    case PricingComponentType.base:
    case PricingComponentType.fixed_extra:
      return { kind: 'amount', amount: unitCost };
    case PricingComponentType.per_image:
      return { kind: 'amount', amount: unitCost * Math.max(1, input.quantity ?? 1) };
    case PricingComponentType.per_second:
      return { kind: 'amount', amount: unitCost * Math.max(1, input.seconds ?? 1) };
    case PricingComponentType.input_token_per_1k:
      return { kind: 'amount', amount: tokenCost(input.inputTokens, component.unitCost) };
    case PricingComponentType.output_token_per_1k:
      return { kind: 'amount', amount: tokenCost(input.outputTokens, component.unitCost) };
    case PricingComponentType.context_token_per_1k:
      return { kind: 'amount', amount: tokenCost(input.contextTokens, component.unitCost) };
    case PricingComponentType.per_tool_call:
      return { kind: 'amount', amount: unitCost * Math.max(0, input.toolCalls ?? 0) };
    case PricingComponentType.per_mcp_call:
      return { kind: 'amount', amount: unitCost * Math.max(0, input.mcpCalls ?? 0) };
    case PricingComponentType.per_skill_call:
      return { kind: 'amount', amount: unitCost * Math.max(0, input.skillCalls ?? 0) };
    case PricingComponentType.per_batch:
      return { kind: 'amount', amount: unitCost * Math.max(0, input.batchCount ?? 0) };
    case PricingComponentType.per_reference_image:
      return { kind: 'amount', amount: unitCost * Math.max(0, input.referenceImages ?? 0) };
    case PricingComponentType.reasoning_multiplier:
      return { kind: 'multiplier', multiplier };
    case PricingComponentType.reference_image_multiplier:
      return input.referenceImages ? { kind: 'multiplier', multiplier } : null;
    case PricingComponentType.video_input_multiplier:
      return input.hasVideoInput ? { kind: 'multiplier', multiplier } : null;
    case PricingComponentType.audio_input_multiplier:
      return input.hasAudioInput ? { kind: 'multiplier', multiplier } : null;
    case PricingComponentType.priority_multiplier:
      return input.priority ? { kind: 'multiplier', multiplier } : null;
    default:
      return null;
  }
}

function conditionsMatch(value: unknown, input: EstimateCostInput) {
  const conditions = recordOrEmpty(value);
  const conditionInput: Record<string, unknown> = {
    ...input,
    modelKey: buildPricingModelKey(input.modelProvider, input.modelName),
  };
  for (const [field, expected] of Object.entries(conditions)) {
    if (!conditionValueMatches(expected, conditionInput[field])) {
      return false;
    }
  }
  return true;
}

function buildPricingModelKey(provider: unknown, modelName: unknown) {
  const normalizedProvider = String(provider ?? '').trim();
  const normalizedModel = String(modelName ?? '').trim();
  if (!normalizedProvider || !normalizedModel) return undefined;
  return JSON.stringify([normalizedProvider, normalizedModel]);
}

function conditionValueMatches(expected: unknown, actual: unknown): boolean {
  if (expected == null) return true;
  if (Array.isArray(expected)) return expected.includes(actual);
  if (typeof expected !== 'object') return expected === actual;

  const condition = expected as Record<string, unknown>;
  if ('equals' in condition && condition.equals !== actual) return false;
  if ('in' in condition) {
    const values = Array.isArray(condition.in) ? condition.in : [];
    if (!values.includes(actual)) return false;
  }
  if ('notIn' in condition) {
    const values = Array.isArray(condition.notIn) ? condition.notIn : [];
    if (values.includes(actual)) return false;
  }
  if ('min' in condition && Number(actual ?? 0) < Number(condition.min)) return false;
  if ('max' in condition && Number(actual ?? 0) > Number(condition.max)) return false;
  if ('present' in condition && Boolean(actual) !== Boolean(condition.present)) return false;
  if ('not' in condition && condition.not === actual) return false;
  return true;
}

function conditionSpecificity(conditions: Record<string, unknown>) {
  let score = 0;
  for (const expected of Object.values(conditions)) {
    score += 4;
    if (Array.isArray(expected)) {
      score += expected.length > 0 ? 4 : 0;
      continue;
    }
    if (!expected || typeof expected !== 'object') {
      score += 8;
      continue;
    }
    const condition = expected as Record<string, unknown>;
    if ('equals' in condition) score += 8;
    if ('in' in condition && Array.isArray(condition.in)) score += Math.max(1, 8 - condition.in.length);
    if ('notIn' in condition && Array.isArray(condition.notIn)) score += 2;
    if ('min' in condition) score += 3;
    if ('max' in condition) score += 3;
    if ('present' in condition) score += 1;
    if ('not' in condition) score += 2;
  }
  return score;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function tokenCost(tokens: number | undefined, costPerK: unknown) {
  if (!tokens || !costPerK) return 0;
  return (tokens / 1000) * Number(costPerK);
}
