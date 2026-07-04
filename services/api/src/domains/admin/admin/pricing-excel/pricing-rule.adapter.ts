/**
 * Adapts the framework-agnostic domain upsert payload into the Prisma write
 * shape used by the repository. This is the ONLY place the domain output meets
 * Prisma — the domain layer never imports generated types.
 */
import type { PricingRuleUpsertInput } from '@autix/domain/billing';
import {
  PricingBaseUnit,
  Prisma,
  type PricingComponentType,
} from '../../../platform/prisma/generated';
import type { PricingRuleWriteData } from '../admin.repository';

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function pricingUpsertToWriteData(input: PricingRuleUpsertInput): PricingRuleWriteData {
  const rule: Prisma.generation_pricing_rulesUncheckedCreateInput = {
    taskType: input.taskType,
    name: input.name,
    baseUnit: (input.baseUnit ||
      PricingBaseUnit.task) as Prisma.generation_pricing_rulesUncheckedCreateInput['baseUnit'],
    priority: Math.max(0, Math.floor(input.priority || 0)),
    conditions: toJson(input.conditions),
    refundPolicy: toJson(input.refundPolicy),
    metadata: toJson(input.metadata),
    effectiveFrom: input.effectiveFrom ?? undefined,
    effectiveTo: input.effectiveTo ?? undefined,
    isActive: input.isActive,
  };

  const components = input.components.map((component, index) => ({
    componentType: component.componentType as PricingComponentType,
    unitCost: component.unitCost ?? null,
    multiplier: component.multiplier ?? null,
    config: toJson(component.config),
    sort: component.sort ?? index * 10,
    isActive: component.isActive ?? true,
  }));

  return { rule, components };
}
