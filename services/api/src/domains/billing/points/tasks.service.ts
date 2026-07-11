import { Injectable } from '@nestjs/common';
import { resolveDescription, type Locale, type LocalizedText } from '@autix/domain/model';
import { resolveDiscountFactor, toDiscountRow } from './pricing-discount.helpers';
import { TaskPricingRepository } from './repositories/task-pricing.repository';
import { MembershipService } from '../membership/membership.service';
import { isModelVisibleToUser } from './tasks.helpers';
import type { Prisma } from '../../platform/prisma/generated';

export interface TaskModelForUser {
  modelConfigId: string;
  name: string;
  provider: string;
  isDefault: boolean;
  description: string;
  paramsSchema: Prisma.JsonValue;
  pricingSchema: Prisma.JsonValue;
  multiplier: number;
  discountFactor: number;
}

/**
 * `model_configs.description` is `Json @default("{}")` — never NULL at the schema
 * level — but it is still raw DB JSON with no compile-time guarantee of shape.
 * Narrow it explicitly instead of an `as never` cast that defeats type checking:
 * anything that isn't a plain object degrades to `{}`, which is exactly what
 * `resolveDescription`'s own locale -> en -> name fallback chain is built to
 * handle. That is documented fallback behaviour of a pure function, not an
 * invented value standing in for a missing price.
 */
function toLocalizedText(value: Prisma.JsonValue): LocalizedText {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as LocalizedText;
}

type BindingWithPricedModel<
  T extends { modelConfig: { pricingSchema: Prisma.JsonValue | null; paramsSchema: Prisma.JsonValue | null } },
> = T & {
  modelConfig: T['modelConfig'] & { pricingSchema: Prisma.JsonValue; paramsSchema: Prisma.JsonValue };
};

/**
 * NULL `pricingSchema` means "nobody has priced this model yet" — the same
 * invariant `TaskPricingEstimatorService.estimateCost` rejects with a 400. A model
 * in that state must be excluded from the list entirely, not shipped with
 * `pricingSchema: null`: the frontend's `priceOptions()` has no way to render a
 * price tag from that, and a `?? {}` fallback would make `evaluatePricing`
 * silently compute a price of 0 — free generation, invented out of thin air.
 */
function hasPricingSchema<
  T extends { modelConfig: { pricingSchema: Prisma.JsonValue | null; paramsSchema: Prisma.JsonValue | null } },
>(binding: T): binding is BindingWithPricedModel<T> {
  // 两者缺一不可：pricingSchema 为 null → estimateCost 会 400；paramsSchema 为 null →
  // 前端无法渲染控件，是个不可用模型。任一为 null 都从列表里剔除，而不是下发一个残缺模型。
  return binding.modelConfig.pricingSchema !== null && binding.modelConfig.paramsSchema !== null;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly repo: TaskPricingRepository,
    private readonly membershipService: MembershipService,
  ) {}

  async listTasks() {
    return this.repo.findActiveTaskDefinitions();
  }

  async listModelsForTask(
    taskType: string,
    ctx: { userId?: string; locale: Locale },
  ): Promise<TaskModelForUser[]> {
    const bindings = await this.repo.findBindingsForTask(taskType);
    const userLevelId = ctx.userId
      ? await this.membershipService.resolveActiveMembershipLevelId(ctx.userId)
      : null;
    const membershipLevel = ctx.userId
      ? await this.membershipService.resolveActiveMembershipLevel(ctx.userId)
      : 0;

    const now = new Date();
    const discounts = (await this.repo.findActiveDiscounts(now)).map(toDiscountRow);

    // Exclude unpriced models before the visibility filter, so loosening a model's
    // visibility can never "expose" it before it has real pricing configured.
    const priced = bindings.filter(hasPricingSchema);
    const visible = priced.filter((binding) => isModelVisibleToUser(binding.modelConfig, userLevelId));

    return visible.map((binding) => {
      const multiplier = this.toMultiplier(binding.multiplier, binding.modelConfigId);
      const { factor: discountFactor } = resolveDiscountFactor(
        discounts,
        { membershipLevel, taskType, modelConfigId: binding.modelConfigId },
        now,
      );
      return {
        modelConfigId: binding.modelConfigId,
        name: binding.modelConfig.name,
        provider: binding.modelConfig.provider,
        isDefault: binding.isDefault,
        description: resolveDescription(
          toLocalizedText(binding.modelConfig.description),
          ctx.locale,
          binding.modelConfig.name,
        ),
        paramsSchema: binding.modelConfig.paramsSchema,
        pricingSchema: binding.modelConfig.pricingSchema,
        multiplier,
        discountFactor,
      };
    });
  }

  /**
   * binding.multiplier is Prisma.Decimal(6,3). `number * Decimal` is NaN, and it
   * must never reach the response silently. Mirrors
   * TaskPricingEstimatorService#toMultiplier's non-finite guard.
   */
  private toMultiplier(rawMultiplier: unknown, modelConfigId: string): number {
    const multiplier = Number(rawMultiplier);
    if (!Number.isFinite(multiplier)) {
      throw new Error(
        `TasksService: model ${modelConfigId} has a non-numeric multiplier (${String(rawMultiplier)})`,
      );
    }
    return multiplier;
  }
}
