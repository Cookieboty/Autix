import { Injectable, BadRequestException } from '@nestjs/common';
import { PricingRuleRepository } from '../repositories/pricing-rule.repository';
import {
  estimatePricingRuleCost,
  findMatchingPricingRule,
  type EstimateCostInput,
} from '../pricing-estimator';
import { PricingBaseUnit, PricingComponentType } from '../../../platform/prisma/generated';

export type { EstimateCostInput } from '../pricing-estimator';

@Injectable()
export class PricingEstimatorService {
  constructor(
    private readonly pricingRuleRepo: PricingRuleRepository,
  ) {}

  async getTaskCosts() {
    return this.pricingRuleRepo.findActiveRules();
  }

  async getPricingRules() {
    return this.pricingRuleRepo.findActiveRules();
  }

  async estimateCost(input: EstimateCostInput) {
    const candidates = await this.pricingRuleRepo.findCandidatesForTask(input.taskType);
    const rule = findMatchingPricingRule(candidates, input);
    if (!rule) {
      throw new BadRequestException(`未配置计费规则: ${input.taskType}`);
    }

    const { estimatedCost, multiplier, items } = estimatePricingRuleCost(rule, input);
    return {
      estimatedCost,
      ruleId: rule.id,
      taskType: rule.taskType,
      ruleName: rule.name,
      baseUnit: rule.baseUnit,
      multiplier,
      items,
      breakdown: items,
      pricingSnapshot: {
        ruleId: rule.id,
        taskType: rule.taskType,
        name: rule.name,
        input,
        items,
        multiplier,
        estimatedCost,
      },
      refundPolicy: rule.refundPolicy,
    };
  }

  async previewPricingRule(input: EstimateCostInput) {
    const warnings: Array<{ code: string; message: string; field?: string }> = [];
    let estimate: Awaited<ReturnType<PricingEstimatorService['estimateCost']>> | null = null;
    let estimateError: string | null = null;
    try {
      estimate = await this.estimateCost(input);
    } catch (error: any) {
      estimateError = error?.message ?? String(error);
    }

    const matchedRule = estimate
      ? await this.pricingRuleRepo.findById(estimate.ruleId)
      : null;

    if (!matchedRule) {
      warnings.push({
        code: 'NO_RULE_MATCHED',
        message: estimateError ?? '未命中任何计费规则',
      });
    } else {
      const activeComponents = (matchedRule.components ?? [])
        .filter((component) => component.isActive !== false);

      if (activeComponents.length === 0) {
        warnings.push({
          code: 'NO_COMPONENTS',
          message: '该规则没有启用的扣费组件',
          field: 'components',
        });
      }

      for (const component of activeComponents) {
        const rawValue = isMultiplierComponent(component.componentType)
          ? component.multiplier
          : component.unitCost;
        const value = rawValue == null ? NaN : Number(rawValue);
        if (!Number.isFinite(value) || value < 0) {
          const field = `components.${component.componentType}.${isMultiplierComponent(component.componentType) ? 'multiplier' : 'unitCost'}`;
          warnings.push({
            code: isMultiplierComponent(component.componentType)
              ? 'INVALID_COMPONENT_MULTIPLIER'
              : 'INVALID_COMPONENT_UNIT_COST',
            message: `${component.componentType} 组件 ${isMultiplierComponent(component.componentType) ? 'multiplier' : 'unitCost'} 取值非法: ${String(rawValue)}`,
            field,
          });
        }
      }

      if (matchedRule.baseUnit === PricingBaseUnit.image && (input.quantity ?? 0) <= 0) {
        warnings.push({
          code: 'MISSING_QUANTITY',
          message: 'baseUnit=image 但未提供有效的 quantity，将按 1 计算',
          field: 'quantity',
        });
      }
      if (matchedRule.baseUnit === PricingBaseUnit.second && (input.seconds ?? 0) <= 0) {
        warnings.push({
          code: 'MISSING_SECONDS',
          message: 'baseUnit=second 但未提供有效的 seconds，将按 1 计算',
          field: 'seconds',
        });
      }

      if (estimate && estimate.estimatedCost <= 0) {
        warnings.push({
          code: 'ZERO_ESTIMATED_COST',
          message: '当前输入下估算扣费为 0，请确认规则与入参',
        });
      }
    }

    return {
      estimate,
      estimateError,
      matchedRule,
      warnings,
    };
  }

}

function isMultiplierComponent(componentType: PricingComponentType) {
  return componentType === PricingComponentType.reasoning_multiplier
    || componentType === PricingComponentType.reference_image_multiplier
    || componentType === PricingComponentType.video_input_multiplier
    || componentType === PricingComponentType.audio_input_multiplier
    || componentType === PricingComponentType.priority_multiplier;
}
